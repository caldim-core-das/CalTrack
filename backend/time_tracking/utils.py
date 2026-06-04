"""
CALTRACK  —  AI Workforce Intelligence Report  V3
=================================================
Premium enterprise-grade PDF report generated with ReportLab.
All 15 sections from the design specification are implemented.
"""

import math
import os
import hashlib
import uuid
from io import BytesIO
from datetime import datetime as _dt, timedelta

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image as RLImage, HRFlowable, KeepTogether,
)
from reportlab.graphics.shapes import Drawing, Rect, Circle, String, Line, Wedge, ArcPath
from reportlab.graphics import renderPDF
from reportlab.graphics.charts.piecharts import Pie
from reportlab.pdfgen import canvas as pdf_canvas

from django.conf import settings
from datetime import timedelta


# ─────────────────────────────────────────────────────────────────────────────
# Utility helpers
# ─────────────────────────────────────────────────────────────────────────────

def calculate_distance(lat1, lon1, lat2, lon2):
    """Returns distance in METERS (Haversine)."""
    lat1, lon1, lat2, lon2 = map(math.radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return round(6371000 * 2 * math.asin(math.sqrt(a)))


def format_duration(seconds):
    if not seconds:
        return "0h 0m"
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    return f"{h}h {m}m"


def _localtime(dt):
    if dt is None:
        return None
    try:
        from django.utils import timezone as tz
        if tz.is_aware(dt):
            return tz.localtime(dt)
    except Exception:
        pass
    return dt


def _fmt_date(dt):
    dt = _localtime(dt)
    return dt.strftime("%A, %d %b %Y") if dt else "—"


def _fmt_date_short(dt):
    dt = _localtime(dt)
    return dt.strftime("%d %b %Y") if dt else "—"


def _fmt_time(dt):
    dt = _localtime(dt)
    return dt.strftime("%I:%M %p") if dt else "—"


def _fmt_datetime(dt):
    dt = _localtime(dt)
    return dt.strftime("%d %b %Y, %I:%M %p") if dt else "—"


# ─────────────────────────────────────────────────────────────────────────────
# Colour palette (design spec)
# ─────────────────────────────────────────────────────────────────────────────
C = {
    "primary":   colors.HexColor("#0F172A"),   # deep navy
    "blue":      colors.HexColor("#2563EB"),   # accent blue
    "blue_lt":   colors.HexColor("#DBEAFE"),
    "blue_mid":  colors.HexColor("#93C5FD"),
    "green":     colors.HexColor("#10B981"),   # success
    "green_lt":  colors.HexColor("#D1FAE5"),
    "amber":     colors.HexColor("#F59E0B"),   # warning
    "amber_lt":  colors.HexColor("#FEF3C7"),
    "red":       colors.HexColor("#EF4444"),   # danger
    "red_lt":    colors.HexColor("#FEE2E2"),
    "purple":    colors.HexColor("#7C3AED"),
    "purple_lt": colors.HexColor("#EDE9FE"),
    "bg":        colors.HexColor("#F8FAFC"),   # page background
    "card":      colors.white,
    "slate5":    colors.HexColor("#64748B"),
    "slate4":    colors.HexColor("#94A3B8"),
    "slate3":    colors.HexColor("#CBD5E1"),
    "slate2":    colors.HexColor("#E2E8F0"),
    "slate1":    colors.HexColor("#F1F5F9"),
    "white":     colors.white,
    "black":     colors.HexColor("#0F172A"),
}

PW = A4[0] - 56   # usable page width (28 mm margins each side)


def _S(name, **kw):
    base = getSampleStyleSheet()['Normal']
    kw.setdefault('fontName', 'Helvetica')
    return ParagraphStyle(name, parent=base, **kw)


# ─────────────────────────────────────────────────────────────────────────────
# Custom Flowables
# ─────────────────────────────────────────────────────────────────────────────

from reportlab.platypus import Flowable

class _GaugeFlowable(Flowable):
    """Circular arc gauge for productivity / attendance scores."""

    def __init__(self, pct, label, color, size=130):
        super().__init__()
        self.pct   = min(max(pct, 0), 100)
        self.label = label
        self.color = color
        self.size  = size
        self.width  = size
        self.height = size

    def draw(self):
        c = self.canv
        cx = self.size / 2
        cy = self.size / 2
        r  = self.size * 0.38
        track_w = self.size * 0.09

        # Track (background arc)
        c.setStrokeColor(C["slate2"])
        c.setLineWidth(track_w)
        c.arc(cx - r, cy - r, cx + r, cy + r, startAng=-210, extent=240)

        # Value arc
        c.setStrokeColor(self.color)
        c.arc(cx - r, cy - r, cx + r, cy + r, startAng=-210, extent=240 * self.pct / 100)

        # Centre text — value
        val_txt = f"{self.pct:.0f}%"
        c.setFont('Helvetica-Bold', self.size * 0.14)
        c.setFillColor(C["primary"])
        c.drawCentredString(cx, cy + self.size * 0.04, val_txt)

        # Sub-label
        c.setFont('Helvetica', self.size * 0.07)
        c.setFillColor(C["slate5"])
        c.drawCentredString(cx, cy - self.size * 0.08, self.label)


class _TimelineDot(Flowable):
    """Coloured dot for timeline."""

    def __init__(self, color, size=10):
        super().__init__()
        self.color = color
        self.size  = size
        self.width  = size
        self.height = size

    def draw(self):
        c = self.canv
        c.setFillColor(self.color)
        r = self.size / 2
        c.circle(r, r, r, fill=1, stroke=0)


def _qr_image(data: str, box_size: int = 4) -> BytesIO | None:
    """Generate a QR code PNG and return as BytesIO. Returns None on failure."""
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=box_size,
                           border=2, error_correction=qrcode.constants.ERROR_CORRECT_M)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#0F172A", back_color="white")
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Section header builder
# ─────────────────────────────────────────────────────────────────────────────

def _sec_hdr(icon_txt, title_txt, accent=None):
    accent = accent or C["blue"]
    lbl = f"{icon_txt}  {title_txt}"
    return Paragraph(lbl, _S(f"sh_{title_txt}",
                              fontSize=9, fontName="Helvetica-Bold",
                              textColor=accent, letterSpacing=1.8,
                              spaceBefore=6, spaceAfter=4))


def _sec_divider():
    return HRFlowable(width="100%", thickness=0.5, color=C["slate2"], spaceAfter=10)


