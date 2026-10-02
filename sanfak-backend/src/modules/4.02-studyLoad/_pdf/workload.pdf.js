const { ErrorHandler } = require("#shared/error");
"use strict";

const PDFDocument = require("pdfkit");
const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const { registerCyrillicFonts } = require("#shared/pdfGenerators/pdfHelpers");
const { academicYearLabel } = require("./academicYearLabel");
const {
  resolveSignatory,
} = require("#modules/4.02-studyLoad/_shared/signatories");
const {
  drawSignatureBlock,
  measureSignatureBlock,
} = require("#modules/4.02-studyLoad/_shared/signatureBlock");
const {
  prepareVerifyQr,
  QR_SIZE_SLOT,
  QR_SIZE_ROW,
} = require("#modules/4.02-studyLoad/_shared/verifyQr");
const { buildHeaderSpans } = require("#modules/4.02-studyLoad/_shared/headerSpans");

const {
  ctStream,
  ctTotal,
  itemVal,
  WORK_CANONICAL,
} = require("#shared/particleHelpers");

const {
  findStaffItem,
  averageLoad,
} = require("#modules/4.02-studyLoad/_shared/staffPositionItems");

const { fmtNum, fmtDocDate } = require("#modules/4.02-studyLoad/_shared/pdfFormat");

function otherVal(ow, key, legacyKey) {
  const arr = ow && Array.isArray(ow.items) ? ow.items : null;
  if (arr && key) {
    let it = arr.find((c) => c && c.canonical === key);
    if (!it) it = arr.find((c) => c && c.slug === key);
    if (it && Number.isFinite(+it.value)) return +it.value || 0;
  }
  if (legacyKey) {
    const parts = legacyKey.split(".");
    let v = ow;
    for (const p of parts) v = v && v[p];
    if (Number.isFinite(+v)) return +v || 0;
  }
  return 0;
}

const PG = { W: 842, H: 595, M: 18 };
const CW = PG.W - PG.M * 2;

const C = {
  text: "#000000",
  muted: "#444444",
  border: "#000000",
};

const COLS = [
  { key: "science", w: 119, hdr: "Fanning nomi", infoSpan: true },
  { key: "course", w: 17, hdr: "kurs", infoSpan: true },
  { key: "student", w: 21, hdr: "Talabalar soni", infoSpan: true },
  { key: "group", w: 21, hdr: "Gurux soni", infoSpan: true },
  { key: "stream", w: 21, hdr: "Oqim soni", infoSpan: true },
  { key: "semester", w: 17, hdr: "Semestr", infoSpan: true },
  { key: "semTotal", w: 28, hdr: "Umumiy soat", grp1: "oQuv", grp2: "mazkur" },
  {
    key: "semAud",
    w: 28,
    hdr: "Auditoriya soati",
    grp1: "oQuv",
    grp2: "mazkur",
  },
  { key: "lectStr", w: 21, hdr: "Bir oqimga", grp1: "oQuv", grp2: "maruza" },
  { key: "lectTot", w: 26, hdr: "Jami", grp1: "oQuv", grp2: "maruza" },
  { key: "clinStr", w: 21, hdr: "Bir oqimga", grp1: "oQuv", grp2: "klinik" },
  { key: "clinTot", w: 26, hdr: "Jami", grp1: "oQuv", grp2: "klinik" },
  { key: "semiStr", w: 18, hdr: "Bir oqimga", grp1: "oQuv", grp2: "seminar" },
  { key: "semiTot", w: 20, hdr: "Jami", grp1: "oQuv", grp2: "seminar" },
  { key: "labStr", w: 18, hdr: "Bir oqimga", grp1: "oQuv", grp2: "lab" },
  { key: "labTot", w: 20, hdr: "Jami", grp1: "oQuv", grp2: "lab" },
  { key: "pratStr", w: 18, hdr: "Bir oqimga", grp1: "oQuv", grp2: "amaliy" },
  { key: "pratTot", w: 20, hdr: "Jami", grp1: "oQuv", grp2: "amaliy" },
  { key: "on", w: 25, hdr: "ON (1 tal. 0.2 soat)", grp1: "oQuv", grp2: null },
  { key: "yan", w: 25, hdr: "YAN (1 tal. 0.3 soat)", grp1: "oQuv", grp2: null },
  {
    key: "missed",
    w: 23,
    hdr: "Qoldirilgan dars. Qayta topsh. qabul qilish",
    grp1: "oQuv",
    grp2: null,
  },
  {
    key: "skilled",
    w: 23,
    hdr: "Malakaviy amaliyotga raxbarlik qilish",
    grp1: "oQuv",
    grp2: null,
  },
  {
    key: "special",
    w: 34,
    hdr: "YADA da umum ma'r.va mas.o'tkazish qatnashishi",
    grp1: "boshqa",
  },
  { key: "vada", w: 28, hdr: "YADA da qatnashish", grp1: "boshqa", grp2: null },
  {
    key: "reception",
    w: 28,
    hdr: "Qabul (ijodiy imtihon) da qatnashish",
    grp1: "boshqa",
    grp2: null,
  },
  {
    key: "consulting",
    w: 28,
    hdr: "MI larga ilmiy maslaxatchilik",
    grp1: "boshqa",
    grp2: null,
  },
  { key: "openDep", w: 28, hdr: "kafedrada", grp1: "boshqa", grp2: "ochiq" },
  { key: "integral", w: 22, hdr: "integral", grp1: "boshqa", grp2: "ochiq" },
  {
    key: "leadership",
    w: 32,
    hdr: "KO rahbarlik qilish (1 KO uchun 100 soat)",
    grp1: "boshqa",
  },
  { key: "total", w: 30, hdr: "Jami soat", grp1: "jami" },
];
const INFO_COLS = COLS.filter((c) => c.infoSpan).length;
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
  doc
    .fillColor(color)
    .text(str, x + 1, ty, {
      width: w - 2,
      height: h,
      align,
      lineBreak: true,
    });
}

