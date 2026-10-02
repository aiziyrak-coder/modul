const { ErrorHandler } = require("#shared/error");
"use strict";

const PDFDocument = require("pdfkit");
const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const { registerCyrillicFonts } = require("#shared/pdfGenerators/pdfHelpers");
const { academicYearLabel } = require("./academicYearLabel");
const { classTypeLabel } = require("#modules/4.02-studyLoad/workloadDistribution/classTypeSplit");
const { resolveSignatory } = require("#modules/4.02-studyLoad/_shared/signatories");
const {
  drawSignatureBlock,
  measureSignatureBlock,
} = require("#modules/4.02-studyLoad/_shared/signatureBlock");

const ERI_GAP_TEXT = "(ERI bilan imzolangan)";
const eriGapText = (sig) =>
  sig && (sig.source === "snapshot" || sig.source === "chain") ? ERI_GAP_TEXT : undefined;
const { buildHeaderSpans } = require("#modules/4.02-studyLoad/_shared/headerSpans");
const {
  prepareVerifyQr,
  QR_SIZE_SLOT,
  QR_SIZE_ROW,
} = require("#modules/4.02-studyLoad/_shared/verifyQr");

const {
  ctStream,
  ctTotal,
  itemVal,
  WORK_CANONICAL,
} = require("#shared/particleHelpers");

const {
  findStaffItem,
  getOverallTotals,
  averageLoad,
} = require("#modules/4.02-studyLoad/_shared/staffPositionItems");

const { fmtNum, fmtDocDate } = require("#modules/4.02-studyLoad/_shared/pdfFormat");

const { deriveStaffPositions } = require("#modules/4.02-studyLoad/_shared/derivedStaffPositions");
const { resolvePositionSlug } = require("#modules/4.02-studyLoad/_shared/positionSlug");
const Position = require("#references/position/position.model");
const winston = require("#shared/winston.logger");

const PG = { W: 842, H: 595, M: 18 };
const CW = PG.W - PG.M * 2;

const C = {
  text: "#000000",
  muted: "#444444",
  border: "#000000",
};

const COLS = [
  { key: "science", w: 210, hdr: "Fanning nomi", infoSpan: true },
  { key: "course", w: 24, hdr: "kurs", infoSpan: true },
  { key: "student", w: 30, hdr: "Talabalar soni", infoSpan: true },
  { key: "group", w: 30, hdr: "Guruh soni", infoSpan: true },
  { key: "subGroup", w: 30, hdr: "Guruhchalar soni", infoSpan: true },
  { key: "stream", w: 24, hdr: "Oqim soni", infoSpan: true },
  { key: "semester", w: 24, hdr: "Semestr", infoSpan: true },
  { key: "semTotal", w: 36, hdr: "Umumiy soat", grp1: "oQuv", grp2: "mazkur" },
  { key: "semAud", w: 36, hdr: "Auditoriya", grp1: "oQuv", grp2: "mazkur" },
  { key: "lectStr", w: 28, hdr: "Bir oqimga", grp1: "oQuv", grp2: "maruza" },
  { key: "lectTot", w: 32, hdr: "Jami", grp1: "oQuv", grp2: "maruza" },
  { key: "clinStr", w: 28, hdr: "Bir oqimga", grp1: "oQuv", grp2: "klinik" },
  { key: "clinTot", w: 32, hdr: "Jami", grp1: "oQuv", grp2: "klinik" },
  { key: "labStr", w: 26, hdr: "Bir oqimga", grp1: "oQuv", grp2: "lab" },
  {
    key: "pratStr",
    w: 28,
    hdr: "Amaliy (sem.) mashg'",
    grp1: "oQuv",
    grp2: "lab",
  },
  { key: "labTot", w: 28, hdr: "Jami", grp1: "oQuv", grp2: "lab" },
  { key: "on", w: 30, hdr: "ON(1 tal. 0.2 soat)", grp1: "oQuv", grp2: null },
  { key: "yan", w: 30, hdr: "YN(1 tal. 0.3 soat)", grp1: "oQuv", grp2: null },
  {
    key: "missed",
    w: 30,
    hdr: "Qoldir.dars Qayta topsh. Qab.qil.",
    grp1: "oQuv",
    grp2: null,
  },
  {
    key: "skilled",
    w: 30,
    hdr: "Malakaviy amaliyot",
    grp1: "oQuv",
    grp2: null,
  },
  { key: "total", w: 40, hdr: "Jami soat", grp1: "jami", spanRows: true },
];

const COL_X = (() => {
  const xs = [PG.M];
  for (const c of COLS) xs.push(xs[xs.length - 1] + c.w);
  return xs;
})();