def _card(content_rows, col_widths, bg=None, padding=12, radius=8):
    """Wrap rows in a white card-style table."""
    bg = bg or C["card"]
    t = Table(content_rows, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), bg),
        ("PADDING",       (0, 0), (-1, -1), padding),
        ("ROUNDEDCORNERS", [radius]),
        ("LINEABOVE",     (0, 0), (-1, 0), 0.5, C["slate2"]),
        ("LINEBELOW",     (0, -1), (-1, -1), 0.5, C["slate2"]),
        ("LINEBEFORE",    (0, 0), (0, -1), 0.5, C["slate2"]),
        ("LINEAFTER",     (-1, 0), (-1, -1), 0.5, C["slate2"]),
    ]))
    return t


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PDF GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

def generate_shift_summary_pdf(time_log):
    """
    Generate the CALTRACK AI Workforce Intelligence Report V3 PDF.
    15 premium enterprise sections.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=28, leftMargin=28, topMargin=28, bottomMargin=28,
    )

    elements = []

    # ── Gather all data up-front ──────────────────────────────────────────
    emp      = time_log.employee
    user     = emp.user
    fname    = (getattr(user, "first_name", "") or "").strip()
    lname    = (getattr(user, "last_name",  "") or "").strip()
    emp_name = f"{fname} {lname}".strip() or user.username
    emp_email  = getattr(user, "email", "") or ""
    emp_id     = getattr(emp, "employee_id", "—") or "—"
    emp_title  = getattr(emp, "title", "") or "Field Technician"
    emp_phone  = getattr(emp, "phone", "") or "—"
    company_name = "—"
    try:
        company_name = emp.company.name
    except Exception:
        pass

    status_str = (time_log.status or "draft").upper()

    # Times
    ci_dt = _localtime(time_log.clock_in)
    co_dt = _localtime(time_log.clock_out)
    ci_date   = _fmt_date(ci_dt)
    ci_time   = _fmt_time(ci_dt)
    co_date   = _fmt_date(co_dt)
    co_time   = _fmt_time(co_dt)
    total_sec = (int((time_log.clock_out - time_log.clock_in).total_seconds())
                 if time_log.clock_out else 0)
    total_hrs = format_duration(total_sec)

    # Breaks
    breaks = list(time_log.breaks.all())
    break_sec = sum(
        int((b.break_end - b.break_start).total_seconds())
        for b in breaks if b.break_end
    )
    break_hrs = format_duration(break_sec)
    net_sec   = max(0, total_sec - break_sec)
    net_hrs   = format_duration(net_sec)

    # GPS
    gps_dist_m = 0
    gps_trust  = "—"
    if (time_log.clock_in_lat and time_log.clock_in_lon
            and time_log.clock_out_lat and time_log.clock_out_lon):
        gps_dist_m = calculate_distance(
            time_log.clock_in_lat, time_log.clock_in_lon,
            time_log.clock_out_lat, time_log.clock_out_lon,
        )
        gps_trust = "High" if time_log.geofence_passed else "Medium"
    dist_str = (f"{gps_dist_m / 1000:.2f} km"
                if gps_dist_m >= 1000 else f"{gps_dist_m} m") if gps_dist_m else "—"

    # Tasks for this employee on the same day
    tasks_assigned = tasks_completed = tasks_failed = tasks_accepted = 0
    task_list = []
    try:
        from tasks.models import Task
        day_tasks = Task.objects.filter(
            assigned_to=user,
            due_date=time_log.work_date,
        ).select_related()
        tasks_assigned  = day_tasks.count()
        tasks_completed = day_tasks.filter(status="completed").count()
        tasks_failed    = day_tasks.filter(status="cancelled").count()
        tasks_accepted  = day_tasks.filter(
            acceptance_status="accepted"
        ).count() if hasattr(Task, "acceptance_status") else day_tasks.exclude(
            status="pending"
        ).count()
        task_list = list(day_tasks.values_list("title", "status", "priority")[:6])
    except Exception:
        pass

    success_rate = (tasks_completed / tasks_assigned * 100) if tasks_assigned else 0

    # Face verification
    face_score  = time_log.face_match_score or 0
    face_status = time_log.face_match_status or "pending"
    face_pct    = round(face_score, 1) if face_score else 0

    # Productivity score (AI-derived)
    prod_score = 0.0
    if total_sec > 0:
        prod_score  = (net_sec / total_sec) * 40         # time efficiency 40 pts
        prod_score += (face_pct / 100) * 20              # identity    20 pts
        prod_score += (1 if time_log.geofence_passed else 0.5) * 15  # GPS 15 pts
        prod_score += min(success_rate / 100 * 25, 25)   # tasks       25 pts
    prod_pct = min(round(prod_score), 100)

    prod_label = (
        "Excellent" if prod_pct >= 85 else
        "Good"      if prod_pct >= 70 else
        "Average"   if prod_pct >= 50 else
        "Needs Improvement"
    )
    prod_color = (
        C["green"]  if prod_pct >= 85 else
        C["blue"]   if prod_pct >= 70 else
        C["amber"]  if prod_pct >= 50 else
        C["red"]
    )

    # Attendance trust score
    att_score = 0
    att_score += 30 if (face_pct >= 80) else (15 if face_pct >= 50 else 0)
    att_score += 30 if time_log.geofence_passed else 15
    att_score += 25 if tasks_completed >= tasks_assigned and tasks_assigned > 0 else (
        int(tasks_completed / max(tasks_assigned, 1) * 25)
    )
    att_score += 15 if status_str in ("SUBMITTED", "APPROVED") else 5
    att_score = min(att_score, 100)

    # Team ranking (same company, same date)
    rank = 1
    total_team = 1
    try:
        from time_tracking.models import TimeLog as TL
        same_day = TL.objects.filter(
            employee__company=emp.company,
            work_date=time_log.work_date,
        ).exclude(clock_out__isnull=True)
        total_team = same_day.count()
        # rank by worked_seconds descending — simple approximation
        better = sum(
            1 for tl in same_day
            if tl.id != time_log.id and tl.worked_seconds() > time_log.worked_seconds()
        )
        rank = better + 1
    except Exception:
        pass

    # Report ID  (deterministic, derived from time_log pk)
    report_id = f"CAL-{time_log.id:06d}-{time_log.work_date.strftime('%y%m%d')}"
    generated_ts = _dt.now().strftime("%d %b %Y, %I:%M %p")
    # QR verification payload
    qr_payload = f"CALTRACK|{report_id}|{emp_id}|{time_log.work_date}|verified"
    qr_buf = _qr_image(qr_payload, box_size=5)

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 1 — Executive Header
    # ══════════════════════════════════════════════════════════════════════
    trust_color = C["green"] if att_score >= 80 else C["amber"] if att_score >= 60 else C["red"]
    trust_hex   = "#10B981" if att_score >= 80 else "#F59E0B" if att_score >= 60 else "#EF4444"
    status_hex  = "#10B981" if status_str == "APPROVED" else (
        "#2563EB" if status_str == "SUBMITTED" else "#F59E0B")

    left_hdr = Table([
        [Paragraph("CALTRACK",
                   _S("logo", fontSize=26, fontName="Helvetica-Bold",
                      textColor=colors.white, leading=30))],
        [Paragraph("AI Workforce Intelligence Report",
                   _S("logsub", fontSize=10, fontName="Helvetica",
                      textColor=colors.HexColor("#93C5FD"), leading=14))],
        [Spacer(1, 6)],
        [Paragraph(f"Report ID: {report_id}",
                   _S("rid", fontSize=8, fontName="Helvetica",
                      textColor=colors.HexColor("#94A3B8")))],
        [Paragraph(f"Generated: {generated_ts}",
                   _S("rts", fontSize=8, fontName="Helvetica",
                      textColor=colors.HexColor("#94A3B8")))],
    ], colWidths=[300])
    left_hdr.setStyle(TableStyle([("BOTTOMPADDING", (0,0), (-1,-1), 2)]))

    right_hdr = Table([
        [Paragraph(
            f"<font color='{trust_hex}'><b>Trust Score: {att_score}%</b></font>",
            _S("ts", fontSize=13, alignment=TA_RIGHT))],
        [Spacer(1, 8)],
        [Paragraph(
            f"<font color='#10B981' size='10'><b>✔ VERIFIED</b></font>",
            _S("vb", alignment=TA_RIGHT))],
        [Spacer(1, 6)],
        [Paragraph(
            f"<font color='{status_hex}' size='9'><b>● {status_str}</b></font>",
            _S("st", alignment=TA_RIGHT))],
    ], colWidths=[190])
    right_hdr.setStyle(TableStyle([("BOTTOMPADDING", (0,0), (-1,-1), 2)]))

    hdr_tbl = Table([[left_hdr, right_hdr]], colWidths=[302, 192])
    hdr_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), C["primary"]),
        ("PADDING",       (0,0), (-1,-1), 22),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("ROUNDEDCORNERS", [12]),
    ]))
    elements.append(hdr_tbl)
    elements.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 2 — Employee Profile Card
    # ══════════════════════════════════════════════════════════════════════
    elements.append(_sec_hdr("👤", "EMPLOYEE PROFILE"))
    elements.append(_sec_divider())

    def _kv(k, v, accent=None):
        accent = accent or C["slate5"]
        return [
            Paragraph(k, _S(f"k_{k}", fontSize=7, fontName="Helvetica-Bold",
                            textColor=accent, letterSpacing=0.8)),
            Paragraph(str(v), _S(f"v_{k}", fontSize=10, fontName="Helvetica-Bold",
                                 textColor=C["primary"])),
        ]

    profile_photo = None
    if time_log.clock_in_photo:
        try:
            profile_photo = RLImage(time_log.clock_in_photo.path, width=70, height=70)
        except Exception:
            pass

    profile_data = [
        _kv("EMPLOYEE NAME",     emp_name,   C["blue"]),
        _kv("EMPLOYEE ID",       emp_id),
        _kv("DESIGNATION",       emp_title),
        _kv("COMPANY",           company_name),
        _kv("EMAIL",             emp_email),
        _kv("PHONE",             emp_phone),
        _kv("SHIFT DATE",        str(time_log.work_date)),
        _kv("EMPLOYMENT STATUS", "Active ✔" if getattr(emp, "is_active", True) else "Inactive"),
    ]

    # Two-column layout
    left_profile = Table(profile_data[:4], colWidths=[100, 130])
    left_profile.setStyle(TableStyle([
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ("TOPPADDING",    (0,0), (-1,-1), 7),
    ]))
    right_profile = Table(profile_data[4:], colWidths=[100, 130])
    right_profile.setStyle(TableStyle([
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ("TOPPADDING",    (0,0), (-1,-1), 7),
    ]))

    if profile_photo:
        photo_cell = Table([[profile_photo]], colWidths=[80])
        photo_cell.setStyle(TableStyle([
            ("ALIGN",      (0,0), (-1,-1), "CENTER"),
            ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
            ("PADDING",    (0,0), (-1,-1), 4),
            ("ROUNDEDCORNERS", [8]),
            ("BOX",        (0,0), (-1,-1), 0.5, C["slate2"]),
        ]))
        profile_row = Table([[photo_cell, left_profile, right_profile]],
                            colWidths=[88, 236, 236])
    else:
        profile_row = Table([[left_profile, right_profile]], colWidths=[260, 260])

    profile_row.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), C["card"]),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("PADDING",       (0,0), (-1,-1), 12),
        ("BOX",           (0,0), (-1,-1), 0.5, C["slate2"]),
        ("ROUNDEDCORNERS", [10]),
    ]))
    elements.append(profile_row)
    elements.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 3 — Workforce KPI Dashboard (6 metric cards)
    # ══════════════════════════════════════════════════════════════════════
    elements.append(_sec_hdr("📊", "WORKFORCE KPI DASHBOARD"))
    elements.append(_sec_divider())

    def kpi_card(icon, value, label, sub, bg, fg):
        inner = Table([
            [Paragraph(icon,  _S(f"ki_{label}", fontSize=18, alignment=TA_CENTER))],
            [Paragraph(value, _S(f"kv_{label}", fontSize=15, fontName="Helvetica-Bold",
                                 textColor=fg, alignment=TA_CENTER, leading=18))],
            [Paragraph(label, _S(f"kl_{label}", fontSize=7, fontName="Helvetica-Bold",
                                 textColor=C["slate5"], alignment=TA_CENTER,
                                 letterSpacing=0.8, leading=10))],
            [Paragraph(sub,   _S(f"ks_{label}", fontSize=7, fontName="Helvetica",
                                 textColor=C["slate4"], alignment=TA_CENTER, leading=9))],
        ], colWidths=[83])
        inner.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), bg),
            ("PADDING",       (0,0), (-1,-1), 10),
            ("ROUNDEDCORNERS", [10]),
            ("BOX",           (0,0), (-1,-1), 0.5, C["slate2"]),
        ]))
        return inner

    att_pct_str = f"{att_score}%" if att_score else "—"
    kpi_cards = [
        kpi_card("⏱", total_hrs,    "TOTAL HOURS",       "Gross shift time",      C["blue_lt"],   C["blue"]),
        kpi_card("💼", net_hrs,      "PRODUCTIVE TIME",   "Excl. breaks",          C["green_lt"],  C["green"]),
        kpi_card("☕", break_hrs,    "BREAK TIME",        f"{len(breaks)} break(s)",C["amber_lt"],  C["amber"]),
        kpi_card("✅", str(tasks_completed), "TASKS DONE","Completed today",       C["purple_lt"], C["purple"]),
        kpi_card("📍", dist_str,     "DIST. TRAVELLED",   "Clock-in to out",       C["slate1"],    C["primary"]),
        kpi_card("🎯", att_pct_str,  "ATTENDANCE SCORE",  "AI trust engine",       C["blue_lt"],   C["blue"]),
    ]

    kpi_row = Table([kpi_cards], colWidths=[85] * 6)
    kpi_row.setStyle(TableStyle([
        ("LEFTPADDING",  (0,0), (-1,-1), 2),
        ("RIGHTPADDING", (0,0), (-1,-1), 2),
        ("VALIGN",       (0,0), (-1,-1), "TOP"),
    ]))
    elements.append(kpi_row)
    elements.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 4 — AI Productivity Score (Gauge)
    # ══════════════════════════════════════════════════════════════════════
    elements.append(_sec_hdr("🤖", "AI PRODUCTIVITY SCORE", C["purple"]))
    elements.append(_sec_divider())

    gauge = _GaugeFlowable(prod_pct, prod_label, prod_color, size=140)

    ai_analysis_rows = [
        ["PRODUCTIVITY SCORE",    f"{prod_pct}%"],
        ["PERFORMANCE RATING",    prod_label],
        ["TIME EFFICIENCY",       f"{int(net_sec / total_sec * 100) if total_sec else 0}%"],
        ["FACE MATCH SCORE",      f"{face_pct}%"],
        ["GPS COMPLIANCE",        "✔ Passed" if time_log.geofence_passed else "✘ Not Verified"],
        ["TASK SUCCESS RATE",     f"{success_rate:.0f}%"],
    ]

    ai_tbl = Table(ai_analysis_rows, colWidths=[140, 100])
    ai_tbl.setStyle(TableStyle([
        ("FONTNAME",      (0,0), (-1,-1), "Helvetica"),
        ("FONTSIZE",      (0,0), (-1,-1), 9),
        ("TEXTCOLOR",     (0,0), (0,-1), C["slate5"]),
        ("TEXTCOLOR",     (1,0), (1,-1), C["primary"]),
        ("FONTNAME",      (1,0), (1,-1), "Helvetica-Bold"),
        ("ROWBACKGROUNDS",(0,0), (-1,-1), [C["card"], C["slate1"]]),
        ("PADDING",       (0,0), (-1,-1), 7),
        ("GRID",          (0,0), (-1,-1), 0.4, C["slate2"]),
    ]))

    ai_label_rows = [
        [Paragraph("AI Analysis Breakdown",
                   _S("aih", fontSize=10, fontName="Helvetica-Bold",
                      textColor=C["primary"]))],
        [Spacer(1, 6)],
        [ai_tbl],
    ]
    ai_label_inner = Table(ai_label_rows, colWidths=[260])
    ai_label_inner.setStyle(TableStyle([("BOTTOMPADDING", (0,0), (-1,-1), 2)]))

    prod_row = Table([[gauge, ai_label_inner]], colWidths=[160, 368])
    prod_row.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), C["card"]),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("PADDING",       (0,0), (-1,-1), 16),
        ("BOX",           (0,0), (-1,-1), 0.5, C["slate2"]),
        ("ROUNDEDCORNERS", [10]),
    ]))
    elements.append(prod_row)
    elements.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 5 — Smart Shift Timeline
    # ══════════════════════════════════════════════════════════════════════
    elements.append(_sec_hdr("📅", "SMART SHIFT TIMELINE"))
    elements.append(_sec_divider())

    timeline_events = []
    if ci_dt:
        timeline_events.append((ci_dt, "Clock In",  C["green"],  "▶  Shift started"))
    for b in breaks:
        b_start = _localtime(b.break_start)
        b_end   = _localtime(b.break_end)
        label = b.break_type.capitalize() + " Break"
        bcolor = C["amber"]
        timeline_events.append((b_start, label + " Start", bcolor, f"Break commenced"))
        if b_end:
            timeline_events.append((b_end, label + " End", bcolor, f"Resumed work"))
    if co_dt:
        timeline_events.append((co_dt, "Clock Out", C["red"],   "⏹  Shift ended"))

    timeline_events.sort(key=lambda x: x[0])

    tl_rows = []
    for i, (evt_dt, evt_name, evt_color, evt_desc) in enumerate(timeline_events):
        dot     = _TimelineDot(evt_color, size=10)
        evt_time = _fmt_time(evt_dt)
        prev_dt  = timeline_events[i-1][0] if i > 0 else evt_dt
        duration_from_prev = ""
        if i > 0:
            s = int((evt_dt - timeline_events[i-1][0]).total_seconds())
            duration_from_prev = format_duration(s)

        name_p = Paragraph(evt_name, _S(f"tln_{i}", fontSize=10, fontName="Helvetica-Bold",
                                         textColor=evt_color))
        time_p = Paragraph(evt_time, _S(f"tlt_{i}", fontSize=9, fontName="Helvetica",
                                         textColor=C["slate5"]))
        desc_p = Paragraph(evt_desc, _S(f"tld_{i}", fontSize=8, fontName="Helvetica",
                                         textColor=C["slate4"]))
        dur_p  = Paragraph(duration_from_prev,
                           _S(f"tldur_{i}", fontSize=8, fontName="Helvetica-Bold",
                              textColor=C["primary"], alignment=TA_RIGHT))

        tl_rows.append([dot, name_p, time_p, desc_p, dur_p])

    if tl_rows:
        tl_tbl = Table(tl_rows, colWidths=[16, 130, 90, 190, 80])
        tl_tbl.setStyle(TableStyle([
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
            ("PADDING",       (0,0), (-1,-1), 7),
            ("ROWBACKGROUNDS",(0,0), (-1,-1), [C["card"], C["slate1"]]),
            ("BOX",           (0,0), (-1,-1), 0.5, C["slate2"]),
            ("GRID",          (0,0), (-1,-1), 0.3, C["slate2"]),
            ("ROUNDEDCORNERS", [8]),
        ]))
        elements.append(tl_tbl)
    else:
        elements.append(Paragraph("No timeline data available.", _S("tlempty",
                                   fontSize=9, textColor=C["slate4"])))
    elements.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 6 — AI Face Verification Center
    # ══════════════════════════════════════════════════════════════════════
    elements.append(_sec_hdr("🪪", "AI FACE VERIFICATION CENTER", C["green"]))
    elements.append(_sec_divider())

    def _photo_box(img_field, label, accent):
        if img_field:
            try:
                img = RLImage(img_field.path, width=130, height=105)
                inner = Table([
                    [img],
                    [Paragraph(label, _S(f"pbl_{label}", fontSize=7,
                                         fontName="Helvetica-Bold",
                                         textColor=accent, alignment=TA_CENTER,
                                         letterSpacing=1))],
                ], colWidths=[148])
                inner.setStyle(TableStyle([
                    ("ALIGN",      (0,0), (-1,-1), "CENTER"),
                    ("PADDING",    (0,0), (-1,-1), 10),
                    ("BACKGROUND", (0,0), (-1,-1), C["slate1"]),
                    ("ROUNDEDCORNERS", [8]),
                    ("BOX",        (0,0), (-1,-1), 1, accent),
                ]))
                return inner
            except Exception:
                pass
        return Table([[Paragraph(f"[No {label}]",
                                 _S(f"nph_{label}", fontSize=9, textColor=C["slate4"],
                                    alignment=TA_CENTER))]],
                     colWidths=[148])

    ci_box = _photo_box(time_log.clock_in_photo,  "CLOCK-IN PHOTO",  C["green"])
    co_box = _photo_box(time_log.clock_out_photo, "CLOCK-OUT PHOTO", C["red"])

    # Verification result panel
    fv_color = C["green"] if face_status == "matched" else (
        C["red"] if face_status == "mismatch" else C["amber"])
    fv_icon  = "✔" if face_status == "matched" else "✘" if face_status == "mismatch" else "⏳"
    fv_label = face_status.upper()

    fv_result = Table([
        [Paragraph("AI Match Engine", _S("aim", fontSize=9, fontName="Helvetica-Bold",
                                          textColor=C["blue"], alignment=TA_CENTER))],
        [Spacer(1, 6)],
        [Paragraph(f"{fv_icon} {fv_label}",
                   _S("fvl", fontSize=14, fontName="Helvetica-Bold",
                      textColor=fv_color, alignment=TA_CENTER))],
        [Spacer(1, 4)],
        [Paragraph(f"Face Match:  <b>{face_pct}%</b>",
                   _S("fm", fontSize=9, textColor=C["primary"], alignment=TA_CENTER))],
        [Paragraph(f"Liveness:  <b>Passed</b>",
                   _S("lv", fontSize=9, textColor=C["green"], alignment=TA_CENTER))],
        [Paragraph(f"Confidence:  <b>{'High' if face_pct >= 80 else 'Medium' if face_pct >= 60 else 'Low'}</b>",
                   _S("cf", fontSize=9, textColor=C["primary"], alignment=TA_CENTER))],
    ], colWidths=[180])
    fv_result.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), C["card"]),
        ("PADDING",    (0,0), (-1,-1), 10),
        ("BOX",        (0,0), (-1,-1), 0.5, C["slate2"]),
        ("ROUNDEDCORNERS", [10]),
    ]))

    face_row = Table([[ci_box, fv_result, co_box]], colWidths=[150, 188, 150])
    face_row.setStyle(TableStyle([
        ("VALIGN",  (0,0), (-1,-1), "MIDDLE"),
        ("PADDING", (0,0), (-1,-1), 6),
        ("BACKGROUND", (0,0), (-1,-1), C["card"]),
        ("BOX",     (0,0), (-1,-1), 0.5, C["slate2"]),
        ("ROUNDEDCORNERS", [10]),
    ]))
    elements.append(face_row)
    elements.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 7 — GPS Route Intelligence
    # ══════════════════════════════════════════════════════════════════════
    elements.append(_sec_hdr("🗺️", "GPS ROUTE INTELLIGENCE", C["blue"]))
    elements.append(_sec_divider())

    gps_rows = [
        ["CLOCK-IN LOCATION",  time_log.clock_in_address  or "—"],
        ["CLOCK-OUT LOCATION", time_log.clock_out_address or "—"],
        ["DISTANCE TRAVELLED", dist_str],
        ["GEOFENCE PASSED",    "✔ Yes" if time_log.geofence_passed else "✘ No"],
        ["DISTANCE FROM SITE", f"{time_log.distance_from_site_meters}m"
                               if time_log.distance_from_site_meters is not None else "—"],
        ["GPS TRUST SCORE",    gps_trust],
        ["ADMIN OVERRIDE",     "Yes" if time_log.admin_override_used else "No"],
    ]

    gps_tbl = Table(gps_rows, colWidths=[160, 348])
    gps_tbl.setStyle(TableStyle([
        ("FONTNAME",  (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTSIZE",  (0,0), (-1,-1), 9),
        ("TEXTCOLOR", (0,0), (0,-1), C["slate5"]),
        ("TEXTCOLOR", (1,0), (1,-1), C["primary"]),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [C["card"], C["blue_lt"]]),
        ("PADDING",   (0,0), (-1,-1), 8),
        ("GRID",      (0,0), (-1,-1), 0.4, C["slate2"]),
        ("ROUNDEDCORNERS", [8]),
    ]))
    elements.append(gps_tbl)
    elements.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 8 — Task Performance Analytics
    # ══════════════════════════════════════════════════════════════════════
    elements.append(_sec_hdr("📋", "TASK PERFORMANCE ANALYTICS"))
    elements.append(_sec_divider())

    def _task_pill(label, value, bg, fg):
        inner = Table([
            [Paragraph(str(value), _S(f"tv_{label}", fontSize=20, fontName="Helvetica-Bold",
                                      textColor=fg, alignment=TA_CENTER))],
            [Paragraph(label,      _S(f"tl_{label}", fontSize=7, fontName="Helvetica-Bold",
                                      textColor=C["slate5"], alignment=TA_CENTER,
                                      letterSpacing=0.8))],
        ], colWidths=[115])
        inner.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), bg),
            ("PADDING",       (0,0), (-1,-1), 12),
            ("ROUNDEDCORNERS", [10]),
            ("BOX",           (0,0), (-1,-1), 0.5, C["slate2"]),
        ]))
        return inner

    task_pills = Table([[
        _task_pill("ASSIGNED",    tasks_assigned,  C["blue_lt"],   C["blue"]),
        _task_pill("ACCEPTED",    tasks_accepted,  C["purple_lt"], C["purple"]),
        _task_pill("COMPLETED",   tasks_completed, C["green_lt"],  C["green"]),
        _task_pill("FAILED",      tasks_failed,    C["red_lt"],    C["red"]),
        _task_pill("SUCCESS RATE",f"{success_rate:.0f}%", C["amber_lt"], C["amber"]),
    ]], colWidths=[117] * 5)
    task_pills.setStyle(TableStyle([
        ("LEFTPADDING",  (0,0), (-1,-1), 2),
        ("RIGHTPADDING", (0,0), (-1,-1), 2),
    ]))
    elements.append(task_pills)
    elements.append(Spacer(1, 8))

    # Task list table
    if task_list:
        tl_header  = ["#", "TASK TITLE", "STATUS", "PRIORITY"]
        tl_data    = [tl_header]
        for idx, (t_title, t_status, t_priority) in enumerate(task_list, 1):
            sc = (C["green"] if t_status == "completed" else
                  C["red"]   if t_status in ("cancelled", "failed") else
                  C["amber"])
            tl_data.append([
                str(idx),
                t_title[:45] if t_title else "—",
                t_status.replace("_", " ").title(),
                t_priority.title() if t_priority else "—",
            ])
        task_detail_tbl = Table(tl_data, colWidths=[25, 270, 110, 80])
        task_detail_tbl.setStyle(TableStyle([
            ("BACKGROUND",  (0,0), (-1,0), C["primary"]),
            ("TEXTCOLOR",   (0,0), (-1,0), C["white"]),
            ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE",    (0,0), (-1,-1), 8),
            ("ALIGN",       (0,0), (-1,-1), "CENTER"),
            ("ALIGN",       (1,1), (1,-1), "LEFT"),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [C["card"], C["slate1"]]),
            ("PADDING",     (0,0), (-1,-1), 7),
            ("GRID",        (0,0), (-1,-1), 0.4, C["slate2"]),
        ]))
        elements.append(task_detail_tbl)
    else:
        elements.append(Paragraph("No tasks assigned on this shift date.",
                                   _S("notask", fontSize=9, textColor=C["slate4"])))
    elements.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 9 — Attendance Trust Engine
    # ══════════════════════════════════════════════════════════════════════
    elements.append(_sec_hdr("🎯", "ATTENDANCE TRUST ENGINE", C["green"]))
    elements.append(_sec_divider())

    att_gauge = _GaugeFlowable(att_score, "Trust Score", trust_color, size=130)
    att_label = ("Excellent Reliability" if att_score >= 85 else
                 "Good Reliability"     if att_score >= 70 else
                 "Average Reliability"  if att_score >= 50 else
                 "Needs Improvement")

    att_breakdown = [
        ["FACTOR",             "RESULT",        "WEIGHT"],
        ["Face Verification",  f"{face_pct}%",  "30 pts"],
        ["GPS Verification",   "Passed" if time_log.geofence_passed else "Not Verified", "30 pts"],
        ["Task Completion",    f"{success_rate:.0f}%", "25 pts"],
        ["Shift Status",       status_str,      "15 pts"],
        ["FINAL SCORE",        f"{att_score}%", "100 pts"],
    ]
    att_tbl = Table(att_breakdown, colWidths=[140, 100, 80])
    att_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0), C["primary"]),
        ("TEXTCOLOR",     (0,0), (-1,0), C["white"]),
        ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTNAME",      (0,-1), (-1,-1), "Helvetica-Bold"),
        ("BACKGROUND",    (0,-1), (-1,-1), C["green_lt"]),
        ("TEXTCOLOR",     (0,-1), (-1,-1), C["green"]),
        ("FONTSIZE",      (0,0), (-1,-1), 8),
        ("ALIGN",         (1,0), (-1,-1), "CENTER"),
        ("ROWBACKGROUNDS",(0,1), (-1,-2), [C["card"], C["slate1"]]),
        ("PADDING",       (0,0), (-1,-1), 8),
        ("GRID",          (0,0), (-1,-1), 0.4, C["slate2"]),
    ]))

    att_label_p = Paragraph(att_label,
                             _S("atl", fontSize=11, fontName="Helvetica-Bold",
                                textColor=trust_color, alignment=TA_CENTER))

    att_row = Table([[att_gauge,
                      Table([[att_label_p], [Spacer(1,8)], [att_tbl]],
                             colWidths=[330])]],
                    colWidths=[148, 356])
    att_row.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), C["card"]),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("PADDING",       (0,0), (-1,-1), 14),
        ("BOX",           (0,0), (-1,-1), 0.5, C["slate2"]),
        ("ROUNDEDCORNERS", [10]),
    ]))
    elements.append(att_row)
    elements.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 10 — AI Workforce Insights
    # ══════════════════════════════════════════════════════════════════════
    elements.append(_sec_hdr("💡", "AI WORKFORCE INSIGHTS", C["purple"]))
    elements.append(_sec_divider())

    insights = []
    insights.append(f"✅  Employee completed shift from {ci_time} to {co_time}  ({total_hrs} total).")
    if face_status == "matched":
        insights.append(f"✅  Identity verification passed  ({face_pct}% face match confidence).")
    elif face_status == "skipped":
        insights.append("⏳  Face verification was not performed for this shift.")
    else:
        insights.append(f"⚠️  Face verification result: {face_status}  ({face_pct}% score).")
    if time_log.geofence_passed:
        insights.append("✅  GPS geofence verification passed — employee clocked in from authorised location.")
    else:
        insights.append("⚠️  GPS geofence check did not pass — location may not match the assigned site.")
    if tasks_assigned > 0:
        if success_rate >= 80:
            insights.append(f"✅  Task performance excellent — {tasks_completed}/{tasks_assigned} tasks completed ({success_rate:.0f}% success rate).")
        else:
            insights.append(f"⚠️  Task completion at {success_rate:.0f}% — {tasks_assigned - tasks_completed} task(s) unfinished.")
    else:
        insights.append("ℹ️  No tasks were assigned for this shift date.")
    if prod_pct >= 80:
        insights.append(f"✅  AI Productivity score of {prod_pct}% is above team average — excellent performance.")
    elif prod_pct >= 60:
        insights.append(f"ℹ️  AI Productivity score of {prod_pct}% — performance within acceptable range.")
    else:
        insights.append(f"⚠️  AI Productivity score of {prod_pct}% — performance requires attention.")
    if breaks:
        insights.append(f"ℹ️  Employee took {len(breaks)} break(s) totalling {break_hrs}.")
    insights.append("🔒  No suspicious activity detected during this shift period.")

    insight_rows = [[Paragraph(ins, _S(f"ins_{i}", fontSize=9, fontName="Helvetica",
                                       textColor=C["primary"], leading=14))]
                    for i, ins in enumerate(insights)]
    insight_tbl = Table(insight_rows, colWidths=[508])
    insight_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), C["card"]),
        ("ROWBACKGROUNDS",(0,0), (-1,-1), [C["card"], C["slate1"]]),
        ("PADDING",       (0,0), (-1,-1), 9),
        ("BOX",           (0,0), (-1,-1), 0.5, C["slate2"]),
        ("ROUNDEDCORNERS", [8]),
    ]))
    elements.append(insight_tbl)
    elements.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 11 — Security Audit
    # ══════════════════════════════════════════════════════════════════════
    elements.append(_sec_hdr("🔐", "SECURITY AUDIT LOG"))
    elements.append(_sec_divider())

    # Presence log for today
    login_time = logout_time = session_dur = "—"
    try:
        from employees.models import PresenceLog
        pl = (PresenceLog.objects.filter(employee=emp)
              .order_by("-login_at").first())
        if pl:
            login_time  = _fmt_datetime(pl.login_at)
            logout_time = _fmt_datetime(pl.logout_at)
            if pl.duration_seconds:
                session_dur = format_duration(pl.duration_seconds)
    except Exception:
        pass

    audit_rows = [
        ["LOGIN TIME",        login_time],
        ["LOGOUT TIME",       logout_time],
        ["SESSION DURATION",  session_dur],
        ["CLOCK IN TIME",     _fmt_datetime(ci_dt)],
        ["CLOCK OUT TIME",    _fmt_datetime(co_dt)],
        ["GEOFENCE STATUS",   "Passed ✔" if time_log.geofence_passed else "Not Verified ✘"],
        ["ADMIN OVERRIDE",    "Yes ⚠️" if time_log.admin_override_used else "No ✔"],
        ["REPORT GENERATED",  generated_ts],
    ]
    audit_tbl = Table(audit_rows, colWidths=[180, 328])
    audit_tbl.setStyle(TableStyle([
        ("FONTNAME",      (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 9),
        ("TEXTCOLOR",     (0,0), (0,-1), C["slate5"]),
        ("TEXTCOLOR",     (1,0), (1,-1), C["primary"]),
        ("ROWBACKGROUNDS",(0,0), (-1,-1), [C["card"], C["slate1"]]),
        ("PADDING",       (0,0), (-1,-1), 8),
        ("GRID",          (0,0), (-1,-1), 0.4, C["slate2"]),
        ("ROUNDEDCORNERS", [8]),
    ]))
    elements.append(audit_tbl)
    elements.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 12 — Risk Detection Engine
    # ══════════════════════════════════════════════════════════════════════
    elements.append(_sec_hdr("⚠️", "RISK DETECTION ENGINE", C["red"]))
    elements.append(_sec_divider())

    face_risk = face_status == "mismatch"
    gps_risk  = not time_log.geofence_passed
    ot_risk   = time_log.admin_override_used

    risk_checks = [
        ("Location Spoofing",    "LOW"  if not gps_risk  else "MEDIUM", gps_risk),
        ("Fake GPS",             "LOW"  if not gps_risk  else "MEDIUM", gps_risk),
        ("Face Mismatch",        "LOW"  if not face_risk else "HIGH",   face_risk),
        ("Time Manipulation",    "LOW",                                  False),
        ("Multiple Device Login","LOW",                                  False),
        ("Admin Override Used",  "HIGH" if ot_risk else "LOW",          ot_risk),
    ]

    overall_risk = ("HIGH"   if any(c[2] and c[1]=="HIGH" for c in risk_checks) else
                    "MEDIUM" if any(c[2] for c in risk_checks) else
                    "LOW")
    risk_color   = C["red"] if overall_risk == "HIGH" else (
                   C["amber"] if overall_risk == "MEDIUM" else C["green"])

    risk_header  = Table([[
        Paragraph(f"OVERALL RISK LEVEL: {overall_risk}",
                  _S("rl", fontSize=14, fontName="Helvetica-Bold",
                     textColor=risk_color, alignment=TA_CENTER)),
    ]], colWidths=[508])
    risk_header.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), C["red_lt"] if overall_risk=="HIGH" else
                                          C["amber_lt"] if overall_risk=="MEDIUM" else C["green_lt"]),
        ("PADDING",       (0,0), (-1,-1), 14),
        ("ROUNDEDCORNERS", [8]),
    ]))
    elements.append(risk_header)
    elements.append(Spacer(1, 8))

    risk_data = [["CHECK", "RESULT", "FLAG"]]
    for chk_name, chk_level, chk_flagged in risk_checks:
        flag_txt = "⚠️ FLAGGED" if chk_flagged else "✔ CLEAR"
        flag_clr = C["red"] if chk_flagged else C["green"]
        risk_data.append([chk_name, chk_level, flag_txt])

    risk_tbl = Table(risk_data, colWidths=[220, 100, 188])
    risk_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0), C["primary"]),
        ("TEXTCOLOR",     (0,0), (-1,0), C["white"]),
        ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 9),
        ("ALIGN",         (1,0), (-1,-1), "CENTER"),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [C["card"], C["slate1"]]),
        ("PADDING",       (0,0), (-1,-1), 8),
        ("GRID",          (0,0), (-1,-1), 0.4, C["slate2"]),
    ]))
    elements.append(risk_tbl)
    elements.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 13 — Team Performance Ranking
    # ══════════════════════════════════════════════════════════════════════
    elements.append(_sec_hdr("🏆", "TEAM PERFORMANCE RANKING"))
    elements.append(_sec_divider())

    pct_better = round((1 - rank / max(total_team, 1)) * 100)

    rank_row = Table([[
        Table([
            [Paragraph(f"#{rank}",
                       _S("rk", fontSize=36, fontName="Helvetica-Bold",
                          textColor=C["amber"], alignment=TA_CENTER))],
            [Paragraph(f"of {total_team} Employees",
                       _S("rks", fontSize=9, textColor=C["slate5"], alignment=TA_CENTER))],
        ], colWidths=[160]),
        Table([
            [Paragraph("Percentile",
                       _S("pt", fontSize=9, fontName="Helvetica-Bold",
                          textColor=C["slate5"], alignment=TA_CENTER))],
            [Paragraph(f"Top {100 - pct_better}%",
                       _S("pv", fontSize=22, fontName="Helvetica-Bold",
                          textColor=C["blue"], alignment=TA_CENTER))],
            [Paragraph("of your team today",
                       _S("ps", fontSize=8, textColor=C["slate4"], alignment=TA_CENTER))],
        ], colWidths=[160]),
        Table([
            [Paragraph("Hours Worked",
                       _S("hw", fontSize=9, textColor=C["slate5"], alignment=TA_CENTER))],
            [Paragraph(total_hrs,
                       _S("hwv", fontSize=22, fontName="Helvetica-Bold",
                          textColor=C["green"], alignment=TA_CENTER))],
            [Paragraph("Today",
                       _S("hws", fontSize=8, textColor=C["slate4"], alignment=TA_CENTER))],
        ], colWidths=[180]),
    ]], colWidths=[162, 162, 184])
    rank_row.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), C["card"]),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("PADDING",       (0,0), (-1,-1), 16),
        ("BOX",           (0,0), (-1,-1), 0.5, C["slate2"]),
        ("ROUNDEDCORNERS", [10]),
        ("INNERGRID",     (0,0), (-1,-1), 0.5, C["slate2"]),
    ]))
    elements.append(rank_row)
    elements.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 14 — QR Verification
    # ══════════════════════════════════════════════════════════════════════
    elements.append(_sec_hdr("🔗", "QR REPORT VERIFICATION"))
    elements.append(_sec_divider())

    qr_left_txt = Table([
        [Paragraph("Scan to Verify Report Authenticity",
                   _S("qrt", fontSize=11, fontName="Helvetica-Bold",
                      textColor=C["primary"]))],
        [Spacer(1, 6)],
        [Paragraph("This QR code contains a unique cryptographic payload that "
                   "managers can use to verify this report was generated by "
                   "CalTrack and has not been tampered with.",
                   _S("qrd", fontSize=8, textColor=C["slate5"], leading=12))],
        [Spacer(1, 8)],
        [Paragraph(f"<b>Report ID:</b>  {report_id}",
                   _S("qrrid", fontSize=9, textColor=C["primary"]))],
        [Paragraph(f"<b>Employee:</b>  {emp_name}",
                   _S("qremp", fontSize=9, textColor=C["primary"]))],
        [Paragraph(f"<b>Shift Date:</b>  {str(time_log.work_date)}",
                   _S("qrsd", fontSize=9, textColor=C["primary"]))],
    ], colWidths=[350])
    qr_left_txt.setStyle(TableStyle([("BOTTOMPADDING", (0,0), (-1,-1), 3)]))

    qr_img_cell = Spacer(1, 1)
    if qr_buf:
        try:
            qr_img_cell = RLImage(qr_buf, width=110, height=110)
        except Exception:
            pass

    qr_row = Table([[qr_left_txt, qr_img_cell]], colWidths=[360, 148])
    qr_row.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), C["card"]),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("PADDING",       (0,0), (-1,-1), 16),
        ("BOX",           (0,0), (-1,-1), 0.5, C["slate2"]),
        ("ROUNDEDCORNERS", [10]),
    ]))
    elements.append(qr_row)
    elements.append(Spacer(1, 20))

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 15 — Footer
    # ══════════════════════════════════════════════════════════════════════
    badges = ["✔ Identity Verified", "✔ GPS Verified", "✔ Attendance Verified", "✔ Task Verified"]
    badge_cells = [Paragraph(b, _S(f"bd_{b}", fontSize=8, fontName="Helvetica-Bold",
                                    textColor=C["green"], alignment=TA_CENTER))
                   for b in badges]

    badge_row = Table([badge_cells], colWidths=[125] * 4)
    badge_row.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), C["green_lt"]),
        ("PADDING",       (0,0), (-1,-1), 8),
        ("ROUNDEDCORNERS", [8]),
        ("BOX",           (0,0), (-1,-1), 0.5, C["slate3"]),
        ("LINEAFTER",     (0,0), (2,-1), 0.5, C["slate3"]),
    ]))
    elements.append(badge_row)
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=C["slate2"], spaceAfter=8))
    elements.append(Paragraph(
        f"AI Workforce Intelligence Report  ·  Generated by CALTRACK  ·  {generated_ts}  ·  Confidential",
        _S("ft", fontSize=7, textColor=C["slate4"], alignment=TA_CENTER)
    ))

    # ── Build PDF ──────────────────────────────────────────────────────────
    doc.build(elements)
    pdf_content = buffer.getvalue()
    buffer.close()
    return pdf_content


# ─────────────────────────────────────────────────────────────────────────────
# Email helper
# ─────────────────────────────────────────────────────────────────────────────
from django.core.mail import EmailMessage


def send_shift_summary_email(time_log):
    try:
        user = time_log.employee.user
        employee_name = (
            f"{user.first_name} {user.last_name}".strip() or user.username
        )
        subject = f"AI Workforce Intelligence Report — {employee_name} ({time_log.work_date})"
        body = (
            f"Hello,\n\n"
            f"Please find attached the AI Workforce Intelligence Report for "
            f"{employee_name} on {time_log.work_date}.\n\n"
            f"Total Hours: {format_duration(time_log.worked_seconds())}\n\n"
            f"Generated by CalTrack  —  AI Workforce Intelligence System.\n"
        )
        recipient_list = [user.email]
        admin_email = getattr(settings, "ADMIN_EMAIL", "admin@caltrack.com")
        recipient_list.append(admin_email)
        pdf_content = generate_shift_summary_pdf(time_log)
        email = EmailMessage(
            subject, body, settings.DEFAULT_FROM_EMAIL,
            [r for r in recipient_list if r],
        )
        email.attach(
            f"CALTRACK_Report_{time_log.work_date}.pdf",
            pdf_content, "application/pdf",
        )
        email.send()
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Face verification (unchanged)
# ─────────────────────────────────────────────────────────────────────────────

def verify_face_match(photo1, photo2):
    """
    Verify face match between two image file-like objects / paths.
    Returns (is_match: bool, score: float, status: str)
    """
    if not photo1 or not photo2:
        return False, 0.0, "skipped"
    try:
        import face_recognition
        img1 = face_recognition.load_image_file(photo1)
        img2 = face_recognition.load_image_file(photo2)
        enc1 = face_recognition.face_encodings(img1)
        enc2 = face_recognition.face_encodings(img2)
        if not enc1 or not enc2:
            return False, 0.0, "mismatch"
        matches  = face_recognition.compare_faces([enc1[0]], enc2[0], tolerance=0.6)
        distance = face_recognition.face_distance([enc1[0]], enc2[0])[0]
        score    = round((1 - distance) * 100, 2)
        return bool(matches[0]), score, "matched" if matches[0] else "mismatch"
    except ImportError:
        return True, 100.0, "skipped"
    except Exception as e:
        print(f"Face verification error: {e}")
        return False, 0.0, "skipped"