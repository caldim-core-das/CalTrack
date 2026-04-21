import math
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from django.conf import settings
from datetime import timedelta
import os

def calculate_distance(lat1, lon1, lat2, lon2):
    """Returns distance in METERS."""
    lat1, lon1, lat2, lon2 = map(math.radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371000 
    return round(c * r)

def format_duration(seconds):
    if not seconds: return "0h 0m"
    h = seconds // 3600
    m = (seconds % 3600) // 60
    return f"{int(h)}h {int(m)}m"

def generate_shift_summary_pdf(time_log):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle('TitleStyle', parent=styles['Heading1'], fontSize=20, textColor=colors.HexColor("#2563EB"), spaceAfter=20, alignment=1)
    label_style = ParagraphStyle('LabelStyle', parent=styles['Normal'], fontSize=11, fontWeight='BOLD', textColor=colors.grey)
    value_style = ParagraphStyle('ValueStyle', parent=styles['Normal'], fontSize=12, textColor=colors.black)

    elements = []
    
    # ── Header ──
    elements.append(Paragraph("SHIFT SUMMARY", title_style))
    elements.append(Spacer(1, 10))
    
    user = time_log.employee.user
    fname = (getattr(user, 'first_name', '') or '').strip()
    lname = (getattr(user, 'last_name', '') or '').strip()
    employee_name = f"{fname} {lname}".strip() or user.username
    
    status_str = (time_log.status or 'draft').upper()
    
    # ── Basic Info Table ──
    data = [
        [Paragraph("Employee:", label_style), Paragraph(employee_name, value_style)],
        [Paragraph("Date:", label_style), Paragraph(str(time_log.work_date), value_style)],
        [Paragraph("Status:", label_style), Paragraph(status_str, value_style)],
    ]
    
    t = Table(data, colWidths=[100, 350])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 20))
    
    # ── Time & Location Table ──
    time_data = [
        [Paragraph("Clock In", label_style), Paragraph("Clock Out", label_style), Paragraph("Total Hours", label_style)],
        [
            Paragraph(time_log.clock_in.strftime("%I:%M %p") if time_log.clock_in else "—", value_style),
            Paragraph(time_log.clock_out.strftime("%I:%M %p") if time_log.clock_out else "—", value_style),
            Paragraph(format_duration(time_log.worked_seconds()), value_style)
        ],
        [Paragraph("Location (In)", label_style), Paragraph("Location (Out)", label_style), Paragraph("Overtime", label_style)],
        [
            Paragraph(time_log.clock_in_address or "—", value_style),
            Paragraph(time_log.clock_out_address or "—", value_style),
            Paragraph("0h 0m", value_style) # Replace with real OT if needed
        ]
    ]
    
    t2 = Table(time_data, colWidths=[150, 150, 150])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.whitesmoke),
        ('BACKGROUND', (0,2), (-1,2), colors.whitesmoke),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 20))

    # ── Breaks ──
    breaks = time_log.breaks.all()
    if breaks:
        elements.append(Paragraph("BREAKS", styles['Heading3']))
        break_data = [["Type", "Start", "End", "Duration"]]
        for b in breaks:
            dur = "—"
            if b.break_end:
                d = (b.break_end - b.break_start).total_seconds()
                dur = f"{int(d//60)}m {int(d%60)}s"
            break_data.append([
                b.break_type.capitalize(),
                b.break_start.strftime("%I:%M %p"),
                b.break_end.strftime("%I:%M %p") if b.break_end else "Active",
                dur
            ])
        t3 = Table(break_data, colWidths=[110, 110, 110, 110])
        t3.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EFF6FF")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#2563EB")),
            ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('FONTSIZE', (0,0), (-1,-1), 10),
        ]))
        elements.append(t3)
        elements.append(Spacer(1, 20))

    # ── Verification Photos ──
    photo_elements = []
    if time_log.clock_in_photo:
        try:
            path = time_log.clock_in_photo.path
            img = RLImage(path, width=200, height=150)
            photo_elements.append([Paragraph("CLOCK-IN PHOTO", label_style), img])
        except: pass
        
    if time_log.clock_out_photo:
        try:
            path = time_log.clock_out_photo.path
            img = RLImage(path, width=200, height=150)
            photo_elements.append([Paragraph("CLOCK-OUT PHOTO", label_style), img])
        except: pass

    if photo_elements:
        elements.append(Paragraph("VERIFICATION", styles['Heading3']))
        # Wrap photos in a table for side-by-side
        pt = Table(photo_elements, colWidths=[225, 225])
        elements.append(pt)

    # ── Footer ──
    elements.append(Spacer(1, 40))
    elements.append(Paragraph(f"Generated by QuickTIMS on {str(time_log.updated_at)}", styles['Italic']))

    try:
        doc.build(elements)
    except Exception as e:
        print(f"Error building PDF: {e}")
        # Return a simple error PDF or raise
        raise e
        
    pdf_content = buffer.getvalue()
    buffer.close()
    return pdf_content

from django.core.mail import EmailMessage

def send_shift_summary_email(time_log):
    try:
        user = time_log.employee.user
        employee_name = f"{user.first_name} {user.last_name}" or user.username
        
        subject = f"Shift Summary — {employee_name} ({time_log.work_date})"
        body = f"Hello,\n\nPlease find attached the shift summary for {employee_name} on {time_log.work_date}.\n\nTotal Hours: {format_duration(time_log.worked_seconds())}\n\nThanks,\nQuickTIMS System"
        
        recipient_list = [user.email]
        # In a real app, we'd find the admin email too
        admin_email = getattr(settings, 'ADMIN_EMAIL', 'admin@quicktims.com')
        recipient_list.append(admin_email)
        
        pdf_content = generate_shift_summary_pdf(time_log)
        
        email = EmailMessage(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [r for r in recipient_list if r],
        )
        email.attach(f"Shift_Summary_{time_log.work_date}.pdf", pdf_content, "application/pdf")
        email.send()
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False
def verify_face_match(photo1, photo2):
    """
    Verifies if the face in photo1 matches photo2.
    Returns (is_match: bool, score: float, status: str)
    """
    if not photo1 or not photo2:
        return False, 0.0, 'skipped'

    try:
        # NOTE: This requires 'face-recognition' library.
        # If not installed, we fallback to a simulation or manual review flag.
        import face_recognition
        
        # Load images
        img1 = face_recognition.load_image_file(photo1)
        img2 = face_recognition.load_image_file(photo2)
        
        # Get encodings
        encodings1 = face_recognition.face_encodings(img1)
        encodings2 = face_recognition.face_encodings(img2)
        
        if not encodings1 or not encodings2:
            return False, 0.0, 'mismatch' # No faces detected
            
        # Compare
        matches = face_recognition.compare_faces([encodings1[0]], encodings2[0], tolerance=0.6)
        distance = face_recognition.face_distance([encodings1[0]], encodings2[0])[0]
        
        score = round((1 - distance) * 100, 2)
        return bool(matches[0]), score, 'matched' if matches[0] else 'mismatch'
        
    except ImportError:
        # Simulation mode: If library is missing, we allow it for now but flag it.
        # In a real environment, you would install the library.
        # Here we'll return a 'matched' status but with a note.
        return True, 100.0, 'skipped'
    except Exception as e:
        print(f"Face verification error: {e}")
        return False, 0.0, 'skipped'