function ctUp(doc, text, x, y, w, h, opts = {}) {
  const { fs = 6, bold = false, color = C.text } = opts;
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
      height: w - 2,
      align: "center",
      lineBreak: true,
    });
  doc.restore();
}

function textLine(doc, font, fs, color, str, tx, ty, tw, align = "left") {
  doc
    .font(font)
    .fontSize(fs)
    .fillColor(color)
    .text(san(str), tx, ty, { width: tw, align, lineBreak: true });
  return doc.y;
}

function checkPage(doc, y, needed = 30) {
  if (y + needed > PG.H - PG.M - 15) {
    doc.addPage();
    return PG.M;
  }
  return y;
}

async function drawApprovalHeader(doc, wl, qr = null) {
  const X0 = PG.M,
    Y0 = PG.M;
  const SIDE_W = 200,
    GAP = 8;
  const CENTER_W = CW - SIDE_W * 2 - GAP * 2;
  const rX = X0 + CW - SIDE_W;
  const cX = X0 + SIDE_W + GAP;
  const verifySnapshot =
    wl.verify && Array.isArray(wl.verify.snapshot)
      ? wl.verify.snapshot
      : undefined;

  const agrX = rX;
  const confX = X0;

  const eriGapText = (sig) =>
    sig.source === "snapshot" || sig.source === "chain"
      ? "(ERI bilan imzolangan)"
      : undefined;

  const slotQr = qr ? { image: qr.image, size: QR_SIZE_SLOT } : undefined;

  const agr = wl.agreed || {};
  const agrSig = resolveSignatory(wl, {
    step: "prorektor",
    block: "agreed",
    personField: "viceRector",
    snapshot: verifySnapshot,
  });
  const agrH = drawSignatureBlock(doc, {
    x: agrX,
    y: Y0 + 4,
    w: SIDE_W,
    align: "center",
    heading: `"${agr.agree || "KELISHILDI"}"`,
    position: [
      agr.position || "O'quv ishlari bo'yicha prorektor",
      { text: "Farg'ona jamoat salomatligi tibbiyot instituti", fs: 6.5, color: C.muted },
    ],
    sig: agrSig,
    gapText: eriGapText(agrSig),
    qr: slotQr,
  });

  const conf = wl.confirmation || {};
  const confSig = resolveSignatory(wl, {
    step: "rektor",
    block: "confirmation",
    personField: "rector",
    snapshot: verifySnapshot,
  });
  const confH = drawSignatureBlock(doc, {
    x: confX,
    y: Y0 + 4,
    w: SIDE_W,
    align: "center",
    heading: `"${conf.confirm || "TASDIQLAYMAN"}"`,
    position: conf.position || "Farg'ona jamoat salomatligi tibbiyot instituti rektori",
    sig: confSig,
    gapText: eriGapText(confSig),
    qr: slotQr,
  });

  let cY = Y0 + 6;
  cY = textLine(
    doc,
    "Helvetica-Bold",
    9.5,
    C.text,
    san(wl.title) ||
      `${san(wl.department?.title) || "Kafedra"}ning ${academicYearLabel(wl.academicYear, "202_/202_")} o'quv yili uchun soatlar hisobi va ish o'rinlari`,
    cX,
    cY,
    CENTER_W,
    "center",
  );
  cY += 4;
  if (wl.date) {
    cY = textLine(
      doc,
      "Helvetica",
      7.5,
      C.muted,
      `${fmtDocDate(wl.date)}-yil`,
      cX,
      cY,
      CENTER_W,
      "right",
    );
  }

  return Math.max(Y0 + 4 + agrH, Y0 + 4 + confH, cY) - Y0 + 6;
}