function san(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return san(v.uz || v.ru || v.en || v.title || "");
  return String(v)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function bdr(doc, x, y, w, h, fill, lw = 0.3) {
  if (fill) doc.rect(x, y, w, h).fill(fill);
  doc.rect(x, y, w, h).strokeColor(C.border).lineWidth(lw).stroke();
}

function ct(doc, text, x, y, w, h, opts = {}) {
  const { fs = 7, bold = false, color = C.text, align = "center" } = opts;
  const font = bold ? "Helvetica-Bold" : "Helvetica";
  const str = san(text);
  doc.font(font).fontSize(fs);
  const textH = doc.heightOfString(str, { width: w - 2, align });
  const ty = y + Math.max(0, (h - textH) / 2);
  doc.fillColor(color).text(str, x + 1, ty, {
    width: w - 2,
    height: h,
    align,
    lineBreak: true,
  });
}

function measureCell(doc, text, w, opts = {}) {
  const { fs = 7, bold = false, align = "center" } = opts;
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fs);
  return doc.heightOfString(san(text), { width: w - 2, align });
}

function ctUp(doc, text, x, y, w, h, opts = {}) {
  const { fs = 5.5, bold = false, color = C.text } = opts;
  const font = bold ? "Helvetica-Bold" : "Helvetica";
  doc.save();
  doc.translate(x + w / 2, y + h / 2);
  doc.rotate(-90);
  doc
    .font(font)
    .fontSize(fs)
    .fillColor(color)
    .text(san(text), -(h / 2) + 2, -(w / 2) + 1, {
      width: h - 4,
      align: "center",
      lineBreak: true,
    });
  doc.restore();
}

function checkPage(doc, y, needed = 25) {
  if (y + needed > PG.H - PG.M - 15) {
    doc.addPage();
    return PG.M;
  }
  return y;
}

function drawConfirmationHeader(doc, dist, qr = null) {
  const conf = dist.confirmation || {};
  const SIDE_W = 210;
  const rX = PG.M + CW - SIDE_W;
  const rY0 = PG.M + 4;

  const confSig = resolveSignatory(dist, {
    step: "prorektor",
    block: "confirmation",
    personField: "rector",
    snapshot: dist.verify?.snapshot,
  });

  const rH = drawSignatureBlock(doc, {
    x: rX,
    y: rY0,
    w: SIDE_W,
    align: "center",
    heading: `"${conf.confirm || "TASDIQLAYMAN"}"`,
    position: conf.position || "O'quv ishlari bo'yicha prorektor",
    sig: confSig,
    gapText: eriGapText(confSig),
    qr: qr ? { image: qr.image, size: QR_SIZE_SLOT } : undefined,
  });

  return rY0 + rH + 4 - PG.M;
}

function drawDocTitle(doc, y, dist) {
  const depTitle = san(dist.department?.title) || "Kafedra";
  const title =
    san(dist.title) ||
    (/kafedra(si)?$/i.test(depTitle.trim()) ? depTitle : `${depTitle} kafedrasi`);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(C.text)
    .text(`"${title}"`, PG.M, y, {
      width: CW,
      align: "center",
      lineBreak: true,
    });
  y = doc.y + 2;

  if (dist.date) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(C.muted)
      .text(`${fmtDocDate(dist.date)} holatiga`, PG.M, y, {
        width: CW,
        align: "right",
        lineBreak: false,
      });
    y = doc.y + 4;
  }
  return y;
}

const HDR1_MIN = 11;
const HDR2_MIN = 10;
const HDR3_MIN = 58;

function measureHeaderHeights(doc) {
  const measure = (text, w, fs) => {
    doc.font("Helvetica-Bold").fontSize(fs);
    return doc.heightOfString(san(text), { width: w - 4, align: "center" });
  };
  const grp1Spans = HEADER_SPANS.grp1.filter((s) => s.value !== "jami");
  const HDR1_H = Math.max(
    HDR1_MIN,
    ...grp1Spans.map((s) => {
      const meta = GRP1_LABELS[s.value] || { text: "", fs: 6.5 };
      return Math.ceil(measure(meta.text, COL_X[s.to] - COL_X[s.from], meta.fs)) + 2;
    }),
  );
  const HDR2_H = Math.max(
    HDR2_MIN,
    ...HEADER_SPANS.grp2.map((s) =>
      Math.ceil(measure(GRP2_LABELS[s.value] || "", COL_X[s.to] - COL_X[s.from], 5)) + 2,
    ),
  );
  let HDR3_H = HDR3_MIN;
  const rotated = COLS.filter((c) => !c.infoSpan && !c.spanRows);
  const fits = (h) =>
    rotated.every((c) => {
      doc.font("Helvetica").fontSize(5.5);
      return doc.heightOfString(san(c.hdr), { width: h - 4, align: "center" }) <= c.w - 2;
    });
  while (!fits(HDR3_H) && HDR3_H < 140) HDR3_H += 6;
  return { HDR1_H, HDR2_H, HDR3_H, TOTAL_HDR_H: HDR1_H + HDR2_H + HDR3_H };
}

