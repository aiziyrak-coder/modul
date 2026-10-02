"use strict";

const {
  createDoc,
  drawHeader,
  drawTitle,
  drawSectionTitle,
  drawInfoCard,
  drawParagraph,
  drawTable,
  COLORS,
  PAGE,
} = require("#shared/pdfGenerators/pdfHelpers");
const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");

const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;

const uzDate = (dayKey) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || ""));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
};

const PROGRAM_LABEL = {
  ordinatura: "Klinik ordinatura",
  magistratura: "Magistratura",
};

const LESSON_TYPE_LABEL = {
  maruza: "Ma'ruza",
  amaliy: "Amaliy",
  test: "Test",
  oraliq_nazorat: "Oraliq nazorat",
  yakuniy_nazorat: "Yakuniy nazorat",
};

const MISSED_LESSON_COLUMNS = [
  { header: "Sana", key: "day", width: 1.1, align: "left" },
  { header: "Fan", key: "science", width: 2.8, align: "left" },
  { header: "Dars turi", key: "lessonType", width: 1.3, align: "left" },
  { header: "Soat", key: "hours", width: 0.6, align: "right" },
];

const missedLessonCells = (r) => ({
  day: uzDate(r.day),
  science: r.science || "—",
  lessonType: LESSON_TYPE_LABEL[r.lessonType] || r.lessonType || "—",
  hours: r.hours != null ? String(r.hours) : "—",
});

function sumHours(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows.reduce((sum, r) => sum + (Number(r?.hours) || 0), 0);
}

function drawFooterLocal(doc, text) {
  const y = PAGE.height - PAGE.margin - 24;
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text(text, PAGE.margin, y, { width: CONTENT_WIDTH, align: "center" });
}

function absenceCardRows(streak = {}, rows = [], totals = {}) {
  const periodHours = sumHours(rows);
  const window = streak.windowDays ? ` (oxirgi ${streak.windowDays} kunda)` : "";
  return [
    ["Sababsiz qoldirilgan kun", streak.days != null ? `${streak.days} kun${window}` : null],
    [
      "Tekshirilgan davr",
      streak.windowFrom && streak.windowTo
        ? `${uzDate(streak.windowFrom)} — ${uzDate(streak.windowTo)}`
        : null,
    ],

    ["Shu kunlarda qoldirilgan", periodHours != null ? `${periodHours} soat` : null],
    [
      "Jami sababsiz soat (joriy o'quv yili)",
      totals.unexcusedHours != null ? `${totals.unexcusedHours} soat` : null,
    ],

    [
      "Ostona (TZ 4.5.4)",
      `Sababsiz ${totals.warningHours ?? 6} soat — ogohlantirish · ` +
        `${totals.expulsionHours ?? 72} soat — chetlatish buyrug'i loyihasi`,
    ],
  ];
}

function buildAbsenceNoticePdf(data = {}) {
  const {
    resident = {},
    supervisor = {},
    streak = {},
    rows = [],
    totals = {},
    content = "",
    issuedAt = new Date(),
  } = data;

  return new Promise((resolve, reject) => {
    const doc = createDoc();
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      drawHeader(doc, "FARG'ONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI");
      doc.moveDown(1.2);

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.text)
        .text("Magistratura va klinik ordinatura bo'limi boshlig'iga", PAGE.margin, doc.y, {
          width: CONTENT_WIDTH,
          align: "right",
        });
      doc.moveDown(1);

      drawTitle(doc, "BILDIRGI", `Sana: ${uzDate(uzDayKey(issuedAt))}`);

      drawSectionTitle(doc, "Talaba ma'lumotlari");
      drawInfoCard(doc, [
        ["F.I.Sh", resident.fullName],
        ["Ta'lim yo'nalishi", PROGRAM_LABEL[resident.program] || resident.program],
        ["Mutaxassislik", resident.specialtyTitle],
        ["Kafedra", resident.departmentTitle],
        ["Kurs", resident.courseNumber != null ? `${resident.courseNumber}-kurs` : null],
        ["Guruh", resident.groupTitle],
      ]);

      drawSectionTitle(doc, "Qoldirish holati");
      drawInfoCard(doc, absenceCardRows(streak, rows, totals));

      if (rows.length) {
        drawSectionTitle(doc, "Qoldirilgan mashg'ulotlar");
        drawTable(doc, MISSED_LESSON_COLUMNS, rows.map(missedLessonCells));
      }

      if (String(content || "").trim()) {
        drawSectionTitle(doc, "Ustoz izohi");
        drawParagraph(doc, content);
      }

      doc.moveDown(1.5);
      const signY = doc.y;
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.text)
        .text(supervisor.position || "Klinik ustoz", PAGE.margin, signY, {
          width: CONTENT_WIDTH / 2,
        });
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(supervisor.fullName || "—", PAGE.margin + CONTENT_WIDTH / 2, signY, {
          width: CONTENT_WIDTH / 2,
          align: "right",
        });
      if (supervisor.department) {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(COLORS.muted)
          .text(supervisor.department, PAGE.margin, doc.y, { width: CONTENT_WIDTH });
      }

      drawFooterLocal(
        doc,
        "Hujjat Institut Avtomatlashtirilgan Axborot Tizimi tomonidan shakllantirildi",
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}


module.exports = {
  buildAbsenceNoticePdf,
  uzDate,
  sumHours,
  absenceCardRows,
  PROGRAM_LABEL,
  LESSON_TYPE_LABEL,
  MISSED_LESSON_COLUMNS,
  missedLessonCells,
  drawFooterLocal,
};
