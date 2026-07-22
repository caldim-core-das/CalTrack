"""
companies/utils.py — Multi-region compliance data for QuickTIMS.
US FLSA (all 50 states) + UK WTR/PAYE/NI.
"""
from decimal import Decimal

# ---------------------------------------------------------------------------
# US State Minimum Wages (2024-2025, USD/hr)
# ---------------------------------------------------------------------------
US_STATE_MINIMUM_WAGES = {
    "AL": 7.25,  "AK": 11.73, "AZ": 14.35, "AR": 11.00, "CA": 16.50,
    "CO": 14.42, "CT": 15.69, "DE": 13.25, "FL": 13.00, "GA": 7.25,
    "HI": 14.00, "ID": 7.25,  "IL": 14.00, "IN": 7.25,  "IA": 7.25,
    "KS": 7.25,  "KY": 7.25,  "LA": 7.25,  "ME": 14.15, "MD": 15.00,
    "MA": 15.00, "MI": 10.33, "MN": 10.85, "MS": 7.25,  "MO": 12.30,
    "MT": 10.30, "NE": 12.00, "NV": 12.00, "NH": 7.25,  "NJ": 15.49,
    "NM": 12.00, "NY": 16.00, "NC": 7.25,  "ND": 7.25,  "OH": 10.45,
    "OK": 7.25,  "OR": 14.70, "PA": 7.25,  "RI": 14.00, "SC": 7.25,
    "SD": 11.20, "TN": 7.25,  "TX": 7.25,  "UT": 7.25,  "VT": 13.67,
    "VA": 12.41, "WA": 16.28, "WV": 8.75,  "WI": 7.25,  "WY": 7.25,
    "DC": 17.50,
}
US_FEDERAL_MINIMUM_WAGE = 7.25

# ---------------------------------------------------------------------------
# US State Break Laws
# ---------------------------------------------------------------------------
US_STATE_BREAK_LAWS = {
    "CA": {
        "rest_break_minutes": 10, "rest_break_per_hours": 4,
        "meal_break_minutes": 30, "meal_break_threshold_hours": 5,
        "second_meal_threshold_hours": 10, "paid_rest_breaks": True,
    },
    "NY": {
        "meal_break_minutes": 30, "meal_break_threshold_hours": 6,
        "rest_break_minutes": None, "rest_break_per_hours": None,
        "paid_rest_breaks": False,
    },
    "WA": {
        "rest_break_minutes": 10, "rest_break_per_hours": 4,
        "meal_break_minutes": 30, "meal_break_threshold_hours": 5,
        "second_meal_threshold_hours": None, "paid_rest_breaks": True,
    },
    "CO": {
        "rest_break_minutes": 10, "rest_break_per_hours": 4,
        "meal_break_minutes": 30, "meal_break_threshold_hours": 5,
        "second_meal_threshold_hours": None, "paid_rest_breaks": True,
    },
    "OR": {
        "rest_break_minutes": 10, "rest_break_per_hours": 4,
        "meal_break_minutes": 30, "meal_break_threshold_hours": 6,
        "second_meal_threshold_hours": None, "paid_rest_breaks": True,
    },
    "DEFAULT": {
        "meal_break_minutes": None, "meal_break_threshold_hours": None,
        "rest_break_minutes": None, "rest_break_per_hours": None,
        "paid_rest_breaks": False,
    },
}

# ---------------------------------------------------------------------------
# UK National Minimum / Living Wage (2024-2025, GBP/hr)
# ---------------------------------------------------------------------------
UK_NMW_RATES = {
    "21+": 11.44,
    "18-20": 8.60,
    "16-17": 6.40,
    "apprentice": 6.40,
}

# ---------------------------------------------------------------------------
# UK Income Tax Bands 2024/25 (GBP annual)
# ---------------------------------------------------------------------------
UK_TAX_BANDS = [
    {"name": "Personal Allowance", "from": 0,      "to": 12570,  "rate": 0.00},
    {"name": "Basic Rate",         "from": 12570,  "to": 50270,  "rate": 0.20},
    {"name": "Higher Rate",        "from": 50270,  "to": 125140, "rate": 0.40},
    {"name": "Additional Rate",    "from": 125140, "to": None,   "rate": 0.45},
]

# ---------------------------------------------------------------------------
# UK National Insurance 2024/25
# ---------------------------------------------------------------------------
UK_NI = {
    "primary_threshold_annual": 12570,
    "upper_earnings_limit_annual": 50270,
    "secondary_threshold_annual": 9100,
    "employee_rate_lower": Decimal("0.08"),
    "employee_rate_upper": Decimal("0.02"),
    "employer_rate": Decimal("0.138"),
}