const GRP1_LABELS = {
  oQuv: { text: "O'quv ishlari (bakalavriatura)", fs: 6.5 },
};
const GRP2_LABELS = {
  mazkur: "Mazkur semestr uchun",
  maruza: "Ma'ruza",
  klinik: "Klinik o'quv amaliyoti",
  lab: "Lab.mashg'. Klinik amal.",
};
const HEADER_SPANS = buildHeaderSpans(COLS);

function drawTableHeader(doc, y) {
  const { HDR1_H, HDR2_H, HDR3_H, TOTAL_HDR_H } = measureHeaderHeights(doc);
  for (let i = 0; i < COLS.length; i++) {
    bdr(doc, COL_X[i], y, COLS[i].w, HDR1_H, null, 0.3);

    bdr(doc, COL_X[i], y + HDR1_H, COLS[i].w, HDR2_H, null, 0.3);

    if (!COLS[i].infoSpan && !COLS[i].spanRows) {
      bdr(doc, COL_X[i], y + HDR1_H + HDR2_H, COLS[i].w, HDR3_H, null, 0.3);
      ctUp(doc, COLS[i].hdr, COL_X[i], y + HDR1_H + HDR2_H, COLS[i].w, HDR3_H, {
        fs: 5.5,
        color: C.text,
      });
    }
  }

  for (let i = 0; i < 7; i++) {
    bdr(doc, COL_X[i], y, COLS[i].w, TOTAL_HDR_H, null, 0.4);
    ctUp(doc, COLS[i].hdr, COL_X[i], y, COLS[i].w, TOTAL_HDR_H, {
      fs: i === 0 ? 6.5 : 5.5,
      color: C.text,
    });
  }

  const grp1Spans = HEADER_SPANS.grp1.filter((s) => s.value !== "jami");
  for (const span of grp1Spans) {
    const meta = GRP1_LABELS[span.value] || { text: "", fs: 6.5 };
    const x1 = COL_X[span.from],
      x2 = COL_X[span.to];
    bdr(doc, x1, y, x2 - x1, HDR1_H, null, 0.4);
    ct(doc, meta.text, x1, y, x2 - x1, HDR1_H, {
      fs: meta.fs,
      bold: true,
      color: C.text,
    });
  }

  {
    const lastIdx = COLS.length - 1;
    bdr(doc, COL_X[lastIdx], y, COLS[lastIdx].w, TOTAL_HDR_H, null, 0.5);
    ctUp(doc, "Jami soat", COL_X[lastIdx], y, COLS[lastIdx].w, TOTAL_HDR_H, {
      fs: 6.5,
      bold: true,
      color: C.text,
    });
  }

  for (const span of HEADER_SPANS.grp2) {
    const label = GRP2_LABELS[span.value] || "";
    const x1 = COL_X[span.from],
      x2 = COL_X[span.to];
    bdr(doc, x1, y + HDR1_H, x2 - x1, HDR2_H, null, 0.4);
    ct(doc, label, x1, y + HDR1_H, x2 - x1, HDR2_H, {
      fs: 5,
      bold: true,
      color: C.text,
    });
  }

  return y + TOTAL_HDR_H;
}

const SEC_H = 13;
const ROW_H = 12;
const JAMI_H = 12;

const POSITION_SLUG_LABEL = Object.freeze({
  professor: "Professor",
  docent: "Dotsent",
  senior_teacher: "Katta o'qituvchi",
  assistant: "Assistent",
  trainee: "Stajyor o'qituvchi",
});

