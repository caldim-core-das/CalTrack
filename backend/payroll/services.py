"""
payroll/services.py

Payroll calculation engine, settlement-cycle accounting, bank/KYC verification gating,
and wallet statement service layer.
"""

import csv
import io
from datetime import timedelta, datetime
from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError, PermissionDenied
from django.db import transaction
from django.utils import timezone

from .models import (
    PayrollConfig,
    WalletTransaction,
    EmployeeWalletBalance,
    SettlementCycle,
    BankAccount,
    KYCStatus,
    PayoutDispute,
)


def _round2(val: Decimal) -> Decimal:
    """Round Decimal to 2 decimal places using ROUND_HALF_UP."""
    if not isinstance(val, Decimal):
        val = Decimal(str(val))
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def validate_payroll_config(config: PayrollConfig):
    """
    Validate that total revenue shares do not exceed 100%.
    """
    emp_share = Decimal(str(config.employee_share_percent or 0))
    comp_share = Decimal(str(config.company_share_percent or 0))

    if config.platform_fee_type == PayrollConfig.PlatformFeeType.PERCENTAGE:
        plat_share = Decimal(str(config.platform_fee_percent or 0))
    else:
        plat_share = Decimal("0.00")

    total = emp_share + comp_share + plat_share
    if total > Decimal("100.00"):
        raise ValidationError(
            f"Service revenue shares ({total}%) exceed 100%. "
            "Please lower employee, company, or platform fee percentages."
        )


def save_payroll_config(config: PayrollConfig, org) -> PayrollConfig:
    """
    Validates config and saves it for the organization.
    Enforces a single active config per org by deactivating prior configs when is_active=True.
    """
    config.org = org
    validate_payroll_config(config)

    with transaction.atomic():
        if config.is_active:
            PayrollConfig.objects.filter(org=org, is_active=True).exclude(
                pk=config.pk if config.pk else None
            ).update(is_active=False)
        config.save()

    return config


def calculate_service_split(gross_amount: Decimal, config: PayrollConfig) -> dict:
    """
    Calculate financial breakdown for a gross service payment amount using config parameters.
    Returns dictionary with 2-decimal rounded values.
    """
    gross = Decimal(str(gross_amount))
    if gross < Decimal("0.00"):
        raise ValidationError("Gross amount cannot be negative.")

    emp_pct = Decimal(str(config.employee_share_percent or 0))
    comp_pct = Decimal(str(config.company_share_percent or 0))
    plat_pct = Decimal(str(config.platform_fee_percent or 0))
    pf_pct = Decimal(str(config.pf_percent or 0))
    esi_pct = Decimal(str(config.esi_percent or 0))
    tds_pct = Decimal(str(config.tds_percent or 0))

    emp_share = gross * (emp_pct / Decimal("100"))
    comp_share = gross * (comp_pct / Decimal("100"))

    if config.platform_fee_type == PayrollConfig.PlatformFeeType.PERCENTAGE:
        plat_fee = gross * (plat_pct / Decimal("100"))
    else:
        plat_fee = Decimal(str(config.platform_fee_fixed_amount or 0))

    pf_ded = emp_share * (pf_pct / Decimal("100"))
    esi_ded = emp_share * (esi_pct / Decimal("100"))
    tds_ded = emp_share * (tds_pct / Decimal("100"))

    net_credit = emp_share - pf_ded - esi_ded - tds_ded

    return {
        "employee_share_amount": _round2(emp_share),
        "company_share_amount": _round2(comp_share),
        "platform_fee_amount": _round2(plat_fee),
        "pf_deduction": _round2(pf_ded),
        "esi_deduction": _round2(esi_ded),
        "tds_deduction": _round2(tds_ded),
        "net_credit_amount": _round2(net_credit),
    }