UK_NI_CATEGORIES = {
    "A": "Standard (most employees)",
    "B": "Married women / widows (reduced rate)",
    "C": "Over State Pension Age",
    "H": "Apprentice under 25",
    "J": "Deferred (another job)",
    "M": "Under 21",
    "Z": "Under 21, deferred",
}

# ---------------------------------------------------------------------------
# UK Working Time Regulations 1998
# ---------------------------------------------------------------------------
UK_WTR = {
    "max_weekly_hours": 48,
    "reference_period_weeks": 17,
    "min_rest_between_shifts_hours": 11,
    "min_weekly_rest_hours": 24,
    "break_threshold_hours": 6,
    "break_minutes": 20,
    "reg13_weeks": 4,
    "reg13a_weeks": 1.6,
    "total_holiday_weeks": 5.6,
    "holiday_accrual_rate": Decimal("0.1207"),
    "max_carry_over_days": 8,
}

# FLSA exempt salary threshold (US 2024)
FLSA_EXEMPT_SALARY_THRESHOLD_WEEKLY = Decimal("844.00")

# FLSA duties test categories
FLSA_DUTIES_TEST_CATEGORIES = [
    "executive", "administrative", "professional", "outside_sales", "computer",
]


# ---------------------------------------------------------------------------
# Region Resolution
# ---------------------------------------------------------------------------

def resolve_region(employee, company):
    """Employee-level country/state takes precedence over company defaults."""
    country = (
        getattr(employee, "country", None) or
        getattr(company, "primary_country", None) or
        "US"
    )
    state = (
        getattr(employee, "state", None) or
        getattr(company, "default_state", None)
    )
    return {"country": country, "state": state}


# ---------------------------------------------------------------------------
# Compliance Rule Resolution
# ---------------------------------------------------------------------------

def get_compliance_rules(region):
    """Full compliance rule set for US FLSA or UK WTR."""
    country = (region.get("country") or "US").upper()
    state = (region.get("state") or "").upper()

    if country == "US":
        min_wage = US_STATE_MINIMUM_WAGES.get(state, US_FEDERAL_MINIMUM_WAGE)
        break_law = US_STATE_BREAK_LAWS.get(state, US_STATE_BREAK_LAWS["DEFAULT"])

        daily_ot_threshold = None
        daily_ot_multiplier = None
        double_time_threshold = None

        if state == "CA":
            daily_ot_threshold = Decimal("8")
            daily_ot_multiplier = Decimal("1.5")
            double_time_threshold = Decimal("12")
        elif state == "AK":
            daily_ot_threshold = Decimal("8")
            daily_ot_multiplier = Decimal("1.5")

        return {
            "name": "US FLSA ({})".format(state if state else "Federal"),
            "country": "US",
            "state": state,
            "overtime_threshold": Decimal("40"),
            "overtime_multiplier": Decimal("1.5"),
            "daily_ot_threshold": daily_ot_threshold,
            "daily_ot_multiplier": daily_ot_multiplier,
            "double_time_threshold": double_time_threshold,
            "double_time_multiplier": Decimal("2.0"),
            "exempt_salary_threshold_weekly": FLSA_EXEMPT_SALARY_THRESHOLD_WEEKLY,
            "minimum_wage": Decimal(str(min_wage)),
            "break_law": break_law,
            "wtr": None,
            "tax_bands": None,
            "ni": None,
        }

    elif country == "UK":
        return {
            "name": "UK WTR / PAYE",
            "country": "UK",
            "state": None,
            "overtime_threshold": Decimal("37.5"),
            "overtime_multiplier": Decimal("1.0"),
            "daily_ot_threshold": None,
            "daily_ot_multiplier": None,
            "double_time_threshold": None,
            "double_time_multiplier": None,
            "exempt_salary_threshold_weekly": None,
            "minimum_wage": None,
            "minimum_wage_by_age": UK_NMW_RATES,
            "wtr": UK_WTR,
            "tax_bands": UK_TAX_BANDS,
            "ni": UK_NI,
            "ni_categories": UK_NI_CATEGORIES,
            "break_law": {
                "break_threshold_hours": UK_WTR["break_threshold_hours"],
                "break_minutes": UK_WTR["break_minutes"],
                "rest_between_shifts_hours": UK_WTR["min_rest_between_shifts_hours"],
                "meal_break_minutes": None,
                "meal_break_threshold_hours": None,
                "rest_break_minutes": 20,
                "rest_break_per_hours": 6,
                "paid_rest_breaks": False,
            },
        }

    elif country == "IN":
        return {
            "name": "India Compliance / EPF ({})".format(state if state else "Federal"),
            "country": "IN",
            "state": state,
            "overtime_threshold": Decimal("48"),
            "overtime_multiplier": Decimal("2.0"),
            "daily_ot_threshold": Decimal("9"),
            "daily_ot_multiplier": Decimal("2.0"),
            "double_time_threshold": None,
            "double_time_multiplier": None,
            "minimum_wage": Decimal("150.00"),
            "break_law": {
                "break_threshold_hours": 5,
                "break_minutes": 30,
                "rest_between_shifts_hours": 11,
                "meal_break_minutes": 30,
                "meal_break_threshold_hours": 5,
                "rest_break_minutes": 15,
                "rest_break_per_hours": 4,
                "paid_rest_breaks": False,
            },
            "wtr": None,
            "tax_bands": None,
            "ni": None,
        }

    return {
        "name": "Default",
        "country": country,
        "state": state,
        "overtime_threshold": Decimal("40"),
        "overtime_multiplier": Decimal("1.5"),
        "daily_ot_threshold": None,
        "daily_ot_multiplier": None,
        "double_time_threshold": None,
        "double_time_multiplier": None,
        "minimum_wage": Decimal("7.25"),
        "break_law": US_STATE_BREAK_LAWS["DEFAULT"],
        "wtr": None,
        "tax_bands": None,
        "ni": None,
    }