function teacherLabel(t) {
  if (t.isVacant) {
    const label =
      t.vacantLabel && !/^vakant\b/i.test(t.vacantLabel.trim())
        ? `Vakant ${t.vacantLabel}`
        : t.vacantLabel || "Vakant";
    return `${label} ${t.stavka ? fmtNum(t.stavka) + " st." : ""}${t.specialization ? " (" + t.specialization + ")" : ""}`;
  }
  const tchr = t.teacher;
  if (!tchr) return "—";
  const last = tchr.lastName || "";
  const fInit = tchr.firstName ? tchr.firstName[0] + "." : "";
  const mInit = tchr.middleName ? tchr.middleName[0] + "." : "";
  const name = `${last} ${fInit}${mInit}`.trim();
  const pos = POSITION_SLUG_LABEL[t.position] || (typeof t.position === "string" ? t.position : "");
  const spec = t.specialization ? `(${t.specialization})` : "";
  const stv = t.stavka != null ? `${fmtNum(t.stavka)} st.` : "";
  const phone = t.phone || tchr.phone || "";
  const ph = phone ? `  ${phone}` : "";
  return [name, stv, pos, spec, ph].filter(Boolean).join("  ");
}

function measureSectionRow(doc, text) {
  const h = measureCell(doc, text, CW - 4, { fs: 7, bold: true });
  return Math.max(SEC_H, Math.ceil(h) + 4);
}

function drawSectionRow(doc, y, text) {
  const secH = measureSectionRow(doc, text);
  doc.rect(PG.M, y, CW, secH).strokeColor(C.border).lineWidth(0.5).stroke();

  ct(doc, text, PG.M + 2, y, CW - 4, secH, { fs: 7, bold: true, color: C.text });
  return y + secH;
}

function measureDataRow(doc, rowData, opts = {}) {
  const { isJami = false } = opts;
  let rowH = ROW_H;
  for (let i = 0; i < COLS.length; i++) {
    const val = rowData[COLS[i].key];
    if (val === undefined || val === null || val === "") continue;
    const h = measureCell(doc, fmtNum(val), COLS[i].w, {
      fs: i === 0 ? 6 : 6.5,
      bold: isJami,
      align: i === 0 ? "left" : "center",
    });
    rowH = Math.max(rowH, Math.ceil(h) + 2);
  }
  return rowH;
}

function drawDataRow(doc, y, rowData, opts = {}) {
  const { isJami = false } = opts;
  const bg = null;
  const fc = C.text;
  const rowH = measureDataRow(doc, rowData, opts);
  for (let i = 0; i < COLS.length; i++) {
    bdr(doc, COL_X[i], y, COLS[i].w, rowH, bg, 0.25);
    const val = rowData[COLS[i].key];
    if (val !== undefined && val !== null && val !== "") {
      const align = i === 0 ? "left" : "center";
      ct(doc, fmtNum(val), COL_X[i], y, COLS[i].w, rowH, {
        fs: i === 0 ? 6 : 6.5,
        bold: isJami,
        color: fc,
        align,
      });
    }
  }
  return y + rowH;
}

const NUM_KEYS = [
  "semTotal",
  "semAud",
  "lectStr",
  "lectTot",
  "clinStr",
  "clinTot",
  "labStr",
  "pratStr",
  "labTot",
  "on",
  "yan",
  "missed",
  "skilled",
  "total",
];

function blockToRow(block) {
  const sw = block.studyWork || {};
  const typeLabel = classTypeLabel(block);
  const scienceName =
    san(block.science?.title) ||
    san(block.science?.scienceCode) ||
    san(block.practiceTitle) ||
    "—";
  return {
    science: typeLabel ? `${scienceName} (${san(typeLabel)})` : scienceName,
    course: block.course || "",
    student: block.student || "",
    group: sw.group || "",
    subGroup: block.subGroup || "",
    stream: sw.stream || "",
    semester: sw.semester || "",
    semTotal: sw.thisSemester?.totalHour || "",
    semAud: sw.thisSemester?.auditoriumHour || "",
    lectStr: ctStream(sw, WORK_CANONICAL.LECTURE,           "lecture")           || ctStream(sw, "maruza")           || "",
    lectTot: ctTotal(sw,  WORK_CANONICAL.LECTURE,           "lecture")           || ctTotal(sw,  "maruza")           || "",
    clinStr: ctStream(sw, WORK_CANONICAL.CLINICAL_PRACTICE, "clinicalPractice")  || ctStream(sw, "klinik_amaliyot")  || "",
    clinTot: ctTotal(sw,  WORK_CANONICAL.CLINICAL_PRACTICE, "clinicalPractice")  || ctTotal(sw,  "klinik_amaliyot")  || "",
    labStr:  ctStream(sw, WORK_CANONICAL.LAB_TRAINING,      "labTraining")       || ctStream(sw, "laboratoriya")     || "",
    pratStr: ctStream(sw, WORK_CANONICAL.PRACTICAL,         "practicalExercise") || ctStream(sw, "amaliy")           || "",
    labTot:  ctTotal(sw,  WORK_CANONICAL.LAB_TRAINING,      "labTraining")       || ctTotal(sw,  "laboratoriya")     || "",
    on:      itemVal(sw,  WORK_CANONICAL.STUDENT_WORK,      "student")           || itemVal(sw,  "on")               || "",
    yan:     itemVal(sw,  WORK_CANONICAL.YAN,               "yan")               || "",
    missed:  itemVal(sw,  WORK_CANONICAL.MISSED,            "missedLesson")      || itemVal(sw,  "qoldirilgan")      || "",
    skilled: itemVal(sw,  WORK_CANONICAL.SKILLED_PRACTICE,  "skilledPractical")  || itemVal(sw,  "malakaviy")        || "",
    total: block.totalHour || "",
  };
}