const HDR3_MIN = 62;

function fitRotatedHeaderH(doc) {
  const rotated = COLS.filter((c) => !c.infoSpan && c.grp1 !== "jami");
  const fits = (h) =>
    rotated.every((c) => {
      doc.font("Helvetica").fontSize(6);
      return doc.heightOfString(san(c.hdr), { width: h - 4, align: "center" }) <= c.w - 2;
    });
  let h = HDR3_MIN;
  while (!fits(h) && h < 140) h += 6;
  return h;
}

const GRP1_LABELS = {
  oQuv: { text: "O'quv ishlari (bakalavriatura)", fs: 7 },
  boshqa: { text: "O'quv ishiga tenglashtirilgan boshqa ish turlari", fs: 5.5 },
};
const GRP2_LABELS = {
  mazkur: "Mazkur semestr uchun",
  maruza: "Ma'ruza",
  klinik: "klinik o'quv amaliyoti",
  seminar: "Seminar mashg'",
  lab: "Lab. Mashg'.klinik. amal",
  amaliy: "Amaliy Mashg'",
  ochiq: "Ochiq leksiya va master klasslar o'tkazish",
};

const HEADER_SPANS = buildHeaderSpans(COLS);

function drawMainTableHeader(doc, y) {
  const measure = (text, w, fs) => {
    doc.font("Helvetica-Bold").fontSize(fs);
    return doc.heightOfString(san(text), { width: w - 4, align: "center" });
  };

  const grp1Spans = HEADER_SPANS.grp1.filter((s) => s.value !== "jami");

  const HDR1_H = Math.max(
    12,
    ...grp1Spans.map((s) => {
      const meta = GRP1_LABELS[s.value] || { text: "", fs: 6 };
      const w = COL_X[s.to] - COL_X[s.from];
      return Math.ceil(measure(meta.text, w, meta.fs)) + 2;
    }),
  );
  const HDR2_H = Math.max(
    11,
    ...HEADER_SPANS.grp2.map((s) => {
      const label = GRP2_LABELS[s.value] || "";
      const w = COL_X[s.to] - COL_X[s.from];
      return Math.ceil(measure(label, w, 5.5)) + 2;
    }),
  );
  const HDR3_H = fitRotatedHeaderH(doc);
  const TOTAL_HDR_H = HDR1_H + HDR2_H + HDR3_H;

  for (let i = INFO_COLS; i < COLS.length - 1; i++) {
    bdr(doc, COL_X[i], y + HDR1_H + HDR2_H, COLS[i].w, HDR3_H, null, 0.3);
    ctUp(doc, COLS[i].hdr, COL_X[i], y + HDR1_H + HDR2_H, COLS[i].w, HDR3_H, {
      fs: 6,
      bold: COLS[i].grp1 === "jami",
      color: C.text,
    });
  }

  for (let i = 0; i < INFO_COLS; i++) {
    bdr(doc, COL_X[i], y, COLS[i].w, TOTAL_HDR_H, null, 0.4);
    if (i === 0) {
      ct(doc, COLS[i].hdr, COL_X[i], y, COLS[i].w, TOTAL_HDR_H, {
        fs: 7,
        bold: true,
        color: C.text,
      });
      continue;
    }
    ctUp(doc, COLS[i].hdr, COL_X[i], y, COLS[i].w, TOTAL_HDR_H, {
      fs: 6,
      bold: true,
      color: C.text,
    });
  }

  for (const span of grp1Spans) {
    const meta = GRP1_LABELS[span.value] || { text: "", fs: 6 };
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
    const xi = COL_X[lastIdx];
    bdr(doc, xi, y, COLS[lastIdx].w, TOTAL_HDR_H, null, 0.5);
    ctUp(doc, "Jami soat", xi, y, COLS[lastIdx].w, TOTAL_HDR_H, {
      fs: 7,
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
      fs: 5.5,
      bold: true,
      color: C.text,
    });
  }

  return y + TOTAL_HDR_H;
}