# ---------------------------------------------------------------------------
# UK PAYE Calculations
# ---------------------------------------------------------------------------

def calculate_uk_income_tax_annual(gross_annual):
    """UK income tax on gross annual salary (GBP)."""
    gross = Decimal(str(gross_annual))
    tax = Decimal("0")
    for band in UK_TAX_BANDS:
        low = Decimal(str(band["from"]))
        high = Decimal(str(band["to"])) if band["to"] is not None else gross
        rate = Decimal(str(band["rate"]))
        if gross <= low:
            break
        taxable = min(gross, high) - low
        if taxable > 0:
            tax += taxable * rate
    effective = (tax / gross * 100).quantize(Decimal("0.01")) if gross > 0 else Decimal("0")
    return {
        "gross_annual": float(gross),
        "income_tax_annual": float(tax.quantize(Decimal("0.01"))),
        "effective_rate_pct": float(effective),
    }


def calculate_uk_ni_annual(gross_annual, ni_category="A"):
    """UK NI contributions (employee + employer) for gross annual (GBP)."""
    gross = Decimal(str(gross_annual))
    ni = UK_NI
    pt  = Decimal(str(ni["primary_threshold_annual"]))
    uel = Decimal(str(ni["upper_earnings_limit_annual"]))
    st  = Decimal(str(ni["secondary_threshold_annual"]))
    employee_ni = Decimal("0")
    if ni_category == "C":
        employee_ni = Decimal("0")
    elif ni_category == "B":
        if gross > pt:
            employee_ni += max(Decimal("0"), min(gross, uel) - pt) * Decimal("0.0585")
        if gross > uel:
            employee_ni += (gross - uel) * ni["employee_rate_upper"]
    else:
        if gross > pt:
            employee_ni += max(Decimal("0"), min(gross, uel) - pt) * ni["employee_rate_lower"]
        if gross > uel:
            employee_ni += (gross - uel) * ni["employee_rate_upper"]
    employer_ni = Decimal("0")
    if gross > st:
        employer_ni = (gross - st) * ni["employer_rate"]
    return {
        "gross_annual": float(gross),
        "employee_ni_annual": float(employee_ni.quantize(Decimal("0.01"))),
        "employer_ni_annual": float(employer_ni.quantize(Decimal("0.01"))),
        "ni_category": ni_category,
    }


# ---------------------------------------------------------------------------
# UK Holiday Accrual (WTR Reg 13 + 13A)
# ---------------------------------------------------------------------------

def calculate_uk_holiday_accrual(hours_worked, existing_reg13=Decimal("0"), existing_reg13a=Decimal("0")):
    """Accrue 12.07% of hours worked, split into Reg 13 (4wk) and Reg 13A (1.6wk) pots."""
    hours = Decimal(str(hours_worked))
    total_accrued = hours * UK_WTR["holiday_accrual_rate"]
    reg13_accrued  = (total_accrued * Decimal("4")   / Decimal("5.6")).quantize(Decimal("0.01"))
    reg13a_accrued = (total_accrued * Decimal("1.6") / Decimal("5.6")).quantize(Decimal("0.01"))
    return {
        "reg13_hours":  float((Decimal(str(existing_reg13))  + reg13_accrued).quantize(Decimal("0.01"))),
        "reg13a_hours": float((Decimal(str(existing_reg13a)) + reg13a_accrued).quantize(Decimal("0.01"))),
        "accrued_this_period_hours": float(total_accrued.quantize(Decimal("0.01"))),
    }