def create_wallet_transaction(
    booking, gross_amount: Decimal, org, employee=None, category=WalletTransaction.Category.SERVICE_PAYOUT
) -> WalletTransaction:
    """
    Creates a PENDING WalletTransaction snapshotting the org's active PayrollConfig.
    Does NOT credit the wallet balance yet.
    """
    active_config = PayrollConfig.objects.filter(org=org, is_active=True).first()
    if not active_config:
        raise ValidationError(f"No active payroll configuration found for organization '{org}'.")

    if employee is None and booking is not None:
        employee = (
            getattr(booking, "assigned_employee", None)
            or getattr(booking, "assigned_to", None)
            or getattr(booking, "employee", None)
        )

    if not employee:
        raise ValidationError("Employee is required for wallet transaction creation.")

    breakdown = calculate_service_split(gross_amount, active_config)

    tx = WalletTransaction(
        org=org,
        employee=employee,
        booking=booking,
        payroll_config=active_config,
        category=category,
        gross_amount=_round2(Decimal(str(gross_amount))),
        employee_share_amount=breakdown["employee_share_amount"],
        company_share_amount=breakdown["company_share_amount"],
        platform_fee_amount=breakdown["platform_fee_amount"],
        pf_deduction=breakdown["pf_deduction"],
        esi_deduction=breakdown["esi_deduction"],
        tds_deduction=breakdown["tds_deduction"],
        net_credit_amount=breakdown["net_credit_amount"],
        status=WalletTransaction.Status.PENDING,
    )
    tx.save()
    return tx


def credit_wallet_transaction(transaction_id, org) -> WalletTransaction:
    """
    Atomically transitions a transaction PENDING -> CREDITED and adds to pending_balance.
    Idempotent: throws ValidationError if transaction is not PENDING.
    """
    with transaction.atomic():
        tx = WalletTransaction.objects.select_for_update().filter(id=transaction_id, org=org).first()
        if not tx:
            raise ValidationError(f"Wallet transaction #{transaction_id} not found.")

        tx.apply_transition(WalletTransaction.Status.CREDITED)
        tx.credited_at = timezone.now()

        balance, _ = EmployeeWalletBalance.objects.select_for_update().get_or_create(
            org=org,
            employee=tx.employee,
            defaults={"available_balance": Decimal("0.00"), "pending_balance": Decimal("0.00")},
        )
        balance.pending_balance = Decimal(str(balance.pending_balance or 0)) + tx.net_credit_amount
        balance.save()

        tx.save()
        return tx


def run_settlement_cycle(org, cycle_end_date) -> SettlementCycle:
    """
    Runs settlement cycle for org up to cycle_end_date.
    Moves matching CREDITED transactions from pending_balance to available_balance on EmployeeWalletBalance.
    Idempotent: raises ValidationError if a SETTLED SettlementCycle already exists for cycle_end_date.
    """
    if isinstance(cycle_end_date, str):
        cycle_end_date = datetime.strptime(cycle_end_date, "%Y-%m-%d").date()

    existing_settled = SettlementCycle.objects.filter(
        org=org, cycle_end=cycle_end_date, status=SettlementCycle.Status.SETTLED
    ).first()
    if existing_settled:
        raise ValidationError(f"Settlement cycle for end date {cycle_end_date} has already been settled.")

    with transaction.atomic():
        txs = list(
            WalletTransaction.objects.select_for_update().filter(
                org=org,
                status=WalletTransaction.Status.CREDITED,
                settlement_cycle__isnull=True,
                created_at__date__lte=cycle_end_date,
            )
        )

        last_cycle = SettlementCycle.objects.filter(org=org).order_by("-cycle_end").first()
        if last_cycle:
            cycle_start = last_cycle.cycle_end + timedelta(days=1)
        elif txs:
            cycle_start = min(t.created_at.date() for t in txs)
        else:
            cycle_start = cycle_end_date

        settlement_date = cycle_end_date + timedelta(days=1)

        cycle = SettlementCycle.objects.create(
            org=org,
            cycle_start=cycle_start,
            cycle_end=cycle_end_date,
            settlement_date=settlement_date,
            status=SettlementCycle.Status.PROCESSING,
        )

        affected_employees = set()
        total_settled_amount = Decimal("0.00")

        for tx in txs:
            tx.settlement_cycle = cycle
            tx.save()

            balance, _ = EmployeeWalletBalance.objects.select_for_update().get_or_create(
                org=org,
                employee=tx.employee,
                defaults={"available_balance": Decimal("0.00"), "pending_balance": Decimal("0.00")},
            )
            balance.pending_balance = max(
                Decimal("0.00"), Decimal(str(balance.pending_balance or 0)) - tx.net_credit_amount
            )
            balance.available_balance = Decimal(str(balance.available_balance or 0)) + tx.net_credit_amount
            balance.save()

            affected_employees.add(tx.employee_id)
            total_settled_amount += tx.net_credit_amount

        cycle.status = SettlementCycle.Status.SETTLED
        cycle.save()

        cycle.employee_count = len(affected_employees)
        cycle.total_settled_amount = _round2(total_settled_amount)

        return cycle