function calcJami(rows) {
  const jami = {
    science: "jami:",
    course: "",
    student: "",
    group: "",
    subGroup: "",
    stream: "",
    semester: "",
  };
  for (const key of NUM_KEYS) {
    const sum = rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    jami[key] = sum || "";
  }
  return jami;
}

function drawMainTable(doc, startY, dist) {
  let y = startY;

  const redrawHeader = (atY) => {
    atY = checkPage(doc, atY, measureHeaderHeights(doc).TOTAL_HDR_H);
    return drawTableHeader(doc, atY);
  };

  y = redrawHeader(y);

  const grandTotal = {
    science: "JAMI:",
    course: "",
    student: "",
    group: "",
    subGroup: "",
    stream: "",
    semester: "",
  };
  for (const key of NUM_KEYS) grandTotal[key] = 0;

  let altIdx = 0;

  for (const t of dist.teachers || []) {
    const blocks = t.blocks || [];
    if (!blocks.length && !t.isVacant) continue;

    const secLabel = teacherLabel(t);
    y = checkPage(doc, y, measureSectionRow(doc, secLabel) + ROW_H);
    if (y === PG.M) y = redrawHeader(y);
    y = drawSectionRow(doc, y, secLabel);

    const dataRows = blocks.map((b) => blockToRow(b));

    for (const row of dataRows) {
      const rowOpts = { isAlt: altIdx % 2 !== 0 };
      y = checkPage(doc, y, measureDataRow(doc, row, rowOpts));
      if (y === PG.M) y = redrawHeader(y);
      y = drawDataRow(doc, y, row, rowOpts);
      altIdx++;
    }

    const secJami = calcJami(dataRows);
    y = checkPage(doc, y, JAMI_H);
    if (y === PG.M) y = redrawHeader(y);
    y = drawDataRow(doc, y, secJami, { isJami: true });

    for (const key of NUM_KEYS) {
      grandTotal[key] =
        (Number(grandTotal[key]) || 0) + (Number(secJami[key]) || 0);
    }
  }

  for (const key of NUM_KEYS) {
    if (!grandTotal[key]) grandTotal[key] = "";
  }
  y = checkPage(doc, y, ROW_H + 2);
  if (y === PG.M) y = redrawHeader(y);
  y += 1;
  bdr(doc, PG.M, y, CW, ROW_H, null, 0.5);
  for (let i = 0; i < COLS.length; i++) {
    doc
      .rect(COL_X[i], y, COLS[i].w, ROW_H)
      .strokeColor(C.border)
      .lineWidth(0.4)
      .stroke();
  }
  for (let i = 0; i < COLS.length; i++) {
    const val = grandTotal[COLS[i].key];
    if (val !== undefined && val !== null && val !== "") {
      ct(doc, fmtNum(val), COL_X[i], y, COLS[i].w, ROW_H, {
        fs: i === 0 ? 7.5 : 7,
        bold: true,
        color: C.text,
        align: i === 0 ? "left" : "center",
      });
    }
  }
  y += ROW_H;

  return y;
}