# ---------------------------------------------------------------------------
# UK NMW Age Band Lookup
# ---------------------------------------------------------------------------

def get_uk_nmw_for_age(age):
    if age is None or age >= 21:
        return UK_NMW_RATES["21+"]
    elif age >= 18:
        return UK_NMW_RATES["18-20"]
    return UK_NMW_RATES["16-17"]


# ---------------------------------------------------------------------------
# Wage Floor Check
# ---------------------------------------------------------------------------

def check_wage_floor(hourly_rate, region, age=None):
    """Returns is_compliant, floor, shortfall for the employee\'s region."""
    rate    = Decimal(str(hourly_rate))
    country = (region.get("country") or "US").upper()
    state   = (region.get("state") or "").upper()
    if country == "UK":
        floor = Decimal(str(get_uk_nmw_for_age(age)))
    elif country == "IN":
        floor = Decimal("150.00")
    else:
        floor = Decimal(str(US_STATE_MINIMUM_WAGES.get(state, US_FEDERAL_MINIMUM_WAGE)))
    shortfall = max(Decimal("0"), floor - rate)
    return {
        "is_compliant": rate >= floor,
        "minimum_wage_floor": float(floor),
        "employee_rate": float(rate),
        "shortfall_per_hour": float(shortfall),
        "country": country,
        "age": age,
    }


# ---------------------------------------------------------------------------
# UK 48-Hour Rolling Average (WTR)
# ---------------------------------------------------------------------------

def calculate_uk_48hr_average(weekly_hours_list):
    """17-week rolling average; returns average, compliance, headroom."""
    window = list(weekly_hours_list[-UK_WTR["reference_period_weeks"]:])
    if not window:
        return {"average_hours": 0.0, "is_compliant": True, "weeks_in_window": 0, "limit": 48}
    avg   = sum(window) / len(window)
    limit = UK_WTR["max_weekly_hours"]
    return {
        "average_hours":  round(avg, 2),
        "is_compliant":   avg <= limit,
        "weeks_in_window": len(window),
        "limit":          limit,
        "headroom_hours": round(max(0, limit - avg), 2),
    }


# ---------------------------------------------------------------------------
# Payroll Config Resolution — Individual > Group > None
# ---------------------------------------------------------------------------

def get_employee_payroll_config(employee):
    """
    Resolves the effective payroll config for an employee.
    Priority chain:
      1. Individual EmployeePayrollConfig (employee-specific override)
      2. Group EmployeePayrollConfig (from employee's payroll_group)
      3. None (caller uses region defaults)

    Returns: EmployeePayrollConfig instance or None
    """
    from payroll.models import EmployeePayrollConfig

    # 1. Check individual config
    try:
        config = EmployeePayrollConfig.objects.get(employee=employee)
        config._source = "individual"
        return config
    except EmployeePayrollConfig.DoesNotExist:
        pass

    # 2. Check group config
    group = getattr(employee, "payroll_group", None)
    if group:
        try:
            config = EmployeePayrollConfig.objects.get(group=group)
            config._source = "group"
            return config
        except EmployeePayrollConfig.DoesNotExist:
            pass

    return None


# ---------------------------------------------------------------------------
# India Service Payout Engine
# ---------------------------------------------------------------------------

