const { ErrorHandler } = require("#shared/error");
"use strict";

const PDFDocument = require("pdfkit");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const LearningProcessModel = require("#modules/4.02-studyLoad/learningProcess/learningProcess.model");
const ScienceModel = require("#references/science/science.model");
const { pipeToResponse, registerCyrillicFonts } = require("#shared/pdfGenerators/pdfHelpers");
const winston = require("#shared/winston.logger");
const { academicYearLabel } = require("./academicYearLabel");
const { statisticsMap, STAT_LEGEND_TO_KEY } = require("./statisticsMap");
const { orderByLabels } = require("#modules/4.02-studyLoad/_services/summaryRows");
const { semesterDisplayNo } = require("#modules/4.02-studyLoad/_shared/semesterKey");
const {
  isElectiveBlock,
  isElectiveSlotRow,
  isPracticeEntry,
} = require("#modules/4.02-studyLoad/_shared/electiveBlock");
const {
  buildBlockSerialIndex,
  buildBlockSerialIndexFromBlocks,
  isDoubleCountedHeader,
} = require("#modules/4.02-studyLoad/_shared/planRowType");
const {
  drawSignatureBlock,
  measureSignatureBlock,
} = require("#modules/4.02-studyLoad/_shared/signatureBlock");
const {
  resolveSignatory,
} = require("#modules/4.02-studyLoad/_shared/signatories");
const {
  resolveStepLabel,
} = require("#modules/4.02-studyLoad/_shared/signatoryLabels");
const {
  prepareVerifyQr,
  QR_SIZE_SLOT,
  QR_SIZE_ROW,
} = require("#modules/4.02-studyLoad/_shared/verifyQr");

const {
  particleValue,
  CANONICAL,
} = require("#shared/particleHelpers");

function san(text) {
  if (!text && text !== 0) return "";
  if (typeof text === "object" && text !== null) {
    text = text.uz || text.ru || text.en || text.title || "";
    if (typeof text === "object") text = "";
  }
  return String(text)
    .replace(/\\n/g, "\n")
    .replace(/[\r\n]+/g, "\n")
    .replace(/[\t\v\f]+/g, " ")
    .replace(
      /[\u02BB\u02BC\u02BD\u02BE\u02BF\u0060\u00B4\u2018\u2019\u201A\u201B]/g,
      "'",
    )
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"');
}

const PG = { W: 842, H: 595, M: 12 };
const CW = PG.W - PG.M * 2;

const PAGE_OPTS = {
  size: "A4",
  layout: "landscape",
  margins: { top: PG.M, bottom: PG.M, left: PG.M, right: PG.M },
};

const C = {
  mid: "#b6e5f3",
  border: "#666666",
  text: "#111111",
  muted: "#555555",
  white: "#ffffff",
};

function bdr(doc, x, y, w, h, fill = null, lw = 0.25) {
  if (fill) doc.rect(x, y, w, h).fill(fill);
  doc.rect(x, y, w, h).strokeColor(C.border).lineWidth(lw).stroke();
}

function ct(doc, txt, x, y, w, h, opts = {}) {
  const { fs = 7, bold = false, color = C.text, align = "center" } = opts;
  if (txt === null || txt === undefined || txt === "") return;
  const topY = y + Math.max(1, (h - fs - 1) / 2);
  doc
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(fs)
    .fillColor(color)
    .text(san(txt), x + 1, topY, {
      width: w - 2,
      height: h,
      align,
      lineBreak: false,
      ellipsis: true,
    });
}

function ctFit(doc, txt, x, y, w, h, opts = {}) {
  const { fs = 7, fsMin = 3.6, bold = false, color = C.text, align = "center" } = opts;
  if (txt === null || txt === undefined || txt === "") return;
  const str = san(txt);
  const font = bold ? "Helvetica-Bold" : "Helvetica";
  const avail = Math.max(1, w - 2);
  let f = fs;
  doc.font(font);
  while (f > fsMin && doc.fontSize(f).widthOfString(str) > avail) f -= 0.25;
  const topY = y + Math.max(1, (h - f - 1) / 2);
  doc
    .font(font)
    .fontSize(f)
    .fillColor(color)
    .text(str, x + 1, topY, {
      width: avail,
      height: h,
      align,
      lineBreak: false,
      ellipsis: false,
    });
}