function drawStaffTable(doc, y, sp) {
  if (!sp) return y;

  const LBL_W = 85;
  const REST_W = CW - LBL_W;

  const GROUPS = [
    {
      label: "Kafedra mudiri",
      cols: [
        { label: "Prof.", path: "departmentHead.professor" },
        { label: "Dotsent", path: "departmentHead.docent" },
        { label: "Katta o'qituv.", path: "departmentHead.seniorTeacher" },
      ],
    },
    {
      label: "Professor o'qituvchilar",
      cols: [
        { label: "Prof.", path: "teachingStaff.professor" },
        { label: "Dotsent", path: "teachingStaff.docent" },
        { label: "Katta o'qituv.", path: "teachingStaff.seniorTeacher" },
        { label: "Assistent o'qituvchi", path: "teachingStaff.assistant" },
        { label: "Stajyor o'qituvchi", path: "teachingStaff.trainee" },
      ],
    },
    {
      label: "Jami ish o'rni",
      spanRows: true,
      cols: [
        { label: "Jami ish o'rni", path: null, isJami: true, total: "teaching" },
      ],
    },
    {
      label: "O'quv yordamchi xodimlar",
      cols: [
        { label: "Katta laborant", path: "supportStaff.seniorLaborant" },
        { label: "Laborant", path: "supportStaff.laborant" },
        { label: "Kabinet mudiri", path: "supportStaff.cabinetHead" },
        { label: "Jami ish o'rinlari", path: null, isJami: true, total: "all" },
      ],
    },
  ];

  const allLeaf = GROUPS.flatMap((g) => g.cols);
  const totalLeaf = allLeaf.length;

  const spanLeafIdx = new Set();
  {
    let li = 0;
    for (const g of GROUPS)
      for (let k = 0; k < g.cols.length; k++, li++)
        if (g.spanRows) spanLeafIdx.add(li);
  }
  const colW = Math.floor(REST_W / totalLeaf);
  const extra = REST_W - colW * totalLeaf;

  const leafXs = [PG.M + LBL_W];
  for (let i = 0; i < totalLeaf; i++) {
    leafXs.push(
      leafXs[leafXs.length - 1] + colW + (i === totalLeaf - 1 ? extra : 0),
    );
  }

  const H1 = 13,
    H2 = 14,
    ROW = 12;

  bdr(doc, PG.M, y, LBL_W, H1 + H2, null, 0.4);
  let gx = PG.M + LBL_W,
    gi = 0;
  for (const grp of GROUPS) {
    const gw = grp.cols.length * colW + (gi === GROUPS.length - 1 ? extra : 0);
    const gh = grp.spanRows ? H1 + H2 : H1;
    bdr(doc, gx, y, gw, gh, null, 0.4);
    ct(doc, grp.label, gx, y, gw, gh, { fs: 6.5, bold: true, color: C.text });
    gx += gw;
    gi++;
  }

  for (let i = 0; i < totalLeaf; i++) {
    if (spanLeafIdx.has(i)) continue;
    const lf = allLeaf[i];
    const w = colW + (i === totalLeaf - 1 ? extra : 0);
    const fc = C.text;
    bdr(doc, leafXs[i], y + H1, w, H2, null, 0.3);
    ct(doc, lf.label, leafXs[i], y + H1, w, H2, {
      fs: 5.5,
      bold: true,
      color: fc,
    });
  }
  y += H1 + H2;

  const DATA_ROWS = [
    { label: "Ish o'rinlari", field: "positions" },
    { label: "O'quv yuklama", field: "load" },
    { label: "Jami soat", field: "totalHours" },
  ];

  const getPath = (obj, path) => {
    if (!path) return null;
    const [category, slug] = path.split(".");
    return findStaffItem(obj, category, slug);
  };

  const gSums = GROUPS.map((grp) => {
    const leafs = grp.cols.filter((c) => c.path).map((c) => getPath(sp, c.path));
    return {
      positions: leafs.reduce((s, it) => s + (it?.positions || 0), 0),
      totalHours: leafs.reduce((s, it) => s + (it?.totalHours || 0), 0),
    };
  });

  const hasItems = Array.isArray(sp.items) && sp.items.length > 0;
  const cumulativeSums = (uptoGroup) => {
    const parts = gSums.slice(0, uptoGroup + 1);
    const positions = hasItems
      ? Math.round(parts.reduce((s, g) => s + g.positions, 0) * 100) / 100
      : getOverallTotals(sp).totalPositions;
    const totalHours = parts.reduce((s, g) => s + g.totalHours, 0);
    return { positions, load: averageLoad(totalHours, positions), totalHours };
  };

  for (let ri = 0; ri < DATA_ROWS.length; ri++) {
    const dr = DATA_ROWS[ri];
    const bg = null;
    y = checkPage(doc, y, ROW);

    bdr(doc, PG.M, y, LBL_W, ROW, bg, 0.3);
    ct(doc, dr.label, PG.M, y, LBL_W, ROW, {
      fs: 6.5,
      bold: ri === 2,
      color: C.text,
      align: "left",
    });

    let li = 0,
      gIdx = 0;
    for (const grp of GROUPS) {
      let sumVal = 0;
      for (const lf of grp.cols) {
        const w = colW + (li === totalLeaf - 1 ? extra : 0);
        let val = "";
        if (lf.isJami) {
          val =
            lf.total === "all" && dr.field !== "positions"
              ? ""
              : cumulativeSums(gIdx)[dr.field] || "";
        } else if (lf.path) {
          const pObj = getPath(sp, lf.path);
          val = pObj?.[dr.field] || "";
          sumVal += Number(pObj?.[dr.field]) || 0;
        }
        bdr(doc, leafXs[li], y, w, ROW, bg, 0.25);
        if (val !== "" && val !== 0) {
          ct(doc, fmtNum(val), leafXs[li], y, w, ROW, {
            fs: 6.5,
            bold: lf.isJami,
            color: C.text,
          });
        }
        li++;
      }
      gIdx++;
    }
    y += ROW;
  }

  return y;
}