def calc_india_service_payout(total_service_revenue, config=None):
    """
    Calculate India employee payout from service revenue.

    Args:
        total_service_revenue: Total ₹ from completed service bookings in period
        config: EmployeePayrollConfig instance (or None for defaults)

    Returns dict with full breakdown:
        service_revenue, employee_gross, company_share, platform_fee,
        pf_deduction, esi_deduction, tds_deduction,
        total_deductions, net_pay, breakdown_lines[]
    """
    revenue = Decimal(str(total_service_revenue))

    # Use config values or defaults
    emp_pct      = Decimal(str(config.employee_share_pct if config else 80))
    co_pct       = Decimal(str(config.company_share_pct  if config else 10))
    plat_type    = getattr(config, "platform_fee_type", "percentage") if config else "percentage"
    plat_val     = Decimal(str(config.platform_fee_value if config else 5))
    pf_enabled   = config.pf_enabled   if config else True
    pf_pct       = Decimal(str(config.pf_pct   if config else 12))
    esi_enabled  = config.esi_enabled  if config else True
    esi_pct      = Decimal(str(config.esi_pct  if config else Decimal("0.75")))
    tds_enabled  = config.tds_enabled  if config else False
    tds_rate     = Decimal(str(config.tds_rate if config else 10))

    # ── Revenue split ──────────────────────────────────────────────────────
    employee_gross = (revenue * emp_pct / Decimal("100")).quantize(Decimal("0.01"))
    company_share  = (revenue * co_pct  / Decimal("100")).quantize(Decimal("0.01"))

    if plat_type == "fixed":
        platform_fee = plat_val.quantize(Decimal("0.01"))
    else:
        platform_fee = (revenue * plat_val / Decimal("100")).quantize(Decimal("0.01"))

    # ── Statutory deductions from employee_gross ───────────────────────────
    pf_deduction  = (employee_gross * pf_pct  / Decimal("100")).quantize(Decimal("0.01")) if pf_enabled  else Decimal("0")
    esi_deduction = (employee_gross * esi_pct / Decimal("100")).quantize(Decimal("0.01")) if esi_enabled else Decimal("0")
    tds_deduction = (employee_gross * tds_rate / Decimal("100")).quantize(Decimal("0.01")) if tds_enabled else Decimal("0")

    # ── Custom deductions/bonuses ──────────────────────────────────────────
    custom_deduction_total = Decimal("0")
    custom_bonus_total     = Decimal("0")
    custom_lines = []

    if config:
        for item in (config.custom_deductions or []):
            if not item.get("enabled", True):
                continue
            val = Decimal(str(item.get("value", 0)))
            if item.get("type") == "percentage":
                val = (employee_gross * val / Decimal("100")).quantize(Decimal("0.01"))
            custom_deduction_total += val
            custom_lines.append({"label": item.get("name", "Deduction"), "amount": float(val), "type": "deduction"})

        for item in (config.custom_bonuses or []):
            if not item.get("enabled", True):
                continue
            val = Decimal(str(item.get("value", 0)))
            if item.get("type") == "percentage":
                val = (employee_gross * val / Decimal("100")).quantize(Decimal("0.01"))
            custom_bonus_total += val
            custom_lines.append({"label": item.get("name", "Bonus"), "amount": float(val), "type": "bonus"})

    total_deductions = (pf_deduction + esi_deduction + tds_deduction + custom_deduction_total).quantize(Decimal("0.01"))
    net_pay = (employee_gross - total_deductions + custom_bonus_total).quantize(Decimal("0.01"))

    breakdown_lines = [
        {"label": "Service Revenue (Total)", "amount": float(revenue), "type": "revenue"},
        {"label": f"Employee Share ({emp_pct}%)", "amount": float(employee_gross), "type": "earning"},
        {"label": f"Company Share ({co_pct}%)",  "amount": float(company_share),   "type": "company"},
        {"label": f"Platform Fee ({'fixed ₹' if plat_type == 'fixed' else str(plat_val) + '%'})",
         "amount": float(platform_fee), "type": "platform"},
    ]
    if pf_enabled:
        breakdown_lines.append({"label": f"PF Deduction ({pf_pct}%)", "amount": float(pf_deduction), "type": "deduction"})
    if esi_enabled:
        breakdown_lines.append({"label": f"ESI Deduction ({esi_pct}%)", "amount": float(esi_deduction), "type": "deduction"})
    if tds_enabled:
        breakdown_lines.append({"label": f"TDS ({tds_rate}%)", "amount": float(tds_deduction), "type": "deduction"})
    breakdown_lines.extend(custom_lines)
    breakdown_lines.append({"label": "Net Pay", "amount": float(net_pay), "type": "net"})

    return {
        "service_revenue":       float(revenue),
        "employee_gross":        float(employee_gross),
        "company_share":         float(company_share),
        "platform_fee":          float(platform_fee),
        "pf_deduction":          float(pf_deduction),
        "esi_deduction":         float(esi_deduction),
        "tds_deduction":         float(tds_deduction),
        "custom_deductions":     float(custom_deduction_total),
        "custom_bonuses":        float(custom_bonus_total),
        "total_deductions":      float(total_deductions),
        "net_pay":               float(net_pay),
        "breakdown":             breakdown_lines,
        "config_source":         getattr(config, "_source", "default") if config else "default",
    }