function wrapWords(doc, str, maxW) {
  const lines = [];
  let cur = "";
  for (const word of str.split(/\s+/).filter(Boolean)) {
    if (doc.widthOfString(word) > maxW) return null;
    const cand = cur ? `${cur} ${word}` : word;
    if (doc.widthOfString(cand) <= maxW) cur = cand;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function ctUp(doc, txt, cx, cy, colW, cellH, opts = {}) {
  const { fs = 6, fsMin = 3.4, bold = false, color = C.text, maxLines = 2 } = opts;
  if (!txt) return;
  const str = san(txt);
  const font = bold ? "Helvetica-Bold" : "Helvetica";
  const avail = Math.max(1, cellH - 6);
  const across = Math.max(1, colW - 2);
  doc.font(font);
  const fit = fitRotatedLines(doc, str, { fs, fsMin, maxLines, avail, across });
  doc.save();
  doc.translate(cx + colW / 2, cy + cellH / 2);
  doc.rotate(-90);
  doc.font(font).fillColor(color);
  if (fit) {
    const lh = doc.fontSize(fit.f).currentLineHeight(true);
    const y0 = -(fit.lines.length * lh) / 2;
    fit.lines.forEach((line, i) => {
      doc.text(line, -doc.widthOfString(line) / 2, y0 + i * lh, { lineBreak: false });
    });
  } else {
    doc.fontSize(fsMin).text(str, -(avail / 2), -colW / 2 + 1, {
      width: avail,
      height: colW,
      align: "center",
      lineBreak: false,
      ellipsis: true,
    });
  }
  doc.restore();
}

function fitRotatedLines(doc, str, { fs, fsMin, maxLines, avail, across }) {
  for (let f = fs; f >= fsMin; f -= 0.25) {
    doc.fontSize(f);
    const lines = wrapWords(doc, str, avail);
    if (lines && lines.length <= maxLines && lines.length * doc.currentLineHeight(true) <= across) {
      return { f, lines };
    }
  }
  return null;
}

function textLine(doc, font, fs, color, str, tx, ty, tw, align = "center") {
  doc
    .font(font)
    .fontSize(fs)
    .fillColor(color)
    .text(san(str), tx, ty, { width: tw, align, lineBreak: true });
  return doc.y;
}

const CONTENT_BOTTOM = PG.H - PG.M - 20;

function ensureRoom(doc, y, neededH) {
  if (y + neededH > CONTENT_BOTTOM) {
    doc.addPage(PAGE_OPTS);
    return PG.M;
  }
  return y;
}

function getAvailableSemesters(semestersMap) {
  if (!semestersMap) return [];
  const obj =
    semestersMap instanceof Map
      ? Object.fromEntries(semestersMap)
      : semestersMap;
  return Object.keys(obj).sort((a, b) => Number(a) - Number(b));
}

function getSemesterSciences(semestersMap, semKey, blockSerialIndex) {
  if (!semestersMap) return [];
  const obj =
    semestersMap instanceof Map
      ? Object.fromEntries(semestersMap)
      : semestersMap;
  const semData = obj[String(semKey)];
  if (!semData) return [];

  const result = [];
  for (const blk of semData.blocks || []) {
    const blockSerials = blockSerialIndex
      ? blockSerialIndex.get(blk.blockCode || "") || []
      : null;
    for (const sci of blk.sciences || []) {
      if (blockSerials && isDoubleCountedHeader(sci, blockSerials)) continue;
      result.push({
        code: sci.code || "",
        title: sci.title || "—",
        serialNumber: sci.serialNumber || null,
        totalHour:
          particleValue(sci.particle, CANONICAL.HOUR) ||
          particleValue(sci.particle, "umumiy_yuklamaning_hajmi_soat") ||
          0,
        lecture:
          particleValue(sci.particle, CANONICAL.LECTURE) ||
          particleValue(sci.particle, "maruza"),
        practical:
          particleValue(sci.particle, CANONICAL.PRACTICAL) ||
          particleValue(sci.particle, "amaliy"),
        lab:
          particleValue(sci.particle, CANONICAL.LABORATORY) ||
          particleValue(sci.particle, "laboratoriya"),
        seminar:
          particleValue(sci.particle, CANONICAL.SEMINAR) ||
          particleValue(sci.particle, "seminar"),
        independent:
          particleValue(sci.particle, CANONICAL.INDEPENDENT) ||
          particleValue(sci.particle, "mustaqil_ta_lim") ||
          particleValue(sci.particle, "mustaqil"),
        audTotal:
          particleValue(sci.particle, CANONICAL.TOTAL) ||
          particleValue(sci.particle, "jami") ||
          0,
        credit: sci.totalCredit || 0,
        weeklyHours: sci.weeklyHours || 0,
        evaluationType: sci.evaluationType || null,
        blockCode: blk.blockCode || "",
        blockTitle: blk.title || "",
        alternatives: altList(sci),
      });
    }
  }
  return result;
}

function codeRowsOf(semestersMap) {
  if (!semestersMap) return [];
  const sems =
    semestersMap instanceof Map
      ? [...semestersMap.values()]
      : Object.values(semestersMap);
  const rows = [];
  for (const sem of sems) {
    for (const blk of (sem && sem.blocks) || []) {
      for (const sci of blk.sciences || []) {
        rows.push(sci);
        if (Array.isArray(sci.alternatives)) rows.push(...sci.alternatives);
      }
    }
  }
  return rows.filter((r) => r && !r.code && r.science);
}

function fillMissingCodes(semestersMap, catalogById) {
  let filled = 0;
  for (const row of codeRowsOf(semestersMap)) {
    const code = catalogById.get(String(row.science));
    if (code) {
      row.code = code;
      filled += 1;
    }
  }
  return filled;
}

async function fillMissingCodesFromCatalog(semestersMap) {
  const ids = [...new Set(codeRowsOf(semestersMap).map((r) => String(r.science)))];
  if (!ids.length) return 0;
  try {
    const cat = await ScienceModel.find({ _id: { $in: ids } })
      .select("scienceCode")
      .lean();
    const byId = new Map(cat.map((c) => [String(c._id), c.scienceCode]));
    return fillMissingCodes(semestersMap, byId);
  } catch (err) {
    winston.error(`[workingPlan.pdf] katalog kodi o'qilmadi: ${err.message}`);
    return 0;
  }
}

function getAllBlocks(semestersMap) {
  if (!semestersMap) return [];
  const obj =
    semestersMap instanceof Map
      ? Object.fromEntries(semestersMap)
      : semestersMap;
  const allBlocks = [];
  for (const semKey of Object.keys(obj).sort((a, b) => Number(a) - Number(b))) {
    const semData = obj[semKey];
    if (semData?.blocks) allBlocks.push(...semData.blocks);
  }
  return allBlocks;
}

const HEADER_LINE_FS = 9;

function drawHeader(doc, ws, qr = null) {
  const X0 = PG.M,
    Y0 = PG.M;
  const SIDE_W = 148;
  const GAP = 6;
  const rX = X0 + CW - SIDE_W;
  const cX = X0 + SIDE_W + GAP;
  const cW = CW - SIDE_W * 2 - GAP * 2;
  const MLBL_W = 72;

  const L = (font, fs, clr, str, tx, ty, tw, al = "center") =>
    textLine(doc, font, fs, clr, str, tx, ty, tw, al);

  const wsVerifySnapshot =
    ws.verify && Array.isArray(ws.verify.snapshot) ? ws.verify.snapshot : undefined;
  const leftY0 = Y0 + 14;
  const agrSig = resolveSignatory(ws, {
    step: "prorektor",
    block: "agreed",
    personField: "viceRector",
    snapshot: wsVerifySnapshot,
    steps: ws.approvalHistory,
    compact: true,
  });
  const slotQr = qr ? { image: qr.image, size: QR_SIZE_SLOT } : undefined;
  const agrH = drawSignatureBlock(doc, {
    x: X0,
    y: leftY0,
    w: SIDE_W,
    align: "center",
    heading: ws.agreed?.agree || '"KELISHILDI"',
    position:
      ws.agreed?.position || resolveStepLabel("workingSchedule", "prorektor"),
    sig: agrSig,
    gapSignature: 8,
    qr: slotQr,
  });
  const leftBot = leftY0 + agrH + 8;

  const rightY0 = Y0 + 14;
  const confSig = resolveSignatory(ws, {
    step: "rektor",
    block: "confirmation",
    personField: "rector",
    snapshot: wsVerifySnapshot,
    steps: ws.approvalHistory,
    compact: true,
  });
  const confH = drawSignatureBlock(doc, {
    x: rX,
    y: rightY0,
    w: SIDE_W,
    align: "center",
    heading: ws.confirmation?.confirm || '"TASDIQLAYMAN"',
    position:
      ws.confirmation?.position ||
      resolveStepLabel("workingSchedule", "rektor"),
    sig: confSig,
    gapSignature: 8,
    qr: slotQr,
  });
  const rY = rightY0 + confH + 10;

  const META = [
    ["Akademik daraja", san(ws.academicLevel?.title) || "Bakalavr"],
    ["O'qish shakli", san(ws.readingForm?.title) || "kredit tizimi"],
    ["Ta'lim shakli", san(ws.educationForm?.title) || "kunduzgi"],
    ["O'qish muddati", san(ws.studyPeriod?.title) || "5 yil"],
    ["Ixtisoslik", san(ws.specialization?.title) || "—"],
  ];
  let mY = rY;
  const mValW = SIDE_W - MLBL_W - 2;
  for (const [lbl, val] of META) {
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(C.text)
      .text(lbl, rX, mY, { width: MLBL_W, lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(C.text)
      .text(`- ${val}`, rX + MLBL_W, mY, { width: mValW, lineBreak: false });
    mY += 11;
  }
  const rightBot = mY + 6;

  let cY = Y0 + 8;
  cY =
    L(
      "Helvetica-Bold",
      HEADER_LINE_FS,
      C.text,
      "O'ZBEKISTON RESPUBLIKASI SOG'LIQNI SAQLASH VAZIRLIGI",
      cX,
      cY,
      cW,
    ) + 1;
  cY =
    L(
      "Helvetica-Bold",
      HEADER_LINE_FS,
      C.text,
      "FARG'ONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI",
      cX,
      cY,
      cW,
    ) + 7;
  cY = L("Helvetica-Bold", 12, C.text, "ISHCHI O'QUV REJA", cX, cY, cW) + 5;
  const yearRaw = academicYearLabel(ws.academicYear, "202_/202_");
  const yearLine = /o'quv yili/i.test(yearRaw) ? yearRaw : `${yearRaw} o'quv yili`;
  cY = L("Helvetica-Bold", HEADER_LINE_FS, C.text, yearLine, cX, cY, cW) + 3;
  const stageRaw = san(ws.stage || "I");
  const stageLine = /bosqich|kurs/i.test(stageRaw) ? stageRaw : `${stageRaw} bosqich`;
  cY = L("Helvetica-Bold", HEADER_LINE_FS, C.text, stageLine, cX, cY, cW) + 3;

  const dirCode = san(ws.direction?.directionCode || "");
  const dirName = san(ws.direction?.title || "");
  cY = L("Helvetica-Bold", HEADER_LINE_FS, C.text, "Ta'lim yo'nalishi:", cX, cY, cW) + 1;
  const dirLabel = dirCode ? `${dirCode} – "${dirName}"` : `"${dirName}"`;
  cY = L("Helvetica-Bold", HEADER_LINE_FS, C.text, dirLabel, cX, cY, cW);
  if (ws.desc)
    cY = L("Helvetica-Oblique", 7, C.text, `(${san(ws.desc)})`, cX, cY + 4, cW);
  const centerBot = cY + 8;

  const H = Math.max(leftBot, rightBot, centerBot) - Y0;
  bdr(doc, X0, Y0, CW, H, null, 0.5);
  return H;
}

const MONTH_NAMES = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentyabr",
  "Oktyabr",
  "Noyabr",
  "Dekabr",
];

const LEGEND_MIN_SPACE = 10;
const LEGEND_MAX_SPACE = 16;

function drawCalendar(doc, x, y, w, ws) {
  const TITLE_H = 13;
  const MONTH_H = 11;
  const WEEK_H = 8;
  const COURSE_H = 10;
  const STAT_FS = 7;
  const STAT_LABEL_H = 60;
  const GT = 18;
  const ST = 10;
  const HDR_SPAN = GT + ST + STAT_LABEL_H;
  const SUBHDR_H = HDR_SPAN - MONTH_H - WEEK_H;
  const STATS = [
    { k: "total", l: "Jami" },
    { k: "theoreticalPractical", l: "Nazariy va amaliy ta'lim", g: true },
    { k: "certification", l: "Attestatsiyalar", g: true },
    { k: "creditSystem", l: "Kredit ta'lim tizimiga kirish", g: true },
    { k: "qualification", l: "Malakaviy amaliyot", g: true },
    { k: "final", l: "Yakuniy davlat attestatsiyasi", g: true },
    { k: "vacation", l: "Ta'til haftalar soni" },
    { k: "gpa", l: "GPA ko'rsatkichini hisoblash" },
    { k: "all", l: "Hammasi" },
  ];
  const STAT_W = 22;
  const STATS_AREA_W = STATS.length * STAT_W;
  const courses = ws.courses || [];
  const months = courses[0]?.months || [];
  const totalWeeks = months.reduce((s, m) => s + (m.weeks?.length || 0), 0);
  const KURS_W = 12;
  const wx0 = x + KURS_W;
  const weeksAreaW = w - STATS_AREA_W - KURS_W;
  const weekW = totalWeeks > 0 ? weeksAreaW / totalWeeks : 8;

  ct(doc, "I. O'QUV JARAYONI JADVALI", x, y, w, TITLE_H, {
    fs: 9,
    bold: true,
    color: C.text,
  });
  y += TITLE_H;

  if (!months.length) {
    doc
      .font("Helvetica")
      .fontSize(6)
      .fillColor(C.muted)
      .text("O'quv jarayoni ma'lumotlari mavjud emas", x + 4, y + 5, {
        width: w - 8,
      });
    return y + 20;
  }

  const hdrTopY = y;
  bdr(doc, x, hdrTopY, KURS_W, HDR_SPAN, null, 0.3);
  ctUp(doc, "Kurs", x, hdrTopY, KURS_W, HDR_SPAN, { fs: 7, bold: true });
  bdr(doc, wx0, hdrTopY, weeksAreaW, SUBHDR_H, null, 0.3);
  ct(doc, "Haftalar", wx0, hdrTopY, weeksAreaW, SUBHDR_H, {
    fs: 8,
    bold: true,
    color: C.text,
  });
  const gx = wx0 + weeksAreaW + STAT_W,
    gw = STAT_W * 5;
  bdr(doc, gx, hdrTopY, gw, GT, null, 0.3);
  ctWrap(doc, "O'quv jarayoni,\nhaftalari soni:", gx, hdrTopY, gw, GT, {
    fs: STAT_FS,
    bold: true,
    align: "center",
  });
  bdr(doc, gx, hdrTopY + GT, gw, ST, null, 0.3);
  ct(doc, "shundan", gx, hdrTopY + GT, gw, ST, { fs: STAT_FS, bold: true });

  const monthY = hdrTopY + SUBHDR_H;
  let mx = wx0;
  for (const m of months) {
    const mw = (m.weeks?.length || 0) * weekW;
    if (mw <= 0) continue;
    bdr(doc, mx, monthY, mw, MONTH_H, null, 0.3);
    const mIdx = (Number(m.month) - 1 + 12) % 12;
    const mName = MONTH_NAMES[mIdx] || String(m.month);
    const label =
      mw < 18 ? mName.slice(0, 3) : mw < 32 ? mName.slice(0, 6) : mName;
    ct(doc, label, mx, monthY, mw, MONTH_H, {
      fs: 8,
      bold: true,
      color: C.text,
    });
    mx += mw;
  }

  let sx = wx0 + weeksAreaW;
  for (const s of STATS) {
    const top = s.g ? hdrTopY + GT + ST : hdrTopY;
    const h = s.g ? HDR_SPAN - GT - ST : HDR_SPAN;
    bdr(doc, sx, top, STAT_W, h, null, 0.3);
    ctUp(doc, s.l, sx, top, STAT_W, h, { fs: STAT_FS, bold: true });
    sx += STAT_W;
  }

  const weekY = monthY + MONTH_H;
  let wx = wx0,
    weekNum = 1;
  for (const m of months) {
    for (const _wk of m.weeks || []) {
      bdr(doc, wx, weekY, weekW, WEEK_H, null, 0.3);
      ct(doc, weekNum, wx, weekY, weekW, WEEK_H, { fs: 6.5, color: C.text });
      wx += weekW;
      weekNum++;
    }
  }

  y = hdrTopY + HDR_SPAN;
  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
    const bg = C.white;
    const courseLabel = san(course.course || ws.stage || "")
      .replace(/\s*(bosqich|kurs)\s*/i, "")
      .trim();
    bdr(doc, x, y, KURS_W, COURSE_H, bg, 0.3);
    ct(doc, courseLabel, x, y, KURS_W, COURSE_H, { fs: 6.5, bold: true, color: C.text });
    let cwx = wx0;
    for (const m of course.months || months) {
      for (const wk of m.weeks || []) {
        const key = wk.key || "";
        bdr(doc, cwx, y, weekW, COURSE_H, bg, 0.3);
        if (key)
          ct(doc, key, cwx, y, weekW, COURSE_H, {
            fs: 6.5,
            bold: true,
            color: C.text,
          });
        cwx += weekW;
      }
    }
    const stat = statisticsMap(course.statistics);
    let statX = wx0 + weeksAreaW;
    for (const s of STATS) {
      bdr(doc, statX, y, STAT_W, COURSE_H, bg, 0.3);
      const val =
        s.k === "total"
          ? (course.total ?? stat.total ?? "")
          : s.k === "all"
            ? (stat.all ?? course.hammasi ?? "")
            : (stat[s.k] ?? "");
      ct(doc, val === 0 ? "" : val, statX, y, STAT_W, COURSE_H, { fs: 7 });
      statX += STAT_W;
    }
    y += COURSE_H;
  }

  const keys = ws.keys || [];
  if (keys.length) {
    y += 3;
    const BOX_W = 16,
      BOX_H = 12;
    const LABEL_GAP = 2;
    const items = keys.filter((k) => k.key);
    const titleOf = (k) => san(k.title || k.name || "");
    const titleW = (k, f) => doc.font("Helvetica").fontSize(f).widthOfString(titleOf(k));
    const itemsW = (f) => items.reduce((s, k) => s + BOX_W + LABEL_GAP + titleW(k, f), 0);
    const gaps = Math.max(1, items.length - 1);
    let tf = 7.5;
    while (tf > 4.5 && itemsW(tf) + gaps * LEGEND_MIN_SPACE > w) tf -= 0.25;
    const space = Math.min(LEGEND_MAX_SPACE, (w - itemsW(tf)) / gaps);
    let lx = x + Math.max(0, (w - itemsW(tf) - space * (items.length - 1)) / 2);
    for (const k of items) {
      doc.rect(lx, y, BOX_W, BOX_H).lineWidth(0.4).fillAndStroke(C.white, C.border);
      if (k.key.trim()) {
        doc
          .font("Helvetica-Bold")
          .fontSize(7)
          .fillColor(C.text)
          .text(k.key, lx + 1, y + 2, {
            width: BOX_W - 2,
            align: "center",
            lineBreak: false,
          });
      }
      const tw = titleW(k, tf);
      doc
        .font("Helvetica")
        .fontSize(tf)
        .fillColor(C.text)
        .text(titleOf(k), lx + BOX_W + LABEL_GAP, y + (BOX_H - tf) / 2, {
          width: tw + 2,
          lineBreak: false,
        });
      lx += BOX_W + LABEL_GAP + tw + space;
    }
    y += BOX_H + 3;
  }
  return y;
}

const SEM_ROW_H = 16;
const SEM_TOTAL_ROW_H = 13;
const ALT_ROW_H = 14;
const ALT_MARK = "• ";
const ALT_INDENT = 6;

function altList(sci) {
  const raw = sci && sci.alternatives;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a) => a && (a.code || a.title))
    .map((a) => ({
      science: a.science || null,
      code: a.code || "",
      title: a.title || "—",
    }));
}

const SEM_GRP_H = 9;
const SEM_COL_H = 48;
const SEM_NUM_H = 7;
const SEM_LABEL_H = 9;
const SEM_HEAD_H = SEM_LABEL_H + SEM_GRP_H * 3 + SEM_COL_H + SEM_NUM_H;
const SEM_TAIL_H = 3 * SEM_TOTAL_ROW_H;

function semColWidths(tableW) {
  const BASE_TOTAL = 283;
  const scale = tableW / BASE_TOTAL;
  const CODE_W = Math.round(26 * scale);
  const NAME_W = Math.round(70 * scale);
  const UMU_W = Math.round(19 * scale);
  const AUDT_W = Math.round(17 * scale);
  const MAR_W = Math.round(17 * scale);
  const AMAL_W = Math.round(17 * scale);
  const LAB_W = Math.round(16 * scale);
  const SEM_W = Math.round(16 * scale);
  const MUS_W = Math.round(19 * scale);
  const WEEK_W = Math.round(17 * scale);
  const KRE_W = Math.round(16 * scale);
  const YAK_W =
    tableW -
    CODE_W -
    NAME_W -
    UMU_W -
    AUDT_W -
    MAR_W -
    AMAL_W -
    LAB_W -
    SEM_W -
    MUS_W -
    WEEK_W -
    KRE_W;
  return {
    CODE_W,
    NAME_W,
    UMU_W,
    AUDT_W,
    MAR_W,
    AMAL_W,
    LAB_W,
    SEM_W,
    MUS_W,
    WEEK_W,
    KRE_W,
    YAK_W,
  };
}

function ctWrap(doc, txt, x, y, w, h, opts = {}) {
  const { fs = 6, bold = false, color = C.text, align = "left" } = opts;
  if (txt === null || txt === undefined || txt === "") return;
  const str = san(String(txt));
  const tw = Math.max(1, w - 2);
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fs);
  const th = doc.heightOfString(str, { width: tw, align });
  const topY = y + Math.max(1, (h - th) / 2);
  doc.fillColor(color).text(str, x + 1, topY, {
    width: tw,
    height: h,
    align,
    lineBreak: true,
  });
}

function measureNameH(doc, title, nameW, fs) {
  const str = title != null ? san(String(title)) : "";
  if (!str) return 0;
  doc.font("Helvetica").fontSize(fs);
  return doc.heightOfString(str, {
    width: Math.max(1, nameW - 2),
    align: "left",
  });
}

const ROWPAD = 4;

function sciRowHeight(doc, sci, nameW, yakW) {
  const h = Math.max(
    measureNameH(doc, sci.title, nameW, 6),
    yakW ? measureNameH(doc, sci.evaluationType, yakW, 6) : 0,
  );
  return Math.max(SEM_ROW_H, Math.ceil(h) + ROWPAD);
}

const PRACT_FS = 5.5;

function practiceRowLabel(practiceRows) {
  const names = [
    ...new Set(
      (practiceRows || [])
        .filter((r) => !r.alt)
        .map((r) => String(r.title || "").trim())
        .filter(Boolean),
    ),
  ];
  return names.length ? `Malakaviy amaliyot (${names.join(", ")})` : "Malakaviy amaliyot";
}

function practiceRowHeight(doc, label, labelW) {
  const h = measureNameH(doc, label, labelW, PRACT_FS);
  return Math.max(SEM_TOTAL_ROW_H, Math.ceil(h) + ROWPAD);
}

function altRowHeight(doc, alt, nameW) {
  const h = measureNameH(doc, alt.title, nameW, 5.5);
  return Math.max(ALT_ROW_H, Math.ceil(h) + ROWPAD);
}

function groupHeight(doc, sci, nameW, yakW) {
  let h = sciRowHeight(doc, sci, nameW, yakW);
  for (const alt of sci.alternatives || []) {
    h += altRowHeight(doc, alt, nameW - ALT_INDENT);
  }
  return h;
}

const isElectiveRow = (sci) =>
  isElectiveBlock({ blockCode: sci?.blockCode, title: sci?.blockTitle });
const electiveBandBefore = (list, i) =>
  isElectiveRow(list[i]) && (i === 0 || !isElectiveRow(list[i - 1]));

const semHours = (sci) => {
  const parts =
    (sci.lecture || 0) +
    (sci.practical || 0) +
    (sci.lab || 0) +
    (sci.seminar || 0);
  const audT = parts || sci.audTotal || 0;
  return { audT, umu: sci.totalHour || audT + (sci.independent || 0) };
};

function computeSemTotals(list, blockSerialIndex) {
  const tots = {
    umu: 0,
    audT: 0,
    mar: 0,
    amal: 0,
    lab: 0,
    sem: 0,
    mus: 0,
    wk: 0,
    kre: 0,
  };
  for (const sci of list || []) {
    const serials = blockSerialIndex
      ? blockSerialIndex.get(sci.blockCode || "") || []
      : [];
    if (isDoubleCountedHeader(sci, serials)) continue;
    const { audT, umu } = semHours(sci);
    tots.umu += umu;
    tots.audT += audT;
    tots.mar += sci.lecture || 0;
    tots.amal += sci.practical || 0;
    tots.lab += sci.lab || 0;
    tots.sem += sci.seminar || 0;
    tots.mus += sci.independent || 0;
    tots.wk += sci.weeklyHours || 0;
    tots.kre += sci.credit || 0;
  }
  return tots;
}

const YEAR_TOTAL_KEYS = ["umu", "audT", "mar", "amal", "lab", "sem", "mus", "wk", "kre"];

function workingPlanYearTotals(semesters) {
  const allSems = getAvailableSemesters(semesters);
  const semList = allSems.length >= 2 ? allSems.slice(0, 2) : ["1", "2"];
  const blockSerialIndex = buildBlockSerialIndex(semesters);
  const parts = [];
  for (const s of semList) {
    const rows = getSemesterSciences(semesters, s, blockSerialIndex);
    parts.push(computeSemTotals(rows.filter((r) => !isPracticeEntry(r)), blockSerialIndex));
    parts.push(computeSemTotals(rows.filter((r) => isPracticeEntry(r)), null));
  }
  const out = {};
  for (const k of YEAR_TOTAL_KEYS) {
    out[k] = parts.reduce((acc, t) => acc + (t[k] || 0), 0);
  }
  return out;
}

function planSemesterChunks(
  sciences,
  firstY,
  doc,
  tableW,
  tailRows = 3,
  practiceRows = [],
) {
  const list = sciences || [];
  const { CODE_W, NAME_W, YAK_W } = semColWidths(tableW);
  const practH = practiceRowHeight(
    doc,
    practiceRowLabel(practiceRows),
    CODE_W + NAME_W,
  );
  const tailH = tailRows * SEM_TOTAL_ROW_H + (practH - SEM_TOTAL_ROW_H);
  const chunks = [];
  let from = 0;
  let y = firstY + SEM_HEAD_H;
  let i = 0;
  while (i < list.length) {
    const gh =
      groupHeight(doc, list[i], NAME_W, YAK_W) +
      (electiveBandBefore(list, i) ? SEM_GRP_H : 0);
    const need = gh + (i === list.length - 1 ? tailH : 0);
    if (y + need > CONTENT_BOTTOM && i > from) {
      chunks.push({ from, to: i, totals: false });
      from = i;
      y = PG.M;
      continue;
    }
    y += gh;
    i++;
  }
  chunks.push({ from, to: list.length, totals: true });
  return chunks;
}

function drawSemesterTable(
  doc,
  x,
  y,
  tableW,
  semLabel,
  sciences,
  chunk,
  blockSerialIndex,
  opts = {},
) {
  const {
    practiceRows = [],
    startNo = 1,
    yearTotals = null,
  } = opts;
  const list = sciences || [];
  const range = chunk || { from: 0, to: list.length, totals: true };
  const {
    CODE_W,
    NAME_W,
    UMU_W,
    AUDT_W,
    MAR_W,
    AMAL_W,
    LAB_W,
    SEM_W,
    MUS_W,
    WEEK_W,
    KRE_W,
    YAK_W,
  } = semColWidths(tableW);

  const xCode = x,
    xName = xCode + CODE_W;
  const xUmu = xName + NAME_W,
    xAudT = xUmu + UMU_W;
  const xMar = xAudT + AUDT_W,
    xAmal = xMar + MAR_W;
  const xLab = xAmal + AMAL_W,
    xSem = xLab + LAB_W;
  const xMus = xSem + SEM_W,
    xWeek = xMus + MUS_W;
  const xKre = xWeek + WEEK_W;
  const xYak = xKre + KRE_W;

  const ROW_H = SEM_TOTAL_ROW_H,
    COL_H = SEM_COL_H,
    GRP_H = SEM_GRP_H;
  const loadW = UMU_W + AUDT_W + MAR_W + AMAL_W + LAB_W + SEM_W + MUS_W;
  const audW = AUDT_W + MAR_W + AMAL_W + LAB_W + SEM_W;

  if (range.from === 0) {
    bdr(doc, x, y, tableW, SEM_LABEL_H, null, 0.4);
    ct(doc, semLabel, x, y, tableW, SEM_LABEL_H, { fs: 7, bold: true, color: C.text });
    y += SEM_LABEL_H;

    bdr(doc, xUmu, y, loadW, GRP_H, null, 0.3);
    doc
      .font("Helvetica-Bold")
      .fontSize(6)
      .fillColor(C.text)
      .text("Talabaning o'quv yuklamasi, soatlarda", xUmu, y + 2, {
        width: loadW,
        align: "center",
        lineBreak: false,
        ellipsis: true,
      });
    y += GRP_H;

    bdr(doc, xAudT, y, audW, GRP_H, null, 0.3);
    doc
      .font("Helvetica-Bold")
      .fontSize(6)
      .fillColor(C.text)
      .text("Auditoriya mashg'ulotlari, soatlarda", xAudT, y + 2, {
        width: audW,
        align: "center",
        lineBreak: false,
        ellipsis: true,
      });
    y += GRP_H;

    const COLS = [
      { px: xCode, w: CODE_W, l: "Fanning malakaviy kodi", span: 2 },
      {
        px: xName,
        w: NAME_W,
        l: "O'quv fanlari va faoliyat turlarining nomlari",
        span: 2,
        horizontal: true,
      },
      { px: xUmu, w: UMU_W, l: "Umumiy yuklama hajmi", span: 1 },
      { px: xAudT, w: AUDT_W, l: "Jami", span: 0 },
      { px: xMar, w: MAR_W, l: "Ma'ruza", span: 0 },
      { px: xAmal, w: AMAL_W, l: "Amaliy", span: 0 },
      { px: xLab, w: LAB_W, l: "Laboratoriya", span: 0 },
      { px: xSem, w: SEM_W, l: "Seminar", span: 0 },
      { px: xMus, w: MUS_W, l: "Mustaqil ta'lim", span: 1 },
      { px: xWeek, w: WEEK_W, l: "Haftalik auditoriya soati", span: 2 },
      { px: xKre, w: KRE_W, l: "Kreditlar", span: 2 },
      { px: xYak, w: YAK_W, l: "Yakuniy baholash turi", span: 2 },
    ];
    for (const col of COLS) {
      const cTop = y - (col.span || 0) * GRP_H;
      const cH = COL_H + (col.span || 0) * GRP_H;
      bdr(doc, col.px, cTop, col.w, cH, null, 0.3);
      if (col.horizontal) {
        ctWrap(doc, col.l, col.px, cTop, col.w, cH, {
          fs: 7,
          color: C.text,
          align: "center",
        });
      } else {
        ctUp(doc, col.l, col.px, cTop, col.w, cH, { fs: 6, color: C.text });
      }
    }
    y += COL_H;

    let colNo = startNo;
    for (const col of COLS) {
      bdr(doc, col.px, y, col.w, SEM_NUM_H, C.mid, 0.3);
      ct(doc, String(colNo), col.px, y, col.w, SEM_NUM_H, {
        fs: 5,
        color: C.text,
      });
      colNo += 1;
    }
    y += SEM_NUM_H;

    bdr(doc, x, y, tableW, GRP_H, C.mid, 0.3);
    ct(doc, "Majburiy fanlar", x, y, tableW, GRP_H, {
      fs: 6.5,
      bold: true,
      color: C.text,
    });
    y += GRP_H;

  }

  const tots = computeSemTotals(list, blockSerialIndex);
  const pTots = computeSemTotals(practiceRows, null);
  for (let ri = range.from; ri < range.to; ri++) {
    const sci = list[ri];
    if (electiveBandBefore(list, ri)) {
      bdr(doc, x, y, tableW, GRP_H, C.mid, 0.3);
      ct(doc, "Tanlov fanlar", x, y, tableW, GRP_H, {
        fs: 6.5,
        bold: true,
        color: C.text,
      });
      y += GRP_H;
    }
    const bg = C.white;
    const { audT, umu } = semHours(sci);
    const rowH = sciRowHeight(doc, sci, NAME_W, YAK_W);
    const altHs = (sci.alternatives || []).map((alt) =>
      altRowHeight(doc, alt, NAME_W - ALT_INDENT),
    );
    const mergeH = altHs.reduce((s, h) => s + h, rowH);
    const CELLS = [
      { px: xCode, w: CODE_W, v: sci.code, al: "left", code: true, own: true },
      { px: xName, w: NAME_W, v: sci.title, al: "left", wrap: true, own: true },
      { px: xUmu, w: UMU_W, v: umu || "", umu: true },
      { px: xAudT, w: AUDT_W, v: audT || "" },
      { px: xMar, w: MAR_W, v: sci.lecture || "" },
      { px: xAmal, w: AMAL_W, v: sci.practical || "" },
      { px: xLab, w: LAB_W, v: sci.lab || "" },
      { px: xSem, w: SEM_W, v: sci.seminar || "" },
      { px: xMus, w: MUS_W, v: sci.independent || "" },
      { px: xWeek, w: WEEK_W, v: sci.weeklyHours || "" },
      { px: xKre, w: KRE_W, v: sci.credit || "" },
      { px: xYak, w: YAK_W, v: sci.evaluationType || "", al: "left", wrap: true },
    ];
    for (const c of CELLS) {
      const cellH = c.own ? rowH : mergeH;
      bdr(doc, c.px, y, c.w, cellH, c.umu ? C.mid : bg, 0.3);
      if (c.code) {
        ctFit(doc, c.v, c.px, y, c.w, cellH, { fs: 6, align: c.al || "center" });
      } else if (c.wrap) {
        ctWrap(doc, c.v, c.px, y, c.w, cellH, { fs: 6, align: c.al || "left" });
      } else {
        ct(doc, c.v, c.px, y, c.w, cellH, { fs: 6, align: c.al || "center" });
      }
    }
    y += rowH;

    for (const [ai, alt] of (sci.alternatives || []).entries()) {
      const altH = altHs[ai];
      const ALT_CELLS = [
        {
          px: xCode,
          w: CODE_W,
          v: `${ALT_MARK}${alt.code || ""}`,
          al: "left",
          code: true,
        },
        {
          px: xName,
          w: NAME_W,
          v: alt.title,
          al: "left",
          pad: ALT_INDENT,
          wrap: true,
        },
      ];
      for (const c of ALT_CELLS) {
        const pad = c.pad || 0;
        bdr(doc, c.px, y, c.w, altH, bg, 0.3);
        if (c.code) {
          ctFit(doc, c.v, c.px + pad, y, c.w - pad, altH, {
            fs: 5.5,
            align: c.al || "center",
            color: C.muted,
          });
        } else if (c.wrap) {
          ctWrap(doc, c.v, c.px + pad, y, c.w - pad, altH, {
            fs: 5.5,
            align: c.al || "left",
            color: C.muted,
          });
        } else {
          ct(doc, c.v, c.px + pad, y, c.w - pad, altH, {
            fs: 5.5,
            align: c.al || "center",
            color: C.muted,
          });
        }
      }
      y += altH;
    }
  }

  if (!range.totals) return y;

  const JAMI = [
    [xUmu, UMU_W, tots.umu],
    [xAudT, AUDT_W, tots.audT],
    [xMar, MAR_W, tots.mar],
    [xAmal, AMAL_W, tots.amal],
    [xLab, LAB_W, tots.lab],
    [xSem, SEM_W, tots.sem],
    [xMus, MUS_W, tots.mus],
    [xWeek, WEEK_W, tots.wk],
    [xKre, KRE_W, tots.kre],
    [xYak, YAK_W, ""],
  ];
  bdr(doc, xCode, y, CODE_W + NAME_W, ROW_H, C.mid, 0.3);
  ct(doc, "Jami", xCode, y, CODE_W + NAME_W, ROW_H, {
    fs: 7,
    bold: true,
    color: C.text,
  });
  for (const [px, w, v] of JAMI) {
    bdr(doc, px, y, w, ROW_H, C.mid, 0.3);
    ct(doc, v || "", px, y, w, ROW_H, { fs: 6, bold: true, color: C.text });
  }
  y += ROW_H;

  const practiceLabel = practiceRowLabel(practiceRows);
  const practH = practiceRowHeight(doc, practiceLabel, xUmu - xCode);
  bdr(doc, xCode, y, xUmu - xCode, practH, C.mid, 0.3);
  ctWrap(doc, practiceLabel, xCode, y, xUmu - xCode, practH, {
    fs: PRACT_FS,
    align: "left",
  });
  const PRACT = [
    [xUmu, UMU_W, pTots.umu],
    [xAudT, AUDT_W, ""],
    [xMar, MAR_W, ""],
    [xAmal, AMAL_W, ""],
    [xLab, LAB_W, ""],
    [xSem, SEM_W, ""],
    [xMus, MUS_W, ""],
    [xWeek, WEEK_W, ""],
    [xKre, KRE_W, pTots.kre],
    [xYak, YAK_W, ""],
  ];
  for (const [px, w, v] of PRACT) {
    bdr(doc, px, y, w, practH, C.mid, 0.3);
    ct(doc, v || "", px, y, w, practH, { fs: 6, color: C.text });
  }
  y += practH;

  const SEM_JAMI = [
    [xUmu, UMU_W, tots.umu + pTots.umu],
    [xAudT, AUDT_W, tots.audT + pTots.audT],
    [xMar, MAR_W, tots.mar + pTots.mar],
    [xAmal, AMAL_W, tots.amal + pTots.amal],
    [xLab, LAB_W, tots.lab + pTots.lab],
    [xSem, SEM_W, tots.sem + pTots.sem],
    [xMus, MUS_W, tots.mus + pTots.mus],
    [xWeek, WEEK_W, tots.wk + pTots.wk],
    [xKre, KRE_W, tots.kre + pTots.kre],
    [xYak, YAK_W, ""],
  ];
  bdr(doc, xCode, y, CODE_W + NAME_W, ROW_H, C.mid, 0.3);
  ct(doc, "Jami semestrda", xCode, y, CODE_W + NAME_W, ROW_H, {
    fs: 6,
    bold: true,
    color: C.text,
  });
  for (const [px, w, v] of SEM_JAMI) {
    bdr(doc, px, y, w, ROW_H, C.mid, 0.3);
    ct(doc, v || "", px, y, w, ROW_H, { fs: 6, bold: true, color: C.text });
  }
  y += ROW_H;

  if (yearTotals) {
    const YEAR = [
      [xUmu, UMU_W, yearTotals.umu],
      [xAudT, AUDT_W, yearTotals.audT],
      [xMar, MAR_W, yearTotals.mar],
      [xAmal, AMAL_W, yearTotals.amal],
      [xLab, LAB_W, yearTotals.lab],
      [xSem, SEM_W, yearTotals.sem],
      [xMus, MUS_W, yearTotals.mus],
      [xWeek, WEEK_W, yearTotals.wk],
      [xKre, KRE_W, yearTotals.kre],
      [xYak, YAK_W, ""],
    ];
    bdr(doc, xCode, y, CODE_W + NAME_W, ROW_H, C.mid, 0.3);
    ct(doc, "Jami o'quv yilida", xCode, y, CODE_W + NAME_W, ROW_H, {
      fs: 6,
      bold: true,
      color: C.text,
    });
    for (const [px, w, v] of YEAR) {
      bdr(doc, px, y, w, ROW_H, C.mid, 0.3);
      ct(doc, v || "", px, y, w, ROW_H, { fs: 6, bold: true, color: C.text });
    }
    y += ROW_H;
  }
  return y;
}

const subjectKey = (sci) => String(sci.science || sci.code || sci.title || "");

function mergeAlternatives(item, sci) {
  for (const alt of altList(sci)) {
    const key = subjectKey(alt);
    if (item.altKeys.has(key)) continue;
    item.altKeys.add(key);
    item.alternatives.push(alt);
  }
}

function flattenSubjectColumn(items, blockNo) {
  const rows = [];
  let idx = 1;
  for (const it of items) {
    rows.push({
      idx: `${blockNo}.${String(idx).padStart(2, "0")}`,
      code: it.code,
      title: it.title,
      credit: it.credit,
    });
    idx += 1;
    for (const alt of it.alternatives) {
      rows.push({ alt: true, code: alt.code, title: alt.title });
    }
  }
  return rows;
}

function buildSubjectRows(blocks) {
  const majburiy = [],
    tanlov = [];
  const seen = new Map();
  const blockSerialIndex = buildBlockSerialIndexFromBlocks(blocks);
  for (const blk of blocks || []) {
    const blockSerials = blockSerialIndex.get(blk.blockCode || "") || [];
    for (const sci of blk.sciences || []) {
      if (isDoubleCountedHeader(sci, blockSerials)) continue;
      if (isPracticeEntry(sci)) continue;
      const elective = isElectiveSlotRow(blk, sci);
      const key = `${elective ? "T" : "M"}:${subjectKey(sci)}`;
      const credit = Number(sci.totalCredit) || 0;
      const prev = seen.get(key);
      if (prev) {
        prev.credit += credit;
        mergeAlternatives(prev, sci);
        continue;
      }
      const item = {
        code: sci.code || "",
        title: sci.title || "—",
        credit,
        alternatives: [],
        altKeys: new Set(),
      };
      mergeAlternatives(item, sci);
      seen.set(key, item);
      if (elective) {
        tanlov.push(item);
      } else {
        majburiy.push(item);
      }
    }
  }

  return {
    majburiy: flattenSubjectColumn(majburiy, 1),
    tanlov: flattenSubjectColumn(tanlov, 2),
  };
}

const SUBJ_ROW_H = 13;
const SUBJ_TOTAL_H = 10;
const SUBJ_TITLE_H = 9;
const SUBJ_GRP_H = 9;
const SUBJ_HEAD_H = SUBJ_TITLE_H + SUBJ_GRP_H + 14;

const SUBJ_MIN_FIRST_ROWS = 3;

function subjectListNeedsFreshPage(y, rowCount) {
  const needH = SUBJ_HEAD_H + rowCount * SUBJ_ROW_H + SUBJ_TOTAL_H * 2;
  if (y + needH <= CONTENT_BOTTOM) return false;
  const freshCapH = CONTENT_BOTTOM - PG.M;
  if (needH <= freshCapH) return true;
  const firstRows = Math.floor((CONTENT_BOTTOM - y - SUBJ_HEAD_H) / SUBJ_ROW_H);
  return firstRows < SUBJ_MIN_FIRST_ROWS;
}

function altGroupSpan(rows, ri) {
  let span = 1;
  while (rows[ri + span] && rows[ri + span].alt === true) span += 1;
  return span;
}

function drawSubjectList(doc, x, y, fullW, blocks) {
  const halfW = Math.floor((fullW - 4) / 2);
  const COL = { no: 24, code: 58, cr: 26, name: 0 };
  COL.name = halfW - COL.no - COL.code - COL.cr;

  const { majburiy, tanlov } = buildSubjectRows(blocks);

  const drawHdr = (hx, hy, label, bg) => {
    bdr(doc, hx, hy, halfW, SUBJ_GRP_H, bg, 0.3);
    ct(doc, label, hx, hy, halfW, SUBJ_GRP_H, { fs: 6.5, bold: true, color: C.text });
  };

  const SUBHDR_H = 14;
  const drawSubHdr = (hx, hy) => {
    const lbls = ["T/r", "Fanning malakaviy kodi", "Fanning nomi", "Kreditlar"];
    const ws2 = [COL.no, COL.code, COL.name, COL.cr];
    let cx2 = hx;
    for (let i = 0; i < lbls.length; i++) {
      bdr(doc, cx2, hy, ws2[i], SUBHDR_H, null, 0.3);
      ctFit(doc, lbls[i], cx2, hy, ws2[i], SUBHDR_H, {
        fs: 6,
        bold: true,
        color: C.text,
      });
      cx2 += ws2[i];
    }
  };

  const drawHeadBlock = (hy) => {
    ct(doc, "III. FANLAR RO'YXATI", x, hy, fullW, SUBJ_TITLE_H, {
      fs: 7,
      bold: true,
      color: C.text,
    });
    hy += SUBJ_TITLE_H;
    drawHdr(x, hy, "Majburiy fanlar", C.mid);
    drawHdr(x + halfW + 4, hy, "Tanlov fanlar", C.mid);
    hy += SUBJ_GRP_H;
    drawSubHdr(x, hy);
    drawSubHdr(x + halfW + 4, hy);
    return hy + SUBHDR_H;
  };

  const ROW_H = SUBJ_ROW_H;
  const maxRows = Math.max(majburiy.length, tanlov.length);

  if (subjectListNeedsFreshPage(y, maxRows)) {
    doc.addPage(PAGE_OPTS);
    y = PG.M;
  }

  y = drawHeadBlock(y);
  const drawRow = (hx, rows, ri, ry) => {
    const item = rows[ri];
    if (!item) return;
    const bg = C.white;
    const isAlt = item.alt === true;
    const vals = isAlt
      ? ["", `${ALT_MARK}${item.code || ""}`, item.title]
      : [item.idx, item.code, item.title, item.credit];
    const ws2 = [COL.no, COL.code, COL.name, COL.cr];
    const aligns = ["center", "left", "left", "center"];
    const hs2 = [ROW_H, ROW_H, ROW_H, ROW_H * altGroupSpan(rows, ri)];
    let cx2 = hx;
    for (let i = 0; i < vals.length; i++) {
      const pad = isAlt && i === 2 ? ALT_INDENT : 0;
      const cellH = hs2[i];
      bdr(doc, cx2, ry, ws2[i], cellH, bg, 0.3);
      const cellOpts = {
        fs: isAlt ? 6 : 7,
        align: aligns[i],
        color: isAlt ? C.muted : C.text,
      };
      if (i === 1) {
        ctFit(doc, vals[i], cx2 + pad, ry, ws2[i] - pad, ROW_H, cellOpts);
      } else {
        ct(doc, vals[i], cx2 + pad, ry, ws2[i] - pad, cellH, cellOpts);
      }
      cx2 += ws2[i];
    }
  };

  const canBreakAt = (bi) =>
    bi >= maxRows || (!majburiy[bi]?.alt && !tanlov[bi]?.alt);

  let i = 0;
  let chunkStartY = y;
  let chunkStartIdx = 0;
  while (i < maxRows) {
    const cap = Math.max(1, Math.floor((CONTENT_BOTTOM - y) / ROW_H));
    let end = Math.min(i + cap, maxRows);
    if (end === maxRows) {
      while (
        end > i + 1 &&
        y + (end - i) * ROW_H + SUBJ_TOTAL_H > CONTENT_BOTTOM
      ) {
        end--;
      }
    }
    while (end > i + 1 && !canBreakAt(end)) end--;

    chunkStartY = y;
    chunkStartIdx = i;
    for (let ri = i; ri < end; ri++) {
      const ry = y + (ri - i) * ROW_H;
      drawRow(x, majburiy, ri, ry);
      drawRow(x + halfW + 4, tanlov, ri, ry);
    }
    y += (end - i) * ROW_H;
    i = end;
    if (i < maxRows) {
      doc.addPage(PAGE_OPTS);
      y = drawHeadBlock(PG.M);
    }
  }

  if (y + SUBJ_TOTAL_H * 2 > CONTENT_BOTTOM) {
    doc.addPage(PAGE_OPTS);
    y = drawHeadBlock(PG.M);
    chunkStartY = y;
    chunkStartIdx = maxRows;
  }

  const drawTotal = (hx, ty, label, total) => {
    const lblW = COL.no + COL.code + COL.name;
    bdr(doc, hx, ty, lblW, 10, C.mid, 0.3);
    ct(doc, label, hx, ty, lblW, 10, {
      fs: 6.5,
      bold: true,
      color: C.text,
      align: "left",
    });
    bdr(doc, hx + lblW, ty, COL.cr, 10, C.mid, 0.3);
    ct(doc, total, hx + lblW, ty, COL.cr, 10, {
      fs: 7,
      bold: true,
      color: C.text,
    });
  };
  const majTotal = majburiy.reduce((s, m) => s + (m.credit || 0), 0);
  const tanTotal = tanlov.reduce((s, t) => s + (t.credit || 0), 0);

  const tanlovRowsHere = Math.max(0, Math.min(tanlov.length, i) - chunkStartIdx);
  let tanlovTotalY = chunkStartY + tanlovRowsHere * ROW_H;
  let grandY = y;
  if (tanlovTotalY > y - SUBJ_TOTAL_H) {
    tanlovTotalY = y;
    grandY = y + SUBJ_TOTAL_H;
  }

  drawTotal(x + halfW + 4, tanlovTotalY, "Tanlov fanlar bo'yicha jami kreditlar", tanTotal);
  drawTotal(x, y, "Majburiy fanlar bo'yicha jami kreditlar", majTotal);
  drawTotal(
    x + halfW + 4,
    grandY,
    "O'quv yilidagi barcha fanlar bo'yicha jami kreditlar",
    majTotal + tanTotal,
  );
  return grandY + 10;
}

const nonEmptyRows = (rows) => (Array.isArray(rows) && rows.length ? rows : null);

async function readLpTableFields(lpId) {
  try {
    const lp = await LearningProcessModel.findById(lpId)
      .select("attestationNote summaryRows")
      .lean();
    return lp || {};
  } catch (err) {
    winston.error(`[workingPlan.pdf] attestationNote/summaryRows o'qilmadi: ${err.message}`);
    return {};
  }
}

async function resolveProcessTableSources(ws) {
  const attestationNote = ws.attestationNote || null;
  const summaryRows = nonEmptyRows(ws.summaryRows);
  if ((attestationNote && summaryRows) || !ws.learningProcess) {
    return { attestationNote, summaryRows };
  }
  const lp = await readLpTableFields(ws.learningProcess);
  return {
    attestationNote: attestationNote || lp.attestationNote || null,
    summaryRows: summaryRows || nonEmptyRows(lp.summaryRows),
  };
}

const PROCESS_KEY_TO_LETTER = {
  theoreticalPractical: " ",
  ...Object.fromEntries(
    Object.entries(STAT_LEGEND_TO_KEY).map(([letter, key]) => [key, letter]),
  ),
};

function orderProcessRows(rows, summaryRows) {
  const ordered = orderByLabels(
    rows.filter((r) => !r.jami),
    summaryRows,
    (r) => PROCESS_KEY_TO_LETTER[r.k],
  ).map(({ item, label }) => (label ? { ...item, l: label } : item));
  return [...ordered, ...rows.filter((r) => r.jami)];
}

function drawProcessTable(doc, x, y, w, ws, attestationNote, summaryRows) {
  const COMP_W = Math.floor(w * 0.42);
  const HAFTA_W = Math.floor(w * 0.13);
  const SEM_W = Math.floor(w * 0.13);
  const ATT_W = w - COMP_W - HAFTA_W - SEM_W;
  const ROW_H = 13,
    HDR_H = 13;
  const st = statisticsMap(
    ws.courses?.[0]?.statistics ?? ws.allValues?.statistics ?? ws.statistics,
  );

  const s1 = semesterDisplayNo("1", ws.currentCourse);
  const s2 = semesterDisplayNo("2", ws.currentCourse);
  const ROWS = orderProcessRows([
    { l: "Nazariy va amaliy ta'lim", k: "theoreticalPractical", sem: `${s1}-${s2}` },
    { l: "Attestatsiyalar", k: "certification", sem: `${s1}-${s2}` },
    { l: "Kredit ta'lim tizimiga kirish", k: "creditSystem", sem: s1 },
    { l: "Malakaviy amaliyot", k: "qualification", sem: `${s1}-${s2}` },
    { l: "Ta'til haftalari", k: "vacation", sem: `${s1}-${s2}` },
    { l: "Yakuniy davlat attestatsiyasi", k: "final", sem: "-" },
    { l: "GPA ko'rsatgichini hisoblash", k: "gpa", sem: s2 },
    { l: "Jami", k: "total", sem: "", jami: true },
  ], summaryRows);

  y = ensureRoom(doc, y, HDR_H + ROWS.length * ROW_H);

  const HDR_CELLS = [
    [x, COMP_W, "O'quv jarayonining tarkibiy qismlari", "right"],
    [x + COMP_W, HAFTA_W, "Haftalar soni", "center"],
    [x + COMP_W + HAFTA_W, SEM_W, "Semestr", "center"],
    [x + COMP_W + HAFTA_W + SEM_W, ATT_W, "Davlat attestatsiyasi", "center"],
  ];
  for (const [px, cw, lbl, al] of HDR_CELLS) {
    bdr(doc, px, y, cw, HDR_H, null, 0.3);
    ct(doc, lbl, px, y, cw, HDR_H, {
      fs: 6.5,
      bold: true,
      align: al,
      color: C.text,
    });
  }
  y += HDR_H;

  const attRowsCount = ROWS.filter((r) => !r.jami).length;
  const attTotalH = attRowsCount * ROW_H;
  const attY = y;
  const attText = san(
    attestationNote ||
      "Ixtisoslik fanlaridan integrallashgan yakuniy davlat attestatsiyasi",
  );

  for (let ri = 0; ri < ROWS.length; ri++) {
    const row = ROWS[ri];
    const val =
      row.k === "total"
        ? (st.total ?? ws.allValues?.total ?? "")
        : (st[row.k] ?? "");

    const bg = C.white;
    const fc = C.text;

    bdr(doc, x, y, COMP_W, ROW_H, bg, 0.3);
    bdr(doc, x + COMP_W, y, HAFTA_W, ROW_H, bg, 0.3);
    bdr(doc, x + COMP_W + HAFTA_W, y, SEM_W, ROW_H, bg, 0.3);

    if (!row.jami) {
      if (ri === 0) {
        bdr(
          doc,
          x + COMP_W + HAFTA_W + SEM_W,
          attY,
          ATT_W,
          attTotalH,
          null,
          0.3,
        );
        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor(C.text)
          .text(
            attText,
            x + COMP_W + HAFTA_W + SEM_W + 2,
            attY + attTotalH / 2 - 8,
            { width: ATT_W - 4, height: attTotalH, align: "center" },
          );
      }
    } else {
      bdr(doc, x + COMP_W + HAFTA_W + SEM_W, y, ATT_W, ROW_H, null, 0.5);
    }

    ct(doc, row.l, x, y, COMP_W, ROW_H, {
      fs: 6.5,
      align: "right",
      color: fc,
      bold: row.jami,
    });
    ct(
      doc,
      val === 0 ? (row.jami ? "0" : "") : val || "",
      x + COMP_W,
      y,
      HAFTA_W,
      ROW_H,
      { fs: 7, bold: row.jami, color: fc },
    );
    ct(doc, row.sem, x + COMP_W + HAFTA_W, y, SEM_W, ROW_H, {
      fs: 6.5,
      color: fc,
    });
    y += ROW_H;
  }
  return y;
}

function drawNotes(doc, x, y, w, ws) {
  const DEFAULT_NOTES = [
    "1) 1 kredit 30 akademik soatni tashkil qiladi.",
    "2) O'quv reja asosida ishchi o'quv rejasini tuzishda talabalar yuklamasining haftalik hajmini saqlagan holda o'quv fanlari bloki hajmini 5 foizgacha, bloklar tarkibidagi fanlar hajmini 10 foizgacha o'zgartirish hamda auditoriya yuklamasining umumiy hajmini saqlagan holda ayrim semestrlarda haftalik yuklamalar hajmini erkin belgilash mumkin.",
    "3) O'quv rejaga kirtiladigan ixtisoslikka oid fanlarning amaliy mashg'ulotlari va laboratoriya ishlari oliy ta'lim muassasasi hamda bazaviy tashkilot va korxonalarda o'tkaziladi.",
    "4) Nazariya va amaliyot yaxlitligini ta'minlash uchun talabalarning malakaviy amaliyotlari bazaviy tashkilot va korxonalarda o'tkaziladi.",
  ];
  let notes = DEFAULT_NOTES;
  if (ws.comment && String(ws.comment).trim()) {
    notes = String(ws.comment).split("\n").filter(Boolean);
  } else if (Array.isArray(ws.comments) && ws.comments.length) {
    notes = ws.comments;
  }

  y += 2;
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(C.text)
    .text("Izoh:", x + 10, y);
  y = doc.y + 3;

  for (const note of notes) {
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(C.text)
      .text(san(note), x + 10, y, { width: w - 15, lineGap: 1 });
    y = doc.y + 2;
  }
  return y;
}

async function drawSignatures(doc, x, y, w, ws, qr = null) {
  const mh = ws.methodicalHead;
  const fd = ws.facultyDean;
  const wsVerifySnapshot =
    ws.verify && Array.isArray(ws.verify.snapshot) ? ws.verify.snapshot : undefined;

  let approvalText = "";
  if (typeof ws.approval === "string") {
    approvalText = san(ws.approval);
  } else if (ws.approval && typeof ws.approval === "object") {
    const parts = [
      san(ws.approval.title),
      san(ws.approval.date),
      san(ws.approval.protocol),
    ].filter(Boolean);
    approvalText = parts.join(" ");
  }
  if (!approvalText) {
    approvalText =
      "Farg'ona jamoat salomatligi tibbiyot instituti kengashida ma'qullangan " +
      '202__ yil "___" ________ __-sonli bayonnoma';
  }

  const appW = 210;
  const appX = x + w - appW;
  const ROW_H = 18;
  const posW = 210,
    nameW = 130;
  const rowW = posW + 80 + nameW;

  const approvalH = doc
    .font("Helvetica")
    .fontSize(8)
    .heightOfString(approvalText, { width: appW, align: "center" });

  const SIG_ROWS = [
    {
      step: "methodical",
      block: "methodicalHead",
      personField: "leader",
      position: san(
        mh?.position || resolveStepLabel("workingSchedule", "methodical"),
      ),
    },
    {
      step: "dean",
      block: "facultyDean",
      personField: "dean",
      position: san(fd?.position || resolveStepLabel("workingSchedule", "dean")),
    },
  ].map((row) => {
    const sig = resolveSignatory(ws, {
      step: row.step,
      block: row.block,
      personField: row.personField,
      snapshot: wsVerifySnapshot,
      steps: ws.approvalHistory,
      compact: true,
    });
    return {
      x: x + 30,
      w: rowW,
      layout: "row",
      position: row.position,
      sig: { ...sig, dateText: "" },
      qr: qr ? { image: qr.image, size: QR_SIZE_ROW } : undefined,
    };
  });
  const ROW_GAP = qr ? 6 : 0;
  const rowsH = SIG_ROWS.reduce(
    (sum, opts) => sum + Math.max(ROW_H, measureSignatureBlock(doc, opts)) + ROW_GAP,
    0,
  );

  y = ensureRoom(doc, y, approvalH + 10 + rowsH);

  const APPROVAL_GAP = 16;
  y += Math.max(
    0,
    Math.min(APPROVAL_GAP, CONTENT_BOTTOM - (y + approvalH + 10 + rowsH)),
  );

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(C.text)
    .text(approvalText, appX - 30, y, {
      width: appW,
      height: approvalH,
      align: "center",
    });
  const sigY0 = y + approvalH + 10;
  let sigY = sigY0;

  for (const opts of SIG_ROWS) {
    const rowH = drawSignatureBlock(doc, { ...opts, y: sigY });
    sigY += Math.max(ROW_H, rowH) + ROW_GAP;
  }
}

function _drawPageFooter(doc, pageNum, totalPages) {
  const footerY = PG.H - PG.M - 20;
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor("#aaaaaa")
    .text(`Ishchi o'quv reja  |  ${pageNum} / ${totalPages}`, PG.M, footerY, {
      width: CW,
      height: 16,
      align: "center",
      lineBreak: false,
    });
}

async function buildWorkingRejaDoc(id) {
  const wp = await WorkingPlanModel.findById(id).exec();
  if (!wp) throw new Error("Ishchi o'quv rejasi topilmadi");
  await fillMissingCodesFromCatalog(wp.semesters);

  const ws = await WorkingScheduleModel.findById(wp.workingSchedule)
    .populate("direction", "title directionCode")
    .populate("academicLevel", "title")
    .populate("educationForm", "title")
    .populate("readingForm", "title")
    .populate("studyPeriod", "title")
    .populate("specialization", "title")
    .populate("agreed.viceRector", "firstName lastName middleName")
    .populate("confirmation.rector", "firstName lastName middleName")
    .populate("methodicalHead.leader", "firstName lastName middleName")
    .populate("facultyDean.dean", "firstName lastName middleName")
    .populate("approvalHistory.approvedBy", "firstName lastName middleName")
    .populate("academicYear", "title")

    .exec();
  if (!ws) throw new Error("Ishchi o'quv reja grafigi topilmadi");

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: PG.M, bottom: PG.M, left: PG.M, right: PG.M },
    info: { Creator: "Institut AIS", Producer: "PDFKit" },
    bufferPages: true,
  });
  registerCyrillicFonts(doc);

  const allSems = getAvailableSemesters(wp.semesters);
  const semList = allSems.length >= 2 ? allSems.slice(0, 2) : ["1", "2"];
  const semLabel = (localKey) =>
    `${semesterDisplayNo(localKey, ws.currentCourse)}-SEMESTR`;
  const blockSerialIndex = buildBlockSerialIndex(wp.semesters);

  const semData = {};
  for (const s of semList) {
    semData[s] = getSemesterSciences(wp.semesters, s, blockSerialIndex);
  }

  const verifyQr = await prepareVerifyQr(ws, {
    docType: "workingSchedule",
    allowInReview: true,
  });

  const headerH = drawHeader(doc, ws, verifyQr);
  let y = PG.M + headerH + 5;

  y = drawCalendar(doc, PG.M, y, CW, ws);
  y += 4;

  const semFirstChunkMinH = SEM_HEAD_H + SEM_ROW_H;
  y = ensureRoom(doc, y, 10 + semFirstChunkMinH);

  ct(doc, san(wp.studyPlanLabel) || "II. O'QUV REJASI", PG.M, y, CW, 10, {
    fs: 7,
    bold: true,
    color: C.text,
  });
  y += 10;

  const semW = Math.floor((CW - 4) / 2);
  const splitPractice = (rows) => {
    const sci = [];
    const prac = [];
    for (const r of rows || []) (isPracticeEntry(r) ? prac : sci).push(r);
    return { sci, prac };
  };
  const A = splitPractice(semData[semList[0]]);
  const B = splitPractice(semData[semList[1]]);
  const semA = A.sci;
  const semB = B.sci;
  const yearTotals = workingPlanYearTotals(wp.semesters);
  const chunksA = planSemesterChunks(semA, y, doc, semW, 3, A.prac);
  const chunksB = planSemesterChunks(semB, y, doc, semW, 4, B.prac);
  const semPages = Math.max(chunksA.length, chunksB.length);
  let semEndY = y;
  for (let p = 0; p < semPages; p++) {
    if (p > 0) {
      doc.addPage(PAGE_OPTS);
      y = PG.M;
      semEndY = y;
    }
    if (chunksA[p]) {
      const endA = drawSemesterTable(
        doc,
        PG.M,
        y,
        semW,
        semLabel(semList[0]),
        semA,
        chunksA[p],
        blockSerialIndex,
        { practiceRows: A.prac, startNo: 1 },
      );
      semEndY = Math.max(semEndY, endA);
    }
    if (chunksB[p]) {
      const endB = drawSemesterTable(
        doc,
        PG.M + semW + 4,
        y,
        semW,
        semLabel(semList[1]),
        semB,
        chunksB[p],
        blockSerialIndex,
        { practiceRows: B.prac, startNo: 13, yearTotals },
      );
      semEndY = Math.max(semEndY, endB);
    }
  }

  let y2 = ensureRoom(doc, semEndY + 6, SUBJ_HEAD_H + SUBJ_ROW_H);
  y2 = drawSubjectList(doc, PG.M, y2, CW, getAllBlocks(wp.semesters));
  y2 += 2;
  y2 = drawNotes(doc, PG.M, y2, CW, ws);
  y2 += 2;
  const tableSrc = await resolveProcessTableSources(ws);
  y2 = drawProcessTable(doc, PG.M, y2, CW, ws, tableSrc.attestationNote, tableSrc.summaryRows);
  await drawSignatures(doc, PG.M, y2, CW, ws, verifyQr);

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.x = PG.M;
    doc.y = PG.M;
    _drawPageFooter(doc, i + 1, range.count);
  }
  doc.flushPages();
  return doc;
}

async function generateWorkingPlanPdf(req, res, next) {
  try {
    const doc = await buildWorkingRejaDoc(req.params.id);
    pipeToResponse(res, doc, `ishchi-oqyuv-reja-${req.params.id}`);
    doc.end();
  } catch (err) {
    winston.error(`[workingPlan.pdf] PDF yaratishda xatolik: ${err.message}`);
    return next(new ErrorHandler(400, "Ishchi o'quv reja PDF yaratishda xatolik", err.message));
  }
}

module.exports = {
  generateWorkingPlanPdf,
  buildWorkingRejaDoc,
  buildSubjectRows,
  getAllBlocks,
  planSemesterChunks,
  fillMissingCodes,
  fillMissingCodesFromCatalog,
  subjectListNeedsFreshPage,
  SUBJ_MIN_FIRST_ROWS,
  workingPlanYearTotals,
};