def get_payout_eligibility(employee) -> dict:
    """
    Checks if employee is eligible for payout.
    Returns: {'eligible': bool, 'blockers': [list of string warnings]}
    """
    blockers = []

    has_verified_bank = BankAccount.objects.filter(
        employee=employee,
        is_primary=True,
        verification_status=BankAccount.VerificationStatus.VERIFIED,
    ).exists()
    if not has_verified_bank:
        blockers.append("Add a verified bank account")

    kyc = KYCStatus.objects.filter(employee=employee).first()
    if not kyc or kyc.overall_status != KYCStatus.OverallStatus.VERIFIED:
        blockers.append("Complete KYC verification")

    return {"eligible": len(blockers) == 0, "blockers": blockers}


def recompute_kyc_status(kyc_status_instance: KYCStatus) -> KYCStatus:
    """
    Recomputes overall_status on KYCStatus based on pan_verified and aadhaar_verified flags.
    """
    if kyc_status_instance.pan_verified and kyc_status_instance.aadhaar_verified:
        kyc_status_instance.overall_status = KYCStatus.OverallStatus.VERIFIED
    elif kyc_status_instance.pan_verified or kyc_status_instance.aadhaar_verified:
        kyc_status_instance.overall_status = KYCStatus.OverallStatus.PARTIAL
    else:
        kyc_status_instance.overall_status = KYCStatus.OverallStatus.UNVERIFIED

    kyc_status_instance.save()
    return kyc_status_instance