function drawSignatures(doc, y, dist, qr = null) {
  const mhSig = resolveSignatory(dist, {
    step: "methodical",
    block: "methodicalHead",
    personField: "leader",
    snapshot: dist.verify?.snapshot,
  });
  const fhSig = resolveSignatory(dist, {
    step: "financial",
    block: "financialHead",
    personField: "leader",
    snapshot: dist.verify?.snapshot,
  });
  const dhSig = resolveSignatory(dist, {
    step: "kafedra",
    block: "departmentHead",
    personField: "manager",
    snapshot: dist.verify?.snapshot,
  });

  const LINE_H = 14;
  const ROW_GAP = qr ? 6 : 10;
  const rowX = PG.M + 20;
  const rowW = PG.W - 2 * PG.M - 40;
  const rows = [
    {
      x: rowX,
      w: rowW,
      layout: "row",
      position: "O'quv-uslubiy boshqarma boshlig'i:",
      sig: { ...mhSig, dateText: "" },
      statusText: ERI_GAP_TEXT,
      qr: qr ? { image: qr.image, size: QR_SIZE_ROW } : undefined,
    },
    {
      x: rowX,
      w: rowW,
      layout: "row",
      position: "Reja-moliya bo'limi boshlig'i:",
      sig: { ...fhSig, dateText: "" },
      statusText: ERI_GAP_TEXT,
      qr: qr ? { image: qr.image, size: QR_SIZE_ROW } : undefined,
    },
    {
      x: rowX,
      w: rowW,
      layout: "row",
      position: "Kafedra mudiri:",
      sig: { ...dhSig, dateText: "" },
      statusText: ERI_GAP_TEXT,
      qr: qr ? { image: qr.image, size: QR_SIZE_ROW } : undefined,
    },
  ];

  const rowsH = rows.reduce(
    (sum, opts) => sum + Math.max(LINE_H, measureSignatureBlock(doc, opts)) + ROW_GAP,
    0,
  );
  y = checkPage(doc, y, 10 + rowsH);
  y += 10;

  for (const opts of rows) {
    const rowH = drawSignatureBlock(doc, { ...opts, y });
    y += Math.max(LINE_H, rowH) + ROW_GAP;
  }

  return y;
}

function drawFooter(doc, dist) {
  const STATUS = {
    draft: "Qoralama",
    in_review: "Ko'rib chiqilmoqda",
    approved: "Tasdiqlangan",
    rejected: "Rad etildi",
  };
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const fy = PG.H - PG.M + 6;
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .moveTo(PG.M, fy - 7)
      .lineTo(PG.W - PG.M, fy - 7)
      .strokeColor(C.border)
      .lineWidth(0.3)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(6)
      .fillColor(C.muted)
      .text(
        `Yuklama taqsimoti | ${academicYearLabel(dist.academicYear)} | ${STATUS[dist.status] || ""}`,
        PG.M,
        fy - 2,
        { width: CW - 35, align: "left", lineBreak: false },
      );
    doc
      .font("Helvetica")
      .fontSize(6)
      .fillColor(C.muted)
      .text(
        `${i - range.start + 1} / ${range.count}`,
        PG.W - PG.M - 30,
        fy - 2,
        { width: 30, align: "right", lineBreak: false },
      );
    doc.page.margins.bottom = bottomMargin;
  }
}