function drawSectionRow(doc, y, text) {
  const str = san(text).toUpperCase();
  doc.font("Helvetica-Bold").fontSize(7);
  const textH = doc.heightOfString(str, { width: 300, align: "center" });
  const SEC_H = Math.max(12, Math.ceil(textH) + 2);
  bdr(doc, PG.M, y, CW, SEC_H, null, 0.4);
  doc
    .fillColor(C.text)
    .text(str, PG.M + CW / 2 - 150, y + Math.max(0, (SEC_H - textH) / 2), {
      width: 300,
      height: SEC_H,
      align: "center",
      lineBreak: true,
    });
  return y + SEC_H;
}

const ROW_H = 12;
const ROW_H_MAX = ROW_H * 2;

function drawDataRow(doc, y, rowData, opts = {}) {
  const { isJami = false } = opts;

  let rowH = ROW_H;
  for (let i = 0; i < COLS.length; i++) {
    const val = rowData[COLS[i].key];
    if (val === undefined || val === null || val === "") continue;
    const fs = i === 0 ? 6 : 6.5;
    doc.font(isJami ? "Helvetica-Bold" : "Helvetica").fontSize(fs);
    const h = doc.heightOfString(fmtNum(val), { width: COLS[i].w - 2 });
    rowH = Math.max(rowH, Math.ceil(h) + 2);
  }

  for (let i = 0; i < COLS.length; i++) {
    bdr(doc, COL_X[i], y, COLS[i].w, rowH, null, 0.25);
    const val = rowData[COLS[i].key];
    if (val !== undefined && val !== null && val !== "") {
      const align = i === 0 ? "left" : i === 1 ? "center" : "center";
      ct(doc, fmtNum(val), COL_X[i], y, COLS[i].w, rowH, {
        fs: i === 0 ? 6 : 6.5,
        bold: isJami,
        color: C.text,
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
  "semiStr",
  "semiTot",
  "labStr",
  "labTot",
  "pratStr",
  "pratTot",
  "on",
  "yan",
  "missed",
  "skilled",
  "special",
  "vada",
  "reception",
  "consulting",
  "openDep",
  "integral",
  "leadership",
  "total",
];

function blockToRow(block) {
  const sw = block.studyWork || {};
  const ow = block.otherWork || {};
  const grp = sw.group || 0;
  const stud = block.student || 0;
  return {
    science:
      san(block.science?.title) ||
      san(block.science?.scienceCode) ||
      san(block.practiceTitle) ||
      "—",
    course: block.course || "",
    student: stud || "",
    group: grp || "",
    stream: sw.stream || "",
    semester: sw.semester || "",
    semTotal: sw.thisSemester?.totalHour || "",
    semAud: sw.thisSemester?.auditoriumHour || "",
    lectStr:    ctStream(sw, WORK_CANONICAL.LECTURE,           "lecture")            || ctStream(sw, "maruza")          || "",
    lectTot:    ctTotal(sw,  WORK_CANONICAL.LECTURE,           "lecture")            || ctTotal(sw,  "maruza")          || "",
    clinStr:    ctStream(sw, WORK_CANONICAL.CLINICAL_PRACTICE, "clinicalPractice")   || ctStream(sw, "klinik_amaliyot") || "",
    clinTot:    ctTotal(sw,  WORK_CANONICAL.CLINICAL_PRACTICE, "clinicalPractice")   || ctTotal(sw,  "klinik_amaliyot") || "",
    semiStr:    ctStream(sw, WORK_CANONICAL.SEMINAR,           "seminar")            || ctStream(sw, "seminar")         || "",
    semiTot:    ctTotal(sw,  WORK_CANONICAL.SEMINAR,           "seminar")            || ctTotal(sw,  "seminar")         || "",
    labStr:     ctStream(sw, WORK_CANONICAL.LAB_TRAINING,      "labTraining")        || ctStream(sw, "laboratoriya")    || "",
    labTot:     ctTotal(sw,  WORK_CANONICAL.LAB_TRAINING,      "labTraining")        || ctTotal(sw,  "laboratoriya")    || "",
    pratStr:    ctStream(sw, WORK_CANONICAL.PRACTICAL,         "practicalExercise")  || ctStream(sw, "amaliy")          || "",
    pratTot:    ctTotal(sw,  WORK_CANONICAL.PRACTICAL,         "practicalExercise")  || ctTotal(sw,  "amaliy")          || "",
    on:         itemVal(sw,  WORK_CANONICAL.STUDENT_WORK,      "student")            || itemVal(sw,  "on")              || "",
    yan:        itemVal(sw,  WORK_CANONICAL.YAN,               "yan")                || "",
    missed:     itemVal(sw,  WORK_CANONICAL.MISSED,            "missedLesson")       || itemVal(sw,  "qoldirilgan")     || "",
    skilled:    itemVal(sw,  WORK_CANONICAL.SKILLED_PRACTICE,  "skilledPractical")   || itemVal(sw,  "malakaviy")       || "",
    vada:       otherVal(ow, WORK_CANONICAL.PARTICIPATION,     "participation")      || otherVal(ow, "yada_qatnashish") || "",
    reception:  otherVal(ow, WORK_CANONICAL.RECEPTION,         "reception")          || otherVal(ow, "qabul")           || "",
    consulting: otherVal(ow, WORK_CANONICAL.CONSULTING,        "consulting")         || otherVal(ow, "maslahatchilik")  || "",
    openDep:    otherVal(ow, WORK_CANONICAL.OPEN_DEPARTMENT,   "openLecture.department") || otherVal(ow, "ochiq_kafedra")|| "",
    integral:   otherVal(ow, WORK_CANONICAL.OPEN_INTEGRAL,     "openLecture.integral")   || otherVal(ow, "ochiq_integral") || "",
    special:    otherVal(ow, WORK_CANONICAL.SPECIAL,           "special")            || otherVal(ow, "yada_umumiy")     || "",
    leadership: block.leadership || "",
    total: block.totalHour || "",
  };
}

function calcJami(rows) {
  const jami = {
    science: "Jami",
    course: "",
    student: "",
    group: "",
    stream: "",
    semester: "",
  };
  for (const key of NUM_KEYS) {
    const sum = rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    jami[key] = sum || "";
  }
  return jami;
}

function drawMainTable(doc, startY, wl) {
  let y = startY;

  const redrawHeader = (atY) => drawMainTableHeader(doc, atY);
  y = redrawHeader(y);

  const groups = [];
  const sectionsPerDir = new Map();
  for (const dir of wl.directions || []) {
    const dirTitle = san(dir.direction?.title) || san(dir.direction) || "—";
    const dirId = dir.direction?._id ? String(dir.direction._id) : dirTitle;

    const secSet = sectionsPerDir.get(dirId) || new Set();
    for (const block of dir.blocks || []) secSet.add(block.section || "Umumiy");
    sectionsPerDir.set(dirId, secSet);

    for (const block of dir.blocks || []) {
      const secName = block.section || "Umumiy";
      const last = groups[groups.length - 1];
      if (last && last.dirId === dirId && last.section === secName) {
        last.blocks.push(block);
      } else {
        groups.push({ dirId, dirTitle, section: secName, blocks: [block] });
      }
    }
  }

  const grandTotals = {
    science: "Jami:",
    course: "",
    student: "",
    group: "",
    stream: "",
    semester: "",
  };
  for (const key of NUM_KEYS) grandTotals[key] = 0;

  let lastDirId = null;

  for (const grp of groups) {
    const sectionRows = grp.blocks.map((b) => blockToRow(b));

    if (grp.dirId !== lastDirId) {
      y = checkPage(doc, y, 24 + ROW_H_MAX);
      if (y === PG.M) y = redrawHeader(y);
      y = drawSectionRow(doc, y, grp.dirTitle);
      lastDirId = grp.dirId;
    }

    if ((sectionsPerDir.get(grp.dirId)?.size || 1) > 1) {
      y = checkPage(doc, y, 24 + ROW_H_MAX);
      if (y === PG.M) y = redrawHeader(y);
      y = drawSectionRow(doc, y, grp.section);
    }

    for (const row of sectionRows) {
      y = checkPage(doc, y, ROW_H_MAX);
      if (y === PG.M) y = redrawHeader(y);
      y = drawDataRow(doc, y, row);
    }

    const secJami = calcJami(sectionRows);
    if (groups.length > 1) {
      y = checkPage(doc, y, ROW_H_MAX);
      if (y === PG.M) y = redrawHeader(y);
      y = drawDataRow(doc, y, secJami, { isJami: true });
    }

    for (const key of NUM_KEYS) {
      grandTotals[key] =
        (Number(grandTotals[key]) || 0) + (Number(secJami[key]) || 0);
    }
  }

  for (const key of NUM_KEYS) {
    if (!grandTotals[key]) grandTotals[key] = "";
  }
  y = checkPage(doc, y, ROW_H_MAX + 2);
  if (y === PG.M) y = redrawHeader(y);
  y += 1;
  y = drawDataRow(doc, y, grandTotals, { isJami: true });

  return y;
}

function drawStaffTable(doc, y, sp) {
  if (!sp) return y;

  const LBL_W = 90;
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
      label: "Professor-o'qituvchilar",
      cols: [
        { label: "Prof.", path: "teachingStaff.professor" },
        { label: "Dotsent", path: "teachingStaff.docent" },
        { label: "Katta o'qituv.", path: "teachingStaff.seniorTeacher" },
        { label: "Assistent o'qituvchi", path: "teachingStaff.assistant" },
        { label: "Stajyor o'qituvchi", path: "teachingStaff.trainee" },
        { label: "Jami ish o'rni", path: null, isJami: true },
      ],
    },
    {
      label: "O'quv yordamchi xodimlar",
      cols: [
        { label: "Katta laborant", path: "supportStaff.seniorLaborant" },
        { label: "Laborant", path: "supportStaff.laborant" },
        { label: "Kabinet mudiri", path: "supportStaff.cabinetHead" },
        { label: "Jami ish o'rinlari", path: null, isJami: true, grand: true },
      ],
    },
  ];

  const allLeaf = GROUPS.flatMap((g) => g.cols);
  const totalLeaf = allLeaf.length;
  const colW = Math.floor(REST_W / totalLeaf);
  const extraW = REST_W - colW * totalLeaf;

  const leafXs = [PG.M + LBL_W];
  for (let i = 0; i < totalLeaf; i++) {
    leafXs.push(
      leafXs[leafXs.length - 1] + colW + (i === totalLeaf - 1 ? extraW : 0),
    );
  }

  const H1 = 14,
    H2 = 16,
    ROW = 13;

  let lx = PG.M + LBL_W,
    gi = 0;
  bdr(doc, PG.M, y, LBL_W, H1 + H2, null, 0.4);
  for (const grp of GROUPS) {
    const gw =
      grp.cols.length * colW + (gi === GROUPS.length - 1 ? extraW : 0);
    bdr(doc, lx, y, gw, H1, null, 0.4);
    ct(doc, grp.label, lx, y, gw, H1, { fs: 7, bold: true, color: C.text });
    lx += gw;
    gi++;
  }

  for (let i = 0; i < totalLeaf; i++) {
    const lf = allLeaf[i];
    const w = colW + (i === totalLeaf - 1 ? extraW : 0);
    bdr(doc, leafXs[i], y + H1, w, H2, null, 0.3);
    ct(doc, lf.label, leafXs[i], y + H1, w, H2, {
      fs: 5.5,
      bold: true,
      color: C.text,
    });
  }
  y += H1 + H2;

  const DATA_ROWS = [
    { label: "Ish o'rinlari", field: "positions" },
    { label: "O'quv yuklama", field: "load" },
    { label: "Jami soat", field: "totalHours" },
    { label: "Soatbay", field: null, hourly: true },
  ];

  const getPath = (obj, path) => {
    if (!path || !obj) return null;
    const [category, slug] = path.split(".");
    return findStaffItem(obj, category, slug);
  };

  const groupSums = GROUPS.map((grp) => {
    const leafs = grp.cols.filter((c) => c.path).map((c) => getPath(sp, c.path));
    const positions = leafs.reduce((s, it) => s + (it?.positions || 0), 0);
    const totalHours = leafs.reduce((s, it) => s + (it?.totalHours || 0), 0);
    return {
      positions,
      load: averageLoad(totalHours, positions),
      totalHours,
      hourly: leafs.reduce((s, it) => s + (it?.hourly || 0), 0),
    };
  });
  const combineSums = (parts) => {
    const positions = parts.reduce((s, g) => s + g.positions, 0);
    const totalHours = parts.reduce((s, g) => s + g.totalHours, 0);
    return {
      positions,
      load: averageLoad(totalHours, positions),
      totalHours,
      hourly: parts.reduce((s, g) => s + g.hourly, 0),
    };
  };
  const grandSums = combineSums(groupSums);

  for (let ri = 0; ri < DATA_ROWS.length; ri++) {
    const dr = DATA_ROWS[ri];
    y = checkPage(doc, y, ROW);

    bdr(doc, PG.M, y, LBL_W, ROW, null, 0.3);
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
        const w = colW + (li === totalLeaf - 1 ? extraW : 0);
        let val = "";
        if (lf.grand && dr.field !== "positions") {
          val = "";
        } else if (lf.isJami) {
          const sums = lf.grand ? grandSums : combineSums(groupSums.slice(0, gIdx + 1));
          val = dr.hourly ? sums.hourly || "" : sums[dr.field] || "";
        } else if (lf.path) {
          const pObj = getPath(sp, lf.path);
          val = dr.hourly ? pObj?.hourly || "" : pObj?.[dr.field] || "";
          sumVal += Number(pObj?.[dr.field]) || 0;
        }
        bdr(doc, leafXs[li], y, w, ROW, null, 0.25);
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

async function drawSignatures(doc, y, wl, qr = null) {
  const verifySnapshot =
    wl.verify && Array.isArray(wl.verify.snapshot)
      ? wl.verify.snapshot
      : undefined;

  const mhSig = resolveSignatory(wl, {
    step: "methodical",
    block: "methodicalHead",
    personField: "leader",
    snapshot: verifySnapshot,
  });
  const fhSig = resolveSignatory(wl, {
    step: "financial",
    block: "financialHead",
    personField: "leader",
    snapshot: verifySnapshot,
  });
  const dhSig = resolveSignatory(wl, {
    step: "kafedra",
    block: "departmentHead",
    personField: "manager",
    snapshot: verifySnapshot,
  });

  const LINE_H = 12;
  const ROW_GAP = qr ? 6 : 8;
  const rowX = PG.M + 20;
  const rowW = PG.W - 2 * PG.M - 40;
  const rows = [
    {
      x: rowX,
      w: rowW,
      layout: "row",
      position: "O'quv-uslubiy boshqarma boshlig'i:",
      sig: { ...mhSig, dateText: "" },
      statusText: "(ERI bilan imzolangan)",
      qr: qr ? { image: qr.image, size: QR_SIZE_ROW } : undefined,
    },
    {
      x: rowX,
      w: rowW,
      layout: "row",
      position: "Reja moliya bo'limi boshlig'i:",
      sig: { ...fhSig, dateText: "" },
      statusText: "(ERI bilan imzolangan)",
      qr: qr ? { image: qr.image, size: QR_SIZE_ROW } : undefined,
    },
    {
      x: rowX,
      w: rowW,
      layout: "row",
      position: "Kafedra mudiri:",
      sig: { ...dhSig, dateText: "" },
      statusText: "(ERI bilan imzolangan)",
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

const FOOTER_STATUS_LABEL = {
  draft: "Qoralama",
  in_review: "Ko'rib chiqilmoqda",
  approved: "Tasdiqlangan",
  rejected: "Rad etildi",
  superseded: "Almashtirilgan (o'z kuchini yo'qotgan)",
};

function supersededStampLines(wl) {
  if (wl?.status !== "superseded") return null;
  const at = wl.supersededAt ? fmtDocDate(new Date(wl.supersededAt)) : "";
  return [
    "ALMASHTIRILGAN",
    `O'z kuchini yo'qotgan hujjat · v${wl.version || 1}${at ? ` · ${at}` : ""}`,
  ];
}

function drawSupersededStamp(doc, lines) {
  const outline = { width: PG.W, align: "center", lineBreak: false, stroke: true, fill: false };
  doc.save();
  doc.rotate(-20, { origin: [PG.W / 2, PG.H / 2] });
  doc.lineWidth(1.2).strokeColor("#E8A09A");
  doc.font("Helvetica-Bold").fontSize(64).text(lines[0], 0, PG.H / 2 - 50, outline);
  doc.lineWidth(0.6).fontSize(20).text(lines[1], 0, PG.H / 2 + 22, outline);
  doc.restore();
}

function drawFooter(doc, wl) {
  const STATUS_LABEL = FOOTER_STATUS_LABEL;
  const stamp = supersededStampLines(wl);
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    if (stamp) drawSupersededStamp(doc, stamp);
    const fy = PG.H - PG.M + 6;
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
        `O'quv yuklamasi | ${academicYearLabel(wl.academicYear)} | ${STATUS_LABEL[wl.status] || ""}`,
        PG.M,
        fy - 2,
        { width: CW - 40, height: 14, align: "left", lineBreak: false },
      );
    doc
      .font("Helvetica")
      .fontSize(6)
      .fillColor(C.muted)
      .text(
        `${i - range.start + 1} / ${range.count}`,
        PG.W - PG.M - 35,
        fy - 2,
        { width: 35, height: 14, align: "right", lineBreak: false },
      );
  }
}

async function buildWorkloadPdf(id) {
  const wl = await WorkloadModel.findById(id)
    .populate("department", "title")
    .populate("directions.direction", "title")
    .populate("directions.workingPlan", "status")
    .populate("directions.blocks.science", "title scienceCode")
    .populate("approvalSteps.approvedBy", "firstName lastName middleName")
    .populate("agreed.viceRector", "firstName lastName middleName")
    .populate("confirmation.rector", "firstName lastName middleName")
    .populate("methodicalHead.leader", "firstName lastName middleName")
    .populate("financialHead.leader", "firstName lastName middleName")
    .populate("academicYear", "title")

    .exec();

  if (!wl) throw new Error("Yuklama topilmadi");

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: PG.M, bottom: PG.M, left: PG.M, right: PG.M },
    info: { Creator: "Institut AIS", Producer: "PDFKit" },
    bufferPages: true,
  });
  registerCyrillicFonts(doc);

  const verifyQr = await prepareVerifyQr(wl, { docType: "workload" });

  const hdrH = await drawApprovalHeader(doc, wl, verifyQr);
  let y = PG.M + hdrH + 6;

  y = drawMainTable(doc, y, wl);
  y += 8;

  if (wl.staffPositions) {
    y = checkPage(doc, y, 80);
    y += 4;
    y = drawStaffTable(doc, y, wl.staffPositions);
    y += 6;
  }

  y = await drawSignatures(doc, y, wl, verifyQr);

  drawFooter(doc, wl);
  doc.flushPages();

  return doc;
}

async function generateWorkloadPdf(req, res, next) {
  try {
    const doc = await buildWorkloadPdf(req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="yuklama-${req.params.id}.pdf"`,
    );
    doc.pipe(res);
    doc.end();
  } catch (err) {
    return next(new ErrorHandler(400, "Yuklama PDF yaratishda xatolik", err.message));
  }
}

module.exports = {
  generateWorkloadPdf,
  buildWorkloadPdf,
  buildHeaderSpans,
  FOOTER_STATUS_LABEL,
  supersededStampLines,
  COLS,
  GRP1_LABELS,
  GRP2_LABELS,
};
