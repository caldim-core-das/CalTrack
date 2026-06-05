"""
mileage/services.py

All business logic for mileage reimbursement.
Never import or call these from models — only from views.
"""
from __future__ import annotations

import math
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from django.utils import timezone


# ── Helpers ─────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> Decimal:
    """Return great-circle distance in km between two lat/lng points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    km = 2 * R * math.asin(math.sqrt(a))
    return Decimal(str(round(km, 4)))


def _km_to_miles(km: Decimal) -> Decimal:
    return (km * Decimal("0.621371")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _uk_tax_year_label(trip_date: date, start_month: int, start_day: int) -> str:
    """Return label like '2024-2025' for a given date under UK tax year rules."""
    ty_start = date(trip_date.year, start_month, start_day)
    if trip_date >= ty_start:
        return f"{trip_date.year}-{trip_date.year + 1}"
    return f"{trip_date.year - 1}-{trip_date.year}"


def _get_or_create_policy(company):
    """Fetch or lazily create the MileagePolicy for a company."""
    from .models import MileagePolicy
    policy, _ = MileagePolicy.objects.get_or_create(company=company)
    return policy


# ── Core Services ────────────────────────────────────────────────────────────

def calculate_trip_reimbursement(trip_id: int, company_id: int) -> dict:
    """
    Apply jurisdiction-specific IRS/HMRC/India rates, split UK trips at 10k
    threshold, set is_taxable_excess, update MileageYTDTracker.

    Returns a dict of the updated trip fields.
    """
    from .models import MileageTrip, MileageYTDTracker

    trip = MileageTrip.objects.select_related("employee", "company").get(
        pk=trip_id, company_id=company_id
    )
    policy = _get_or_create_policy(trip.company)

    miles = Decimal(str(trip.distance_miles))
    j = trip.jurisdiction

    # ── UK / HMRC ────────────────────────────────────────────────────────────
    if j == MileageTrip.Jurisdiction.UK:
        tax_year = _uk_tax_year_label(
            trip.trip_date,
            policy.uk_tax_year_start_month,
            policy.uk_tax_year_start_day,
        )
        trip.tax_year = tax_year
        trip.currency = "GBP"

        ytd, _ = MileageYTDTracker.objects.get_or_create(
            company=trip.company,
            employee=trip.employee,
            jurisdiction=j,
            tax_year=tax_year,
        )

        ytd_before = Decimal(str(ytd.total_miles))
        trip.ytd_miles_before = ytd_before
        threshold = Decimal(str(policy.uk_mileage_threshold))

        high_rate = Decimal(str(policy.rate_per_mile_gbp_first))
        low_rate = Decimal(str(policy.rate_per_mile_gbp_after))

        if ytd_before >= threshold:
            # All miles at low rate
            high_miles = Decimal("0")
            low_miles = miles
        elif ytd_before + miles <= threshold:
            # All miles at high rate
            high_miles = miles
            low_miles = Decimal("0")
        else:
            # Split
            high_miles = threshold - ytd_before
            low_miles = miles - high_miles

        reimbursement = (high_miles * high_rate) + (low_miles * low_rate)
        trip.miles_at_high_rate = high_miles
        trip.miles_at_low_rate = low_miles
        trip.rate_applied = high_rate if low_miles == 0 else low_rate
        trip.reimbursement_amount = reimbursement.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Taxable excess: HMRC approved rate is 45p/25p; any excess is taxable income
        # (In practice, if employer pays more than approved rate, excess is taxable.
        #  Here we assume employer pays at approved rate, so no excess unless trip > threshold.)
        if ytd_before < threshold and ytd_before + miles > threshold:
            trip.is_taxable_excess = True
            trip.taxable_excess_amount = (low_miles * low_rate).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            trip.is_taxable_excess = False
            trip.taxable_excess_amount = Decimal("0.00")

        # Update YTD tracker
        ytd.total_miles = ytd_before + miles
        ytd.miles_at_high_rate = Decimal(str(ytd.miles_at_high_rate)) + high_miles
        ytd.miles_at_low_rate = Decimal(str(ytd.miles_at_low_rate)) + low_miles
        ytd.total_reimbursed_gbp = Decimal(str(ytd.total_reimbursed_gbp)) + reimbursement
        if ytd.threshold_crossed_date is None and ytd.total_miles >= threshold:
            ytd.threshold_crossed_date = trip.trip_date
        ytd.save()

    # ── US / IRS ─────────────────────────────────────────────────────────────
    elif j == MileageTrip.Jurisdiction.US:
        trip.tax_year = str(trip.trip_date.year)
        trip.currency = "USD"
        rate = Decimal(str(policy.rate_per_mile_usd))
        trip.rate_applied = rate
        trip.miles_at_high_rate = miles
        trip.miles_at_low_rate = Decimal("0")
        trip.reimbursement_amount = (miles * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        trip.ytd_miles_before = Decimal("0")
        trip.is_taxable_excess = False
        trip.taxable_excess_amount = Decimal("0.00")

        # Update YTD
        ytd, _ = MileageYTDTracker.objects.get_or_create(
            company=trip.company,
            employee=trip.employee,
            jurisdiction=j,
            tax_year=trip.tax_year,
        )
        ytd.total_miles = Decimal(str(ytd.total_miles)) + miles
        ytd.miles_at_high_rate = Decimal(str(ytd.miles_at_high_rate)) + miles
        ytd.save()

    # ── India ─────────────────────────────────────────────────────────────────
    elif j == MileageTrip.Jurisdiction.IN:
        trip.tax_year = str(trip.trip_date.year)
        trip.currency = "INR"
        km = Decimal(str(trip.distance_km))
        rate = Decimal(str(policy.rate_per_km_inr))
        trip.rate_applied = rate
        trip.miles_at_high_rate = Decimal(str(trip.distance_miles))
        trip.miles_at_low_rate = Decimal("0")
        trip.reimbursement_amount = (km * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        trip.ytd_miles_before = Decimal("0")
        trip.is_taxable_excess = False
        trip.taxable_excess_amount = Decimal("0.00")

        ytd, _ = MileageYTDTracker.objects.get_or_create(
            company=trip.company,
            employee=trip.employee,
            jurisdiction=j,
            tax_year=trip.tax_year,
        )
        ytd.total_miles = Decimal(str(ytd.total_miles)) + Decimal(str(trip.distance_miles))
        ytd.save()

    # Auto-approve if below threshold
    if (
        policy.auto_approve_below_miles is not None
        and miles <= Decimal(str(policy.auto_approve_below_miles))
        and trip.approval_status == MileageTrip.ApprovalStatus.PENDING
    ):
        trip.approval_status = MileageTrip.ApprovalStatus.APPROVED
        trip.approved_at = timezone.now()

    trip.save()
    return {
        "id": trip.pk,
        "reimbursement_amount": str(trip.reimbursement_amount),
        "currency": trip.currency,
        "miles_at_high_rate": str(trip.miles_at_high_rate),
        "miles_at_low_rate": str(trip.miles_at_low_rate),
        "rate_applied": str(trip.rate_applied),
        "is_taxable_excess": trip.is_taxable_excess,
        "taxable_excess_amount": str(trip.taxable_excess_amount),
        "approval_status": trip.approval_status,
    }


def preview_trip_reimbursement(
    employee_id: int,
    company,
    distance_miles: Decimal,
    distance_km: Decimal,
    jurisdiction: str,
    trip_date: date,
) -> dict:
    """
    Calculate reimbursement without saving — used by the live preview endpoint.
    """
    from .models import MileageTrip, MileageYTDTracker

    policy = _get_or_create_policy(company)
    miles = Decimal(str(distance_miles))

    if jurisdiction == MileageTrip.Jurisdiction.UK:
        tax_year = _uk_tax_year_label(
            trip_date,
            policy.uk_tax_year_start_month,
            policy.uk_tax_year_start_day,
        )
        ytd = MileageYTDTracker.objects.filter(
            company=company, employee_id=employee_id,
            jurisdiction=jurisdiction, tax_year=tax_year,
        ).first()
        ytd_total = Decimal(str(ytd.total_miles)) if ytd else Decimal("0")
        threshold = Decimal(str(policy.uk_mileage_threshold))
        high_rate = Decimal(str(policy.rate_per_mile_gbp_first))
        low_rate = Decimal(str(policy.rate_per_mile_gbp_after))

        if ytd_total >= threshold:
            high_m, low_m = Decimal("0"), miles
        elif ytd_total + miles <= threshold:
            high_m, low_m = miles, Decimal("0")
        else:
            high_m = threshold - ytd_total
            low_m = miles - high_m

        amount = (high_m * high_rate + low_m * low_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        crosses_threshold = ytd_total < threshold and ytd_total + miles > threshold
        return {
            "reimbursement_amount": str(amount),
            "currency": "GBP",
            "miles_at_high_rate": str(high_m),
            "miles_at_low_rate": str(low_m),
            "ytd_miles_before": str(ytd_total),
            "ytd_miles_after": str(ytd_total + miles),
            "threshold": str(threshold),
            "crosses_threshold": crosses_threshold,
            "is_taxable_excess": crosses_threshold,
        }

    elif jurisdiction == MileageTrip.Jurisdiction.US:
        rate = Decimal(str(policy.rate_per_mile_usd))
        amount = (miles * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return {
            "reimbursement_amount": str(amount),
            "currency": "USD",
            "miles_at_high_rate": str(miles),
            "miles_at_low_rate": "0",
            "rate_applied": str(rate),
            "crosses_threshold": False,
            "is_taxable_excess": False,
        }

    else:  # India
        rate = Decimal(str(policy.rate_per_km_inr))
        km = Decimal(str(distance_km))
        amount = (km * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return {
            "reimbursement_amount": str(amount),
            "currency": "INR",
            "miles_at_high_rate": str(miles),
            "miles_at_low_rate": "0",
            "rate_applied": str(rate),
            "crosses_threshold": False,
            "is_taxable_excess": False,
        }


def create_trip_from_task_sequence(employee_id: int, task_ids: list, company_id: int) -> list:
    """
    Auto-create MileageTrip records for each consecutive task-to-task leg.
    Tasks are sorted by their scheduled_start. Requires tasks to have lat/lng.
    Returns list of created trip PKs.
    """
    from .models import MileageTrip
    from tasks.models import Task
    from employees.models import Employee

    employee = Employee.objects.get(pk=employee_id, company_id=company_id)
    tasks = list(
        Task.objects.filter(pk__in=task_ids, company_id=company_id)
        .order_by("scheduled_start")
    )

    created = []
    for i in range(len(tasks) - 1):
        t_from, t_to = tasks[i], tasks[i + 1]
        # Use job-site lat/lng if available
        from_lat = getattr(t_from, "latitude", None) or getattr(t_from, "from_lat", None)
        from_lng = getattr(t_from, "longitude", None) or getattr(t_from, "from_lng", None)
        to_lat = getattr(t_to, "latitude", None) or getattr(t_to, "to_lat", None)
        to_lng = getattr(t_to, "longitude", None) or getattr(t_to, "to_lng", None)

        if None in (from_lat, from_lng, to_lat, to_lng):
            continue  # Skip legs without coordinates

        km = _haversine_km(from_lat, from_lng, to_lat, to_lng)
        miles = _km_to_miles(km)

        trip = MileageTrip.objects.create(
            company_id=company_id,
            employee=employee,
            trip_date=t_from.scheduled_start.date() if t_from.scheduled_start else date.today(),
            from_lat=from_lat, from_lng=from_lng,
            to_lat=to_lat, to_lng=to_lng,
            from_location_name=getattr(t_from, "location_name", "") or str(t_from),
            to_location_name=getattr(t_to, "location_name", "") or str(t_to),
            distance_km=km,
            distance_miles=miles,
            purpose=MileageTrip.Purpose.TASK_TRAVEL,
            linked_task=t_to,
            jurisdiction=employee.country or MileageTrip.Jurisdiction.US,
            employee_notes=f"Auto-created from task sequence: #{t_from.pk} → #{t_to.pk}",
        )
        calculate_trip_reimbursement(trip.pk, company_id)
        created.append(trip.pk)

    return created


def create_trip_from_transfer(transfer_id: int, company_id: int, employee_id: int) -> Optional[int]:
    """
    Auto-create a MileageTrip linked to an InventoryTransfer.
    Returns the created trip PK or None if coordinates are missing.
    """
    from .models import MileageTrip
    from inventory.models import InventoryTransfer
    from employees.models import Employee

    try:
        transfer = InventoryTransfer.objects.select_related(
            "from_location", "to_location"
        ).get(pk=transfer_id)
    except InventoryTransfer.DoesNotExist:
        return None

    employee = Employee.objects.get(pk=employee_id, company_id=company_id)

    from_loc = transfer.from_location
    to_loc = transfer.to_location

    from_lat = getattr(from_loc, "latitude", None)
    from_lng = getattr(from_loc, "longitude", None)
    to_lat = getattr(to_loc, "latitude", None)
    to_lng = getattr(to_loc, "longitude", None)

    if None in (from_lat, from_lng, to_lat, to_lng):
        return None

    km = _haversine_km(from_lat, from_lng, to_lat, to_lng)
    miles = _km_to_miles(km)

    trip = MileageTrip.objects.create(
        company_id=company_id,
        employee=employee,
        trip_date=transfer.requested_at.date() if transfer.requested_at else date.today(),
        from_lat=from_lat, from_lng=from_lng,
        to_lat=to_lat, to_lng=to_lng,
        from_location_name=from_loc.name,
        to_location_name=to_loc.name,
        distance_km=km,
        distance_miles=miles,
        purpose=MileageTrip.Purpose.TOOL_COLLECTION,
        linked_transfer=transfer,
        jurisdiction=employee.country or MileageTrip.Jurisdiction.US,
        employee_notes=f"Auto-created from inventory transfer #{transfer.pk}",
    )
    calculate_trip_reimbursement(trip.pk, company_id)
    return trip.pk


def create_travel_timelog(trip_id: int, company_id: int) -> Optional[int]:
    """
    Create a TimeLog record for the travel duration of a trip (FLSA/WTR work time).
    Estimates speed at 50 km/h average. Returns TimeLog PK or None.
    """
    from .models import MileageTrip
    try:
        from time_tracking.models import TimeLog
    except ImportError:
        return None

    trip = MileageTrip.objects.select_related("employee", "company").get(
        pk=trip_id, company_id=company_id
    )

    km = float(trip.distance_km)
    if km <= 0:
        return None

    avg_speed_kmh = 50.0
    duration_hours = km / avg_speed_kmh
    duration_seconds = int(duration_hours * 3600)

    from django.utils import timezone as tz
    start_dt = tz.make_aware(
        tz.datetime(trip.trip_date.year, trip.trip_date.month, trip.trip_date.day, 9, 0, 0)
    )
    end_dt = start_dt + timedelta(seconds=duration_seconds)

    try:
        timelog = TimeLog.objects.create(
            employee=trip.employee,
            company=trip.company,
            clock_in=start_dt,
            clock_out=end_dt,
            duration_seconds=duration_seconds,
            notes=f"Travel time for mileage trip #{trip.pk}: {trip.from_location_name} → {trip.to_location_name}",
        )
        trip.linked_timelog = timelog
        trip.save(update_fields=["linked_timelog", "updated_at"])
        return timelog.pk
    except Exception:
        return None


def get_ytd_miles(employee_id: int, company_id: int, jurisdiction: str) -> dict:
    """
    Return YTD mileage summary for an employee respecting UK tax year basis.
    """
    from .models import MileageYTDTracker, MileageTrip, MileagePolicy
    from employees.models import Employee

    employee = Employee.objects.get(pk=employee_id, company_id=company_id)
    policy = _get_or_create_policy(employee.company)

    if jurisdiction == MileageTrip.Jurisdiction.UK:
        today = date.today()
        tax_year = _uk_tax_year_label(
            today, policy.uk_tax_year_start_month, policy.uk_tax_year_start_day
        )
    else:
        tax_year = str(date.today().year)

    tracker = MileageYTDTracker.objects.filter(
        company_id=company_id, employee_id=employee_id,
        jurisdiction=jurisdiction, tax_year=tax_year,
    ).first()

    threshold = float(policy.uk_mileage_threshold) if jurisdiction == MileageTrip.Jurisdiction.UK else None

    return {
        "employee_id": employee_id,
        "jurisdiction": jurisdiction,
        "tax_year": tax_year,
        "total_miles": float(tracker.total_miles) if tracker else 0,
        "miles_at_high_rate": float(tracker.miles_at_high_rate) if tracker else 0,
        "miles_at_low_rate": float(tracker.miles_at_low_rate) if tracker else 0,
        "total_reimbursed_gbp": float(tracker.total_reimbursed_gbp) if tracker else 0,
        "threshold": threshold,
        "threshold_crossed_date": tracker.threshold_crossed_date.isoformat() if tracker and tracker.threshold_crossed_date else None,
        "miles_remaining_at_high_rate": max(0, threshold - float(tracker.total_miles)) if threshold and tracker else threshold,
    }


def inject_mileage_into_payroll(
    payroll_record_id: int, company_id: int, period_start: date, period_end: date
) -> dict:
    """
    Find all approved, unpaid mileage trips in the period and patch the PayrollRecord
    with a mileage reimbursement line. Returns summary dict.
    """
    from .models import MileageTrip
    try:
        from payroll.models import PayrollRecord
    except ImportError:
        return {"error": "payroll app not available"}

    try:
        payroll = PayrollRecord.objects.get(pk=payroll_record_id, company_id=company_id)
    except PayrollRecord.DoesNotExist:
        return {"error": "PayrollRecord not found"}

    trips = MileageTrip.objects.filter(
        company_id=company_id,
        employee=payroll.employee,
        approval_status=MileageTrip.ApprovalStatus.APPROVED,
        linked_payroll_record__isnull=True,
        trip_date__gte=period_start,
        trip_date__lte=period_end,
    )

    total_usd = sum(float(t.reimbursement_amount) for t in trips if t.currency == "USD")
    total_gbp = sum(float(t.reimbursement_amount) for t in trips if t.currency == "GBP")
    total_inr = sum(float(t.reimbursement_amount) for t in trips if t.currency == "INR")
    trip_count = trips.count()

    if trip_count == 0:
        return {"injected": 0, "total": 0}

    # Patch payroll record (store in JSON extras field if it exists)
    if hasattr(payroll, "extras") and isinstance(payroll.extras, dict):
        payroll.extras["mileage_reimbursement_usd"] = total_usd
        payroll.extras["mileage_reimbursement_gbp"] = total_gbp
        payroll.extras["mileage_reimbursement_inr"] = total_inr
        payroll.extras["mileage_trip_count"] = trip_count
        payroll.save(update_fields=["extras", "updated_at"] if hasattr(payroll, "updated_at") else ["extras"])

    # Mark trips as linked + paid
    trips.update(
        linked_payroll_record=payroll,
        approval_status=MileageTrip.ApprovalStatus.PAID,
    )

    return {
        "injected": trip_count,
        "total_usd": total_usd,
        "total_gbp": total_gbp,
        "total_inr": total_inr,
        "payroll_record_id": payroll_record_id,
    }
