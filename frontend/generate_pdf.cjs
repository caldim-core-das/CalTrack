const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ size: 'A4', margin: 50 });
const path = 'C:/Users/user/.gemini/antigravity-ide/brain/348b3355-b088-4545-892b-e241eff3b6c2/Caldim_Workflow.pdf';
doc.pipe(fs.createWriteStream(path));

doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a');
doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(32).text('CALDIM', { align: 'center' });
doc.fontSize(14).fillColor('#f59e0b').text('ENGINEERING PRIVATE LIMITED', { align: 'center' });
doc.moveDown(2);

doc.fillColor('#ffffff').fontSize(24).text('AUTOMATE. STREAMLINE. GROW.', { align: 'center' });
doc.moveDown(1);
doc.fontSize(12).fillColor('#94a3b8').text('Custom web applications and intelligent automation built around your workflow - so your team spends time on what matters, not manual tasks.', { align: 'center' });
doc.moveDown(3);

doc.fontSize(18).fillColor('#ffffff').text('AUTOMATION SOLUTIONS FOR EVERY WORKFLOW', { underline: true });
doc.moveDown(1);

const solutions = [
  { tag: 'HR & HIRE', title: 'RECRUITMENT & HR AUTOMATION', desc: 'Candidate pipelines, skill-matrix matching, onboarding workflows, and leave management.' },
  { tag: 'TIME & ATT', title: 'WORKFORCE & TIME TRACKING', desc: 'Timesheets, geofence attendance, face verification, payroll sync, and mobile-first entry.' },
  { tag: 'PROJ MGT', title: 'PROJECT & TASK MANAGEMENT', desc: 'Bid-to-completion tracking, proposals, invoicing, KPIs, scope control, and dashboards.' },
  { tag: 'ASST OPS', title: 'ASSET & INVENTORY MANAGEMENT', desc: 'QR tracking, maintenance scheduling, stock monitoring, depreciation, and valuation.' },
  { tag: 'BUY & SCM', title: 'PROCUREMENT & SUPPLY CHAIN', desc: 'AI vendor ranking, RFQ tracking, PO automation, logistics coordination, and spend analytics.' },
  { tag: 'CUST APP', title: 'CUSTOM WEB APPLICATIONS', desc: 'Portals, dashboards, approval workflows, CRMs, estimators - built exactly around your process.' }
];

solutions.forEach(sol => {
  doc.fillColor('#f59e0b').fontSize(14).text(sol.tag + ' - ' + sol.title);
  doc.fillColor('#cbd5e1').fontSize(10).text(sol.desc);
  doc.moveDown(1);
});

doc.end();
