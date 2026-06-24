import re
import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas

# Dimensions for A4: 595.27 x 841.89 points
# Left/Right margins: 54, Usable width: 595.27 - 108 = 487.27
USABLE_WIDTH = 487.27

class NumberedCanvas(canvas.Canvas):
    """Custom canvas to add dynamic headers and footers with page numbering."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        # Header (on pages after page 1)
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#0F172A"))
            self.drawString(54, 800, "CALTRACK / QUICKTIMS — TESTING HANDOVER DOCUMENT")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 792, 541, 792)  # width matches usable width

        # Footer
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawRightString(541, 36, f"Page {self._pageNumber} of {page_count}")
        self.drawString(54, 36, "CONFIDENTIAL — FOR INTERNAL QA TESTING ONLY")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 48, 541, 48)


def escape_xml(text):
    """Escapes raw <, >, and & symbols that are not part of valid HTML formatting tags."""
    # Standardize all line breaks to <br/> (ReportLab paraparser requires self-closed tag)
    text = text.replace('<br>', '<br/>')
    text = text.replace('<BR>', '<br/>')

    # Temporarily hide valid HTML tags with unique placeholders
    # We support <b>, <i>, <u>, <br/>, <para>, <font>, and <a> tags.
    tags = [
        ("<b>", "___B_OPEN___"),
        ("</b>", "___B_CLOSE___"),
        ("<i>", "___I_OPEN___"),
        ("</i>", "___I_CLOSE___"),
        ("<u>", "___U_OPEN___"),
        ("</u>", "___U_CLOSE___"),
        ("<br/>", "___BR___"),
        ("<para>", "___PARA_OPEN___"),
        ("</para>", "___PARA_CLOSE___"),
    ]
    
    for tag, placeholder in tags:
        text = text.replace(tag, placeholder)
        
    # Handle font tags: <font ...> and </font>
    font_opens = re.findall(r'<font\s+[^>]*>', text, re.IGNORECASE)
    for idx, fo in enumerate(font_opens):
        text = text.replace(fo, f'___FONT_OPEN_{idx}___')
    text = text.replace('</font>', '___FONT_CLOSE___')
    text = text.replace('</FONT>', '___FONT_CLOSE___')
    
    # Handle anchor tags: <a ...> and </a>
    a_opens = re.findall(r'<a\s+[^>]*>', text, re.IGNORECASE)
    for idx, ao in enumerate(a_opens):
        text = text.replace(ao, f'___A_OPEN_{idx}___')
    text = text.replace('</a>', '___A_CLOSE___')
    text = text.replace('</A>', '___A_CLOSE___')
    
    # Escape actual XML entities in raw text
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    
    # Restore tags
    for idx, ao in enumerate(a_opens):
        text = text.replace(f'___A_OPEN_{idx}___', ao)
    text = text.replace('___A_CLOSE___', '</a>')
    
    for idx, fo in enumerate(font_opens):
        text = text.replace(f'___FONT_OPEN_{idx}___', fo)
    text = text.replace('___FONT_CLOSE___', '</font>')
    
    for tag, placeholder in tags:
        text = text.replace(placeholder, tag)
        
    return text


def clean_markdown_formatting(text):
    """Replaces markdown bold, italics, links, and inline code with ReportLab HTML-like tags."""
    # LaTeX representations to clean text
    text = text.replace('$$\\text{Reimbursement} = \\text{Distance (miles)} \\times \\text{rate\\_per\\_mile\\_usd} \\quad (\\text{default: } \\$0.67/\\text{mile})$$', '<b>Reimbursement = Distance (miles) × rate_per_mile_usd</b> (default: $0.67/mile)')
    text = text.replace('$$\\text{Reimbursement} = \\text{Distance (km)} \\times \\text{rate\\_per\\_km\\_inr} \\quad (\\text{default: } ₹3.50/\\text{km})$$', '<b>Reimbursement = Distance (km) × rate_per_km_inr</b> (default: ₹3.50/km)')
    text = text.replace('$$\\text{Reimbursement} = \\text{Basic} + \\text{HRA}$$', '<b>Gross Salary = Basic + HRA</b>')
    text = text.replace('$$\\text{Deductions} = \\text{PF} + \\text{ESI}$$', '<b>Deductions = PF + ESI</b>')
    text = text.replace('$$\\text{Net Salary} = \\text{Gross Salary} - \\text{Deductions} + \\text{Mileage Reimbursement}$$', '<b>Net Salary = Gross Salary - Deductions + Mileage Reimbursement</b>')
    
    text = text.replace('$\\le$', '≤')
    text = text.replace('$\\ge$', '≥')
    text = text.replace('$\\rightarrow$', '→')
    
    # Bold markdown (**text**) -> ReportLab <b>text</b>
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    # Italics markdown (*text*) -> ReportLab <i>text</i>
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
    # Inline code (`text`) -> ReportLab Courier
    text = re.sub(r'`(.*?)`', r'<font face="Courier" color="#E94560">\1</font>', text)
    # Markdown Links -> ReportLab <a>
    text = re.sub(r'\[(.*?)\]\((.*?)\)', r'<a href="\2"><font color="#2563EB"><u>\1</u></font></a>', text)
    
    # Escape any remaining XML symbols safely
    return escape_xml(text)


def build_pdf(md_path, pdf_path):
    # Load styles
    styles = getSampleStyleSheet()
    normal_style = styles['Normal']
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=normal_style,
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=15,
        alignment=TA_CENTER
    )
    
    h2_style = ParagraphStyle(
        'DocH2',
        parent=normal_style,
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )
    
    h3_style = ParagraphStyle(
        'DocH3',
        parent=normal_style,
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor('#2563EB'),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'DocBody',
        parent=normal_style,
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6,
        alignment=TA_LEFT
    )

    bullet_style = ParagraphStyle(
        'DocBullet',
        parent=normal_style,
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    indent_bullet_style = ParagraphStyle(
        'DocIndentBullet',
        parent=normal_style,
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        leftIndent=25,
        firstLineIndent=-10,
        spaceAfter=3
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=normal_style,
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.white,
        alignment=TA_CENTER
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=normal_style,
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#334155')
    )

    table_cell_bold_style = ParagraphStyle(
        'TableCellBold',
        parent=normal_style,
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#0F172A')
    )

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=72,
        bottomMargin=72
    )

    flowables = []
    
    # Read and preprocess Markdown file to handle blockquotes and alerts nicely
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    raw_lines = content.splitlines()
    lines = []
    current_bq = []
    bq_type = None

    for line in raw_lines:
        stripped = line.strip()
        if stripped.startswith('>'):
            bq_content = stripped.lstrip('>').strip()
            alert_match = re.match(r'^\[!(IMPORTANT|TIP|NOTE|WARNING|CAUTION)\]', bq_content, re.IGNORECASE)
            if alert_match:
                bq_type = alert_match.group(1).upper()
            else:
                current_bq.append(bq_content)
        else:
            if current_bq or bq_type:
                bq_text = " ".join(current_bq)
                if bq_type:
                    lines.append(f"**{bq_type}:** {bq_text}")
                else:
                    lines.append(f"*{bq_text}*")
                lines.append("")
                current_bq = []
                bq_type = None
            lines.append(line)

    if current_bq or bq_type:
        bq_text = " ".join(current_bq)
        if bq_type:
            lines.append(f"**{bq_type}:** {bq_text}")
        else:
            lines.append(f"*{bq_text}*")

    # Add back trailing newlines for the parser loop
    lines = [l + "\n" for l in lines]

    current_paragraph = []
    in_table = False
    table_rows = []

    for line in lines:
        stripped = line.strip()
        
        # 1. Handle Table Parsing
        if stripped.startswith('|'):
            if not in_table:
                # Flush previous paragraph if any
                if current_paragraph:
                    text = " ".join(current_paragraph)
                    flowables.append(Paragraph(clean_markdown_formatting(text), body_style))
                    current_paragraph = []
                in_table = True
            
            # Skip separator line (e.g. | :--- | :--- |)
            if re.match(r'^\|[\s:-|]+$', stripped):
                continue
                
            # Parse cells
            cells = [c.strip() for c in stripped.split('|')[1:-1]]
            table_rows.append(cells)
            continue
        elif in_table:
            # Table ended, compile it
            in_table = False
            if table_rows:
                num_cols = len(table_rows[0])
                # Distribute columns
                if num_cols == 3:
                    col_widths = [120, 180, 187.27]
                elif num_cols == 2:
                    col_widths = [150, 337.27]
                else:
                    col_widths = [USABLE_WIDTH / num_cols] * num_cols
                
                formatted_rows = []
                # First row is header
                header_row = [Paragraph(clean_markdown_formatting(cell), table_header_style) for cell in table_rows[0]]
                formatted_rows.append(header_row)
                
                # Subsequent rows
                for r_idx, row in enumerate(table_rows[1:], start=1):
                    formatted_row = []
                    for c_idx, cell in enumerate(row):
                        # Use bold style for first column parameters typically
                        c_style = table_cell_bold_style if c_idx == 0 else table_cell_style
                        formatted_row.append(Paragraph(clean_markdown_formatting(cell), c_style))
                    formatted_rows.append(formatted_row)
                
                t = Table(formatted_rows, colWidths=col_widths)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F1F5F9')])
                ]))
                flowables.append(Spacer(1, 4))
                flowables.append(t)
                flowables.append(Spacer(1, 8))
            table_rows = []
            
        # 2. Handle standard markdown elements
        if not stripped:
            if current_paragraph:
                text = " ".join(current_paragraph)
                flowables.append(Paragraph(clean_markdown_formatting(text), body_style))
                current_paragraph = []
            continue
            
        # H1 title
        if stripped.startswith('# '):
            if current_paragraph:
                text = " ".join(current_paragraph)
                flowables.append(Paragraph(clean_markdown_formatting(text), body_style))
                current_paragraph = []
            title_text = stripped[2:]
            flowables.append(Paragraph(clean_markdown_formatting(title_text), title_style))
            flowables.append(Spacer(1, 10))
            continue
            
        # H2 section
        if stripped.startswith('## '):
            if current_paragraph:
                text = " ".join(current_paragraph)
                flowables.append(Paragraph(clean_markdown_formatting(text), body_style))
                current_paragraph = []
            h2_text = stripped[3:]
            # Inject page breaks for logical document flow
            if h2_text in ["3. Onboarding & Employee Verification (Activation Journey)", "4. Time Tracking & Geofencing Engine", "6. Mileage Tracking & Reimbursement", "8. Payroll Engine", "9. Testing Checklist for QA"]:
                flowables.append(PageBreak())
            flowables.append(Paragraph(clean_markdown_formatting(h2_text), h2_style))
            continue
            
        # H3 sub-section
        if stripped.startswith('### '):
            if current_paragraph:
                text = " ".join(current_paragraph)
                flowables.append(Paragraph(clean_markdown_formatting(text), body_style))
                current_paragraph = []
            h3_text = stripped[4:]
            flowables.append(Paragraph(clean_markdown_formatting(h3_text), h3_style))
            continue

        # Horizontal divider
        if stripped == '---':
            if current_paragraph:
                text = " ".join(current_paragraph)
                flowables.append(Paragraph(clean_markdown_formatting(text), body_style))
                current_paragraph = []
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceBefore=8, spaceAfter=8))
            continue

        # Checklist and bullet items
        is_bullet = stripped.startswith('* ') or stripped.startswith('- ')
        is_indented_bullet = line.startswith('  * ') or line.startswith('  - ') or line.startswith('\t* ') or line.startswith('\t- ')
        
        if is_indented_bullet:
            if current_paragraph:
                text = " ".join(current_paragraph)
                flowables.append(Paragraph(clean_markdown_formatting(text), body_style))
                current_paragraph = []
            bullet_text = stripped[2:]
            # Checkbox conversion
            if bullet_text.startswith('[ ] '):
                bullet_text = "☐ " + bullet_text[4:]
            elif bullet_text.startswith('[x] '):
                bullet_text = "☑ " + bullet_text[4:]
            else:
                bullet_text = "• " + bullet_text
            flowables.append(Paragraph(clean_markdown_formatting(bullet_text), indent_bullet_style))
            continue
            
        if is_bullet:
            if current_paragraph:
                text = " ".join(current_paragraph)
                flowables.append(Paragraph(clean_markdown_formatting(text), body_style))
                current_paragraph = []
            bullet_text = stripped[2:]
            # Checkbox conversion
            if bullet_text.startswith('[ ] '):
                bullet_text = "☐ " + bullet_text[4:]
            elif bullet_text.startswith('[x] '):
                bullet_text = "☑ " + bullet_text[4:]
            else:
                bullet_text = "• " + bullet_text
            flowables.append(Paragraph(clean_markdown_formatting(bullet_text), bullet_style))
            continue

        # standard text lines: accumulate
        current_paragraph.append(stripped)

    # Flush remaining table or paragraph
    if in_table and table_rows:
        num_cols = len(table_rows[0])
        col_widths = [USABLE_WIDTH / num_cols] * num_cols
        formatted_rows = [[Paragraph(clean_markdown_formatting(cell), table_cell_style) for cell in row] for row in table_rows]
        t = Table(formatted_rows, colWidths=col_widths)
        t.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#F1F5F9')])
        ]))
        flowables.append(t)
    elif current_paragraph:
        text = " ".join(current_paragraph)
        flowables.append(Paragraph(clean_markdown_formatting(text), body_style))

    # Build document using NumberedCanvas
    doc.build(flowables, canvasmaker=NumberedCanvas)


if __name__ == '__main__':
    md_file = sys.argv[1]
    pdf_file = sys.argv[2]
    build_pdf(md_file, pdf_file)
    print("PDF build completed successfully.")
