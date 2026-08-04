import datetime
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError, PermissionDenied
from rest_framework.test import APIRequestFactory

from companies.models import Company
from employees.models import Employee
from payroll.models import (
    PayrollConfig,
    WalletTransaction,
    EmployeeWalletBalance,
    SettlementCycle,
    BankAccount,
    KYCStatus,
    PayoutDispute,
)
from payroll.services import (
    create_wallet_transaction,
    credit_wallet_transaction,
    run_settlement_cycle,
    get_payout_eligibility,
    recompute_kyc_status,
    generate_statement,
    create_dispute,
)
from payroll.serializers import BankAccountSerializer

User = get_user_model()


class SettlementAndDisputesTest(TestCase):
    def setUp(self):
        self.org = Company.objects.create(company_name="Settlement Corp", is_active=True)
        self.config = PayrollConfig.objects.create(
            org=self.org,
            employee_share_percent=Decimal("80.00"),
            company_share_percent=Decimal("10.00"),
            platform_fee_percent=Decimal("5.00"),
            pf_percent=Decimal("12.00"),
            esi_percent=Decimal("0.75"),
            tds_percent=Decimal("0.00"),
            is_active=True
        )

        self.user1 = User.objects.create_user(username="emp1", password="pass123")
        self.user2 = User.objects.create_user(username="emp2", password="pass123")

        self.emp1 = Employee.objects.create(
            user=self.user1,
            company=self.org,
            employee_id="EMP-101",
            is_active=True
        )
        self.emp2 = Employee.objects.create(
            user=self.user2,
            company=self.org,
            employee_id="EMP-102",
            is_active=True
        )

    def test_run_settlement_cycle_moves_pending_to_available_and_idempotent(self):
        # Create and credit 2 transactions for emp1
        tx1 = create_wallet_transaction(None, Decimal("1000.00"), self.org, self.emp1)
        credit_wallet_transaction(tx1.id, self.org)

        tx2 = create_wallet_transaction(None, Decimal("2000.00"), self.org, self.emp1)
        credit_wallet_transaction(tx2.id, self.org)

        balance = EmployeeWalletBalance.objects.get(org=self.org, employee=self.emp1)
        # net for ₹1000: 1000*80%=800, PF=96, ESI=6, net=698
        # net for ₹2000: 2000*80%=1600, PF=192, ESI=12, net=1396
        # total pending = 698 + 1396 = 2094
        self.assertEqual(balance.pending_balance, Decimal("2094.00"))
        self.assertEqual(balance.available_balance, Decimal("0.00"))

        today = datetime.date.today()
        cycle = run_settlement_cycle(self.org, today)

        self.assertEqual(cycle.status, SettlementCycle.Status.SETTLED)
        balance.refresh_from_db()
        self.assertEqual(balance.pending_balance, Decimal("0.00"))
        self.assertEqual(balance.available_balance, Decimal("2094.00"))
        self.assertEqual(balance.total_balance, Decimal("2094.00"))

        # Second call on same cycle_end raises ValidationError and does not double-move
        with self.assertRaises(ValidationError):
            run_settlement_cycle(self.org, today)

        balance.refresh_from_db()
        self.assertEqual(balance.available_balance, Decimal("2094.00"))

    def test_get_payout_eligibility_blockers(self):
        # 1. No bank account, unverified KYC
        el1 = get_payout_eligibility(self.emp1)
        self.assertFalse(el1["eligible"])
        self.assertIn("Add a verified bank account", el1["blockers"])
        self.assertIn("Complete KYC verification", el1["blockers"])

        # 2. Add unverified bank account
        bank = BankAccount.objects.create(
            employee=self.emp1,
            org=self.org,
            account_number="123456789012",
            ifsc_code="HDFC0001234",
            is_primary=True,
            verification_status=BankAccount.VerificationStatus.PENDING
        )
        el2 = get_payout_eligibility(self.emp1)
        self.assertFalse(el2["eligible"])
        self.assertIn("Add a verified bank account", el2["blockers"])

        # 3. Verify bank account, partial KYC
        bank.apply_transition(BankAccount.VerificationStatus.VERIFIED)
        bank.save()

        kyc, _ = KYCStatus.objects.get_or_create(employee=self.emp1, org=self.org)
        kyc.pan_verified = True
        recompute_kyc_status(kyc)

        el3 = get_payout_eligibility(self.emp1)
        self.assertFalse(el3["eligible"])
        self.assertIn("Complete KYC verification", el3["blockers"])

        # 4. Fully verified KYC & bank account
        kyc.aadhaar_verified = True
        recompute_kyc_status(kyc)

        el4 = get_payout_eligibility(self.emp1)
        self.assertTrue(el4["eligible"])
        self.assertEqual(len(el4["blockers"]), 0)

    def test_recompute_kyc_status_combinations(self):
        kyc = KYCStatus.objects.create(employee=self.emp2, org=self.org)

        # Neither -> UNVERIFIED
        recompute_kyc_status(kyc)
        self.assertEqual(kyc.overall_status, KYCStatus.OverallStatus.UNVERIFIED)

        # PAN only -> PARTIAL
        kyc.pan_verified = True
        recompute_kyc_status(kyc)
        self.assertEqual(kyc.overall_status, KYCStatus.OverallStatus.PARTIAL)

        # PAN + Aadhaar -> VERIFIED
        kyc.aadhaar_verified = True
        recompute_kyc_status(kyc)
        self.assertEqual(kyc.overall_status, KYCStatus.OverallStatus.VERIFIED)

    def test_generate_statement_csv_totals(self):
        tx1 = create_wallet_transaction(None, Decimal("1000.00"), self.org, self.emp1)
        credit_wallet_transaction(tx1.id, self.org)
        tx2 = create_wallet_transaction(None, Decimal("500.00"), self.org, self.emp1)
        credit_wallet_transaction(tx2.id, self.org)

        csv_bytes = generate_statement(self.emp1, self.org, period="all", format="csv")
        csv_text = csv_bytes.decode("utf-8")

        self.assertIn("Date,Job Reference,Category,Gross Amount,PF,ESI,TDS,Net Credited,Status", csv_text)
        self.assertIn("1000.00", csv_text)
        self.assertIn("500.00", csv_text)
        self.assertIn("698.00", csv_text)   # net credit for ₹1000: 800 - 96 PF - 6 ESI = 698
        self.assertIn("349.00", csv_text)   # net credit for ₹500: 400 - 48 PF - 3 ESI = 349

    def test_bank_account_serializer_never_leaks_account_number(self):
        bank = BankAccount.objects.create(
            employee=self.emp1,
            org=self.org,
            account_number="987654321099",
            ifsc_code="SBIN0004321",
            is_primary=True
        )

        serializer = BankAccountSerializer(bank)
        data = serializer.data

        self.assertNotIn("account_number", data)
        self.assertEqual(data["masked_account_number"], "********1099")

    def test_create_dispute_validation(self):
        tx = create_wallet_transaction(None, Decimal("1000.00"), self.org, self.emp1)
        credit_wallet_transaction(tx.id, self.org)

        # Cannot raise dispute for another employee's transaction
        with self.assertRaises(PermissionDenied):
            create_dispute(tx.id, self.emp2, self.org, "Not my job")

        # Employee 1 raises dispute successfully
        dispute = create_dispute(tx.id, self.emp1, self.org, "Deduction calculation mismatch")
        self.assertEqual(dispute.status, PayoutDispute.Status.OPEN)

        # Cannot raise second OPEN dispute on same transaction
        with self.assertRaises(ValidationError):
            create_dispute(tx.id, self.emp1, self.org, "Duplicate dispute attempt")