def generate_statement(employee, org, period: str = "month", format: str = "csv") -> bytes:
    """
    Generates downloadable wallet statement (CSV or PDF) for employee and org for the period.
    """
    qs = WalletTransaction.objects.filter(
        employee=employee, org=org, status=WalletTransaction.Status.CREDITED
    ).order_by("-created_at")

    now = timezone.now()
    if period == "today":
        qs = qs.filter(created_at__date=now.date())
    elif period == "week":
        qs = qs.filter(created_at__date__gte=now.date() - timedelta(days=7))
    elif period == "month":
        qs = qs.filter(created_at__year=now.year, created_at__month=now.month)

    txs = list(qs)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            ["Date", "Job Reference", "Category", "Gross Amount", "PF", "ESI", "TDS", "Net Credited", "Status"]
        )
        for tx in txs:
            ref = tx.booking.request_id if tx.booking else f"TXN-{tx.id}"
            writer.writerow(
                [
                    tx.created_at.strftime("%Y-%m-%d %H:%M"),
                    ref,
                    tx.get_category_display(),
                    str(tx.gross_amount),
                    str(tx.pf_deduction),
                    str(tx.esi_deduction),
                    str(tx.tds_deduction),
                    str(tx.net_credit_amount),
                    tx.status,
                ]
            )
        return output.getvalue().encode("utf-8")

    elif format == "pdf":
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
        from reportlab.lib.colors import HexColor, white, black

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        W, H = letter

        # Header Branding
        c.setFillColor(HexColor("#4F46E5"))
        c.rect(0, H - 70, W, 70, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 18)
        c.drawString(30, H - 40, f"CalTrack Wallet Statement ({period.capitalize()})")

        c.setFillColor(black)
        c.setFont("Helvetica", 10)
        c.drawString(30, H - 90, f"Employee: {employee}")
        c.drawString(30, H - 105, f"Organization: {org}")
        c.drawString(30, H - 120, f"Date Generated: {now.strftime('%Y-%m-%d %H:%M')}")

        y = H - 150
        # Table Header
        c.setFillColor(HexColor("#4F46E5"))
        c.rect(25, y - 5, W - 50, 20, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(30, y, "Date")
        c.drawString(100, y, "Reference")
        c.drawString(180, y, "Category")
        c.drawRightString(320, y, "Gross (₹)")
        c.drawRightString(410, y, "Deductions (₹)")
        c.drawRightString(W - 30, y, "Net Credited (₹)")

        y -= 20
        c.setFillColor(black)
        c.setFont("Helvetica", 8)

        total_gross = Decimal("0.00")
        total_deductions = Decimal("0.00")
        total_net = Decimal("0.00")

        for tx in txs:
            if y < 60:
                c.showPage()
                y = H - 50

            ref = tx.booking.request_id if tx.booking else f"TXN-{tx.id}"
            deds = tx.pf_deduction + tx.esi_deduction + tx.tds_deduction

            c.drawString(30, y, tx.created_at.strftime("%Y-%m-%d"))
            c.drawString(100, y, ref[:12])
            c.drawString(180, y, tx.get_category_display()[:15])
            c.drawRightString(320, y, f"₹{tx.gross_amount}")
            c.drawRightString(410, y, f"-₹{deds}")
            c.drawRightString(W - 30, y, f"₹{tx.net_credit_amount}")

            total_gross += tx.gross_amount
            total_deductions += deds
            total_net += tx.net_credit_amount

            c.setStrokeColor(HexColor("#E2E8F0"))
            c.line(25, y - 4, W - 25, y - 4)
            y -= 18

        # Summary Row
        y -= 10
        if y < 60:
            c.showPage()
            y = H - 50

        c.setFillColor(HexColor("#F1F5F9"))
        c.rect(25, y - 5, W - 50, 24, fill=1, stroke=0)
        c.setFillColor(HexColor("#0F172A"))
        c.setFont("Helvetica-Bold", 9)
        c.drawString(30, y + 2, "TOTALS")
        c.drawRightString(320, y + 2, f"₹{_round2(total_gross)}")
        c.drawRightString(410, y + 2, f"-₹{_round2(total_deductions)}")
        c.drawRightString(W - 30, y + 2, f"₹{_round2(total_net)}")

        c.showPage()
        c.save()
        return buffer.getvalue()
    else:
        raise ValidationError("Unsupported statement format. Choose 'csv' or 'pdf'.")


def create_dispute(transaction_id, employee, org, reason: str) -> PayoutDispute:
    """
    Creates a PayoutDispute for a transaction.
    Enforces transaction ownership and one OPEN dispute per transaction at a time.
    """
    tx = WalletTransaction.objects.filter(id=transaction_id).first()
    if not tx:
        raise ValidationError(f"Transaction #{transaction_id} not found.")

    if tx.employee_id != employee.id or tx.org_id != org.id:
        raise PermissionDenied("You can only raise disputes for your own organization transactions.")

    existing_open = PayoutDispute.objects.filter(
        transaction=tx, status__in=[PayoutDispute.Status.OPEN, PayoutDispute.Status.IN_REVIEW]
    ).exists()
    if existing_open:
        raise ValidationError(f"An open dispute already exists for transaction #{transaction_id}.")

    dispute = PayoutDispute.objects.create(
        transaction=tx, employee=employee, org=org, reason=reason, status=PayoutDispute.Status.OPEN
    )
    return dispute