async function buildDistributionPdf(id) {
  const dist = await WorkloadDistribution.findById(id)
    .populate("workload", "academicYear date title staffPositions")
    .populate("department", "title")
    .populate("teachers.teacher", "firstName lastName middleName position phone")
    .populate("teachers.blocks.science", "title scienceCode")
    .populate("approvalSteps.approvedBy", "firstName lastName middleName")
    .populate("confirmation.rector", "firstName lastName middleName")
    .populate("methodicalHead.leader", "firstName lastName middleName")
    .populate("financialHead.leader", "firstName lastName middleName")
    .populate("departmentHead.manager", "firstName lastName middleName")
    .populate("academicYear", "title")

    .exec();

  if (!dist) throw new Error("Taqsimot topilmadi");

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: PG.M, bottom: PG.M, left: PG.M, right: PG.M },
    info: { Creator: "Institut AIS", Producer: "PDFKit" },
    bufferPages: true,
  });
  registerCyrillicFonts(doc);

  const verifyQr = await prepareVerifyQr(dist, { docType: "distribution" });

  const hdrH = drawConfirmationHeader(doc, dist, verifyQr);
  let y = PG.M + hdrH + 8;

  y = drawDocTitle(doc, y, dist);
  y += 4;

  y = drawMainTable(doc, y, dist);
  y += 8;

  const ownItems = dist.staffPositions && Array.isArray(dist.staffPositions.items)
    ? dist.staffPositions.items
    : [];
  const wlSp = dist.workload && typeof dist.workload === "object" ? dist.workload.staffPositions : null;
  const manualSourceSp = ownItems.length ? dist.staffPositions : wlSp || dist.staffPositions;
  const manualItems =
    manualSourceSp && Array.isArray(manualSourceSp.items) ? manualSourceSp.items : [];

  const hasAssignableTeacher = (dist.teachers || []).some(
    (t) => t && !t.isVacant && Array.isArray(t.blocks) && t.blocks.length > 0,
  );
  let derived = null;
  if (hasAssignableTeacher) {
    const positionDocs = await Position.find({ active: true })
      .select("title annualHours date")
      .lean();
    const sorted = [...(positionDocs || [])].sort(
      (a, b) => new Date(a.date || 0) - new Date(b.date || 0),
    );
    const bySlug = new Map();
    let duplicateWarned = false;
    for (const p of sorted) {
      const slug = resolvePositionSlug(p.title);
      if (!slug) continue;
      if (bySlug.has(slug) && !duplicateWarned) {
        winston.warn(
          `[distribution.pdf] "${slug}" normasiga bir nechta "position" yozuvi mos keldi — eng yangi "date" ishlatiladi`,
        );
        duplicateWarned = true;
      }
      bySlug.set(slug, Number(p.annualHours) || 0);
    }
    derived = deriveStaffPositions({
      teachers: dist.teachers,
      positionNorms: Object.fromEntries(bySlug),
      manualItems,
    });
  }

  const staffSource = derived || manualSourceSp;
  if (staffSource) {
    y = checkPage(doc, y, 80);
    y += 4;
    y = drawStaffTable(doc, y, staffSource);
    y += 8;

    if (derived) {
      const unclassified = derived.meta?.unclassified || { positions: 0, totalHours: 0 };
      const vacantHours = derived.meta?.vacantHours || 0;
      y = checkPage(doc, y, 8);
      doc
        .font("Helvetica-Oblique")
        .fontSize(6)
        .fillColor(C.muted)
        .text("Kadrlar jadvali taqsimot biriktirishidan hisoblangan", PG.M, y, {
          width: CW,
          align: "left",
          lineBreak: false,
        });
      y += 8;
      if (unclassified.positions || unclassified.totalHours) {
        y = checkPage(doc, y, 8);
        doc
          .font("Helvetica-Oblique")
          .fontSize(6)
          .fillColor(C.muted)
          .text(
            `Lavozimi aniqlanmagan: ${fmtNum(unclassified.positions)} st. / ${unclassified.totalHours} soat`,
            PG.M,
            y,
            { width: CW, align: "left", lineBreak: false },
          );
        y += 8;
      }
      if (vacantHours) {
        y = checkPage(doc, y, 8);
        doc
          .font("Helvetica-Oblique")
          .fontSize(6)
          .fillColor(C.muted)
          .text(`Vakant: ${vacantHours} soat`, PG.M, y, {
            width: CW,
            align: "left",
            lineBreak: false,
          });
        y += 8;
      }
    }
  }

  y = drawSignatures(doc, y, dist, verifyQr);

  drawFooter(doc, dist);
  doc.flushPages();

  return doc;
}

async function generateDistributionPdf(req, res, next) {
  try {
    const doc = await buildDistributionPdf(req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="taqsimot-${req.params.id}.pdf"`,
    );
    doc.pipe(res);
    doc.end();
  } catch (err) {
    return next(new ErrorHandler(400, "Bayonnoma PDF yaratishda xatolik", err.message));
  }
}

module.exports = { generateDistributionPdf, buildDistributionPdf };
module.exports.COLS = COLS;
module.exports.GRP1_LABELS = GRP1_LABELS;
module.exports.GRP2_LABELS = GRP2_LABELS;
module.exports.teacherLabel = teacherLabel;
