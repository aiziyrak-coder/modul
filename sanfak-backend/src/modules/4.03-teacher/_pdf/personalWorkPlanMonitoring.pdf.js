"use strict";
const {
  createDoc,
  drawHeader,
  drawTitle,
  drawInfoCard,
  drawTable,
  ensureSpace,
  PAGE,
  CONTENT_WIDTH,
  COLORS,
} = require("#shared/pdfGenerators/pdfHelpers");

const PLAN_STATUS_LABELS = {
  draft: "Qoralama",
  submitted: "Yuborilgan",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
  completed: "Yakunlangan",
};

const MONITORING_COLUMNS = [
  { header: "№", key: "no", width: 0.4 },
  { header: "F.I.SH", key: "name", width: 2.3, align: "left" },
  { header: "Kafedra", key: "department", width: 1.6, align: "left" },
  { header: "O'quv yili", key: "academicYear", width: 1 },
  { header: "Reja holati", key: "status", width: 1.2 },
  { header: "Rejalangan", key: "total", width: 0.9 },
  { header: "Bajarilgan", key: "completed", width: 0.9 },
  { header: "Bajarilish %", key: "percent", width: 1 },
  { header: "Kechikkan", key: "overdue", width: 0.9 },
];

function monitoringPdfRow(r, i) {
  return {
    no: i + 1,
    name: r.teacherName || "—",
    department: r.department?.title || "—",
    academicYear: r.academicYear?.title || "—",
    status: PLAN_STATUS_LABELS[r.submitStatus] || r.submitStatus || "—",
    total: r.totalItems,
    completed: r.completedItems,
    percent: `${r.completionPercent}%`,
    overdue: r.overdueCount,
  };
}

function drawReportFooter(doc, label) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const footerY = PAGE.height - PAGE.margin + 5;
    doc
      .moveTo(PAGE.margin, footerY - 8)
      .lineTo(PAGE.width - PAGE.margin, footerY - 8)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(label, PAGE.margin, footerY - 2, {
        width: CONTENT_WIDTH - 60,
        align: "left",
      })
      .text(
        `${i - range.start + 1} / ${range.count}`,
        PAGE.width - PAGE.margin - 55,
        footerY - 2,
        { width: 55, align: "right" },
      );
  }
}

function buildMonitoringPdf(rows, meta = {}) {
  const doc = createDoc();
  drawHeader(doc);
  drawTitle(
    doc,
    "MONITORING VA NAZORAT HISOBOTI",
    "TZ 4.3.9 — ish rejalarining bajarilishi",
  );

  drawInfoCard(doc, [
    ["Kafedra", meta.departmentTitle || "Barcha kafedralar"],
    ["O'quv yili", meta.academicYearTitle || "Barcha yillar"],
    ["Generatsiya sanasi", new Date().toLocaleDateString("uz-UZ")],
  ]);

  ensureSpace(doc, 60);
  if (!rows.length) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text("Ma'lumot topilmadi.");
  } else {
    drawTable(doc, MONITORING_COLUMNS, rows.map(monitoringPdfRow), {
      rowFontSize: 7.5,
    });
  }

  drawReportFooter(doc, "Monitoring va nazorat hisoboti");
  doc.flushPages();
  return doc;
}

module.exports = { buildMonitoringPdf, PLAN_STATUS_LABELS };
