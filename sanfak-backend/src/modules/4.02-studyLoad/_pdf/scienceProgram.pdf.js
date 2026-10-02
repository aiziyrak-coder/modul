const { ErrorHandler } = require("#shared/error");
"use strict";

const path = require("path");
const PDFDocument = require("pdfkit");
const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const { academicYearLabel } = require("./academicYearLabel");
const { buildScienceProgramV142Pdf } = require("./scienceProgramV142.pdf");
const { areaText } = require("./programAreas");
const {
  resolveSignatory,
  BLANK_DATE,
} = require("#modules/4.02-studyLoad/_shared/signatories");
const { drawSignatureBlock } = require("#modules/4.02-studyLoad/_shared/signatureBlock");
const {
  prepareVerifyQr,
  QR_SIZE_SLOT,
} = require("#modules/4.02-studyLoad/_shared/verifyQr");

const { FONT_DIR } = require("#shared/pdfGenerators/pdfHelpers");
const F = {
  regular: path.join(FONT_DIR, "times.ttf"),
  bold: path.join(FONT_DIR, "timesbd.ttf"),
  italic: path.join(FONT_DIR, "timesi.ttf"),
  boldIt: path.join(FONT_DIR, "timesbi.ttf"),
};

const PW = 595,
  PH = 842,
  M = 50;
const CW = PW - M * 2;
const BOTTOM = PH - M - 20;

const NO_W = Math.round(CW * 0.08);
const BODY_W = CW - NO_W;
const PAGE_H = BOTTOM - M;
const ROW_PAD_Y = 3;
const ROW_PAD_X = 4;
const PARA_GAP = 2;
const FS_BODY = 12;
const FS_HEADING = 12;
const FS_META_HDR = 11;
const FS_META_VAL = 12;
const FS_META_SUB = 9;
const COVER_POSITION_FS = 12;
const COVER_REG_FS = 11;
const REG_BLANK = "________";

const C = {
  dark: "#000",
  text: "#111",
  muted: "#333",
  border: "#000",
  white: "#fff",
  green: "#1a7a4a",
  red: "#c0392b",
  light: "#f5f5f5",
};

const APPROVAL_CHAIN_DESC = [
  "dean",
  "rektor",
  "prorektor",
  "methodical",
  "arm",
  "kafedra",
  "teacher",
];
const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function chainHasDeanStep(sp) {
  const steps = sp && Array.isArray(sp.approvalSteps) ? sp.approvalSteps : [];
  return steps.some((st) => st && st.step === "dean");
}

function findApprovalProtocolStep(steps) {
  if (!Array.isArray(steps) || !steps.length) return null;
  for (const key of APPROVAL_CHAIN_DESC) {
    const s = steps.find(
      (st) => st && st.step === key && st.status === "approved" && st.protocol,
    );
    if (s) return s;
  }
  return null;
}

function responsibleHeading(responsible) {
  const title = san(responsible && responsible.title).trim();
  const desc = san(responsible && responsible.desc).trim();
  return title && title !== desc ? title : "Fan-modul uchun mas'ullar:";
}

function buildAutoApprovalInfo(sp) {
  const step = findApprovalProtocolStep(sp && sp.approvalSteps);
  if (!step) return null;
  const dt = new Date(step.date || sp.updatedAt || Date.now());
  const sana = `${dt.getFullYear()}-yil ${dt.getDate()}-${UZ_MONTHS[dt.getMonth()]}dagi`;
  const kengash =
    step.step === "dean"
      ? facultyKengashiLabel(resolveDeanFacultyName(sp))
      : "Farg'ona jamoat salomatligi tibbiyot instituti Ilmiy kengashining";
  return (
    "Fan dasturi Oliy ta'lim yo'nalishlari va mutaxassisliklari bo'yicha " +
    `${kengash} ` +
    `${sana} ${step.protocol}-sonli bayonnomasi bilan ma'qullangan.`
  );
}

const {
  resolveDeanFacultyName,
  facultyKengashiLabel,
  buildDeanConfirmationBlock,
} = require("./scienceProgramDean");

function sumHourItems(sp, slugs) {
  if (!sp || !Array.isArray(sp.hourItems) || !sp.hourItems.length) return null;
  let sum = 0,
    found = false;
  for (const h of sp.hourItems) {
    if (h && slugs.includes(h.slug)) {
      sum += Number(h.value) || 0;
      found = true;
    }
  }
  return found ? sum : null;
}

function san(v) {
  if (v == null) return "";
  if (typeof v === "object")
    return san(v.uz || v.ru || v.en || v.title || v.name || "");
  return String(v);
}

function chk(doc, y, n = 30) {
  if (y + n > BOTTOM) {
    doc.addPage();
    return M;
  }
  return y;
}

function registrationLine(sp) {
  const code = san(sp.directions?.[0]?.directionCode).trim();
  const serial = san(sp.serialNumber).trim();
  const no = code && serial ? `${code} ${serial}` : REG_BLANK;
  return `Ro'yxatga olindi: № ${no}`;
}

function registerFonts(doc) {
  doc.registerFont("TNR", F.regular);
  doc.registerFont("TNR-B", F.bold);
  doc.registerFont("TNR-I", F.italic);
  doc.registerFont("TNR-BI", F.boldIt);
}

function cell(doc, text, x, y, w, h, opts = {}) {
  const {
    bold = false,
    bg = null,
    align = "left",
    fs = 10,
    color = C.text,
    placeholder = true,
  } = opts;
  if (bg) doc.rect(x, y, w, h).fill(bg);
  doc.rect(x, y, w, h).strokeColor(C.border).lineWidth(0.5).stroke();
  const str = san(text) || (placeholder ? "\u2014" : "");
  if (!str) return;
  doc.font(bold ? "TNR-B" : "TNR").fontSize(fs);
  const oneLine = fs * 1.2;
  const measured = doc.heightOfString(str, { width: w - 6, align, lineBreak: true });
  const textH = measured > oneLine * 1.05 ? measured : oneLine;
  const ty = y + Math.max(0, (h - textH) / 2);
  doc
    .fillColor(color)
    .text(str, x + 3, ty, {
      width: w - 6,
      align,
      lineBreak: true,
    });
}

async function drawCoverPage(doc, sp, dirNames, verifyQr) {
  const conf = sp.confirmation || {};
  const titleText =
    "O'ZBEKISTON RESPUBLIKASI SOG'LIQNI SAQLASH VAZIRLIGI\nO'ZBEKISTON RESPUBLIKASI OLIY TA'LIM, FAN VA INNOVATSIYALAR VAZIRLIGI\nFARG'ONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI";
  const lines = titleText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let y = M + 10;
  for (const l of lines) {
    doc
      .font("TNR-B")
      .fontSize(12)
      .fillColor(C.dark)
      .text(l, M, y, { width: CW, align: "center" });
    y = doc.y + 2;
  }

  y = Math.max(y + 12, PH * 0.22);
  const tX = M + CW * 0.42,
    tW = CW * 0.58;

  const headingText = `"${san(conf.confirm) || "TASDIQLAYMAN"}"`;
  let confSig, confPosition;
  if (sp.formVersion === "v142" || chainHasDeanStep(sp)) {
    const block = buildDeanConfirmationBlock(sp);
    confPosition = block.position;
    confSig = { name: block.name, dateText: block.date, source: block.source };
  } else {
    confPosition =
      san(conf.position) || "Farg'ona jamoat salomatligi tibbiyot instituti rektori";
    confSig = resolveSignatory(sp, {
      step: "rektor",
      block: "confirmation",
      personField: "rector",
      snapshot: sp.verify?.snapshot,
    });
  }
  const confH = drawSignatureBlock(doc, {
    x: tX,
    y,
    w: tW,
    align: "center",
    heading: headingText,
    position: { text: confPosition, fs: COVER_POSITION_FS },
    sig: confSig,
    fonts: { bold: "TNR-B", regular: "TNR", italic: "TNR-I" },
    scale: 1.4,
    qr: verifyQr ? { image: verifyQr.image, size: QR_SIZE_SLOT } : undefined,
    emptySlotGap: 4,
  });
  y += confH;
  if (sp.formVersion !== "v142" && conf.desc) {
    doc
      .font("TNR")
      .fontSize(10)
      .fillColor(C.dark)
      .text(san(conf.desc), tX, y, { width: tW, align: "center" });
    y = doc.y + 2;
    doc
      .font("TNR")
      .fontSize(10)
      .fillColor(C.dark)
      .text(BLANK_DATE, tX, y, {
        width: tW,
        align: "center",
      });
    y = doc.y;
  }

  y += 10;
  doc
    .font("TNR-B")
    .fontSize(COVER_REG_FS)
    .fillColor(C.dark)
    .text(registrationLine(sp), tX, y, { width: tW, align: "center" });
  y = doc.y + 2;
  doc
    .font("TNR")
    .fontSize(COVER_REG_FS)
    .fillColor(C.dark)
    .text(BLANK_DATE, tX, y, { width: tW, align: "center" });
  y = doc.y;

  const sciName = san(sp.science?.name || sp.science?.title) || "Fan nomi";
  const nameY = Math.max(y + 40, PH * 0.42);
  doc
    .font("TNR-B")
    .fontSize(16)
    .fillColor(C.dark)
    .text(sciName.toUpperCase(), M, nameY, { width: CW, align: "center" });
  y = doc.y + 6;
  doc
    .font("TNR-B")
    .fontSize(13)
    .fillColor(C.dark)
    .text(sp.label || "O'QUV DASTURI", M, y, { width: CW, align: "center" });
  y = doc.y + 30;

  const valX = M + 230,
    valW = CW - 230;
  const pairs = [
    ["Bilim sohasi:", areaText(sp, "knowledgeArea", "—")],
    ["Ta'lim sohasi:", areaText(sp, "educationArea", "—")],
    ["Ta'lim yo'nalishi:", dirNames?.length ? dirNames.join("; ") : "—"],
  ];
  for (const [lb, vl] of pairs) {
    doc
      .font("TNR-B")
      .fontSize(11)
      .fillColor(C.dark)
      .text(lb, M + 60, y, { width: 165 });
    doc
      .font("TNR")
      .fontSize(11)
      .fillColor(C.dark)
      .text(vl, valX, y, { width: valW });
    y = Math.max(doc.y + 2, y + 15);
  }

  const ayLabel = academicYearLabel(sp.academicYear);
  const cityYear =
    sp.location ||
    `${sp.city || "FARG'ONA"} \u2013 ${ayLabel ? ayLabel.split("/")[0] : new Date().getFullYear()} YIL`;
  doc
    .font("TNR-B")
    .fontSize(12)
    .fillColor(C.dark)
    .text(cityYear, M, PH - M - 35, { width: CW, align: "center" });
  doc.addPage();
}

function drawMetaTable(doc, sp, y, sciName) {
  const R = 22;
  const c1 = Math.floor(CW * 0.32),
    c2 = Math.floor(CW * 0.18),
    c3 = Math.floor(CW * 0.18),
    c4 = CW - c1 - c2 - c3;
  const xs = [M, M + c1, M + c1 + c2, M + c1 + c2 + c3];
  const H = { bold: true, fs: FS_META_HDR, color: C.dark, align: "center" };
  const V = { align: "center", fs: FS_META_VAL };

  cell(doc, "Fan/modul kodi", xs[0], y, c1, R, H);
  cell(doc, "O'quv yili", xs[1], y, c2, R, H);
  cell(doc, "Semestr", xs[2], y, c3, R, H);
  cell(doc, "ECTS - Kreditlar", xs[3], y, c4, R, H);
  y += R;
  cell(doc, sp.code, xs[0], y, c1, R, V);
  cell(doc, academicYearLabel(sp.academicYear), xs[1], y, c2, R, V);
  cell(doc, sp.semester, xs[2], y, c3, R, V);
  cell(doc, sp.credits != null ? String(sp.credits) : null, xs[3], y, c4, R, V);
  y += R;
  cell(doc, "Fan/modul turi", xs[0], y, c1, R, H);
  cell(doc, "Ta'lim tili", xs[1], y, c2, R, H);
  cell(doc, "Haftadagi dars soatlari", xs[2], y, c3 + c4, R, H);
  y += R;
  cell(doc, sp.moduleType, xs[0], y, c1, R, V);
  cell(doc, sp.language, xs[1], y, c2, R, V);
  cell(
    doc,
    sp.weeklyHours != null ? String(sp.weeklyHours) : null,
    xs[2],
    y,
    c3 + c4,
    R,
    V,
  );
  y += R;

  if (sp.formVersion === "v142") {
    cell(doc, "O'quv rejadagi tartib raqami", xs[0], y, c1 + c2, R, H);
    cell(doc, sp.serialNumber, xs[2], y, c3 + c4, R, V);
    y += R;
  }

  const R3 = 40,
    nc = NO_W,
    nmC = c1 - nc;
  const NAME_ROW_H = 26;
  const NAME_FS = FS_META_VAL;
  const nameH = doc
    .font("TNR")
    .fontSize(NAME_FS)
    .heightOfString(sciName, { width: nmC - 6, lineBreak: true });
  const rowH = Math.max(NAME_ROW_H, Math.ceil(nameH) + 6);
  cell(doc, "1.", M, y, nc, R3 + rowH, { fs: FS_META_VAL, align: "center" });
  const SUB = { bold: true, fs: FS_META_SUB, color: C.dark, align: "center", placeholder: false };
  cell(doc, "Fanning nomi", M + nc, y, nmC, R3, { ...SUB, fs: FS_META_HDR });
  cell(doc, "Auditoriya\nMashg'ulotlari\n(soat)", xs[1], y, c2, R3, SUB);
  cell(doc, "Mustaqil\nta'lim\n(soat)", xs[2], y, c3, R3, SUB);
  cell(doc, "Jami\nyuklama\n(soat)", xs[3], y, c4, R3, SUB);
  y += R3;
  cell(doc, sciName, M + nc, y, nmC, rowH, { fs: NAME_FS });
  const classroom = sumHourItems(sp, [
    "maruza",
    "seminar",
    "laboratoriya",
    "amaliy",
    "klinik_amaliyot",
  ]);
  const independent = sumHourItems(sp, ["mustaqil"]);
  const totalH = sumHourItems(sp, [
    "maruza",
    "seminar",
    "laboratoriya",
    "amaliy",
    "klinik_amaliyot",
    "mustaqil",
  ]);
  const clVal = classroom != null ? classroom : sp.classroomHours;
  const inVal = independent != null ? independent : sp.independentHours;
  const toVal = totalH != null ? totalH : sp.totalHours;
  cell(doc, clVal != null ? String(clVal) : null, xs[1], y, c2, rowH, V);
  cell(doc, inVal != null ? String(inVal) : null, xs[2], y, c3, rowH, V);
  cell(doc, toVal != null ? String(toVal) : null, xs[3], y, c4, rowH, V);
  return y + rowH;
}

const P = {
  heading: (title) => ({
    text: san(title),
    font: "TNR-B",
    fs: FS_HEADING,
    color: C.dark,
    align: "left",
    keepNext: true,
  }),
  center: (text, opts = {}) => ({
    text: san(text),
    font: "TNR-B",
    fs: opts.fs || FS_HEADING,
    color: C.dark,
    align: "center",
    dx: opts.dx || 0,
    dw: opts.dw || 0,
    keepNext: opts.keepNext !== false,
  }),
  text: (text, opts = {}) => {
    const indent = opts.indent === undefined ? 20 : opts.indent;
    return {
      text: san(text),
      font: "TNR",
      fs: FS_BODY,
      color: C.text,
      align: "justify",
      dx: indent,
      dw: 0,
      indent: 20,
    };
  },
  lead: (bold, normal) => ({
    lead: { text: `${san(bold)} – `, font: "TNR-B" },
    text: san(normal),
    font: "TNR",
    fs: FS_BODY,
    color: C.text,
    align: "justify",
    dx: 20,
    dw: 0,
    indent: 20,
  }),
  note: (text, dx, dw, keepNext = false) => ({
    text,
    font: "TNR-I",
    fs: FS_BODY,
    color: C.dark,
    align: "left",
    dx,
    dw,
    keepNext,
  }),
  bold: (text, opts = {}) => ({
    text: san(text),
    font: "TNR-B",
    fs: FS_BODY,
    color: C.dark,
    align: opts.align || "left",
    dx: opts.dx || 0,
    dw: opts.dw || 0,
    keepNext: opts.keepNext !== false,
  }),
  plain: (text, dx, dw) => ({
    text: san(text),
    font: "TNR",
    fs: FS_BODY,
    color: C.text,
    align: "left",
    dx,
    dw,
  }),
  numList: (text) => {
    const items = san(text)
      .split("\n")
      .filter((l) => l.trim());
    const fullText = items
      .map((l, i) => {
        const line = l.trim();
        return /^\d+[\.\)]/.test(line) ? line : `${i + 1}. ${line}`;
      })
      .join("\n");
    return { text: fullText, font: "TNR", fs: FS_BODY, color: C.text, align: "justify", dx: 10, dw: 10, lineGap: 2 };
  },
  bulletList: (text) => {
    const items = san(text)
      .split("\n")
      .filter((l) => l.trim());
    const fullText = items
      .map((item) => `•  ${item.trim().replace(/^[•\-\*]\s*/, "")}`)
      .join("\n");
    return { text: fullText, font: "TNR", fs: FS_BODY, color: C.text, align: "justify", dx: 20, dw: 20, lineGap: 2 };
  },
  topics: (topics) => {
    const out = [];
    (topics || []).forEach((t, i) => {
      const num = t.order || i + 1;
      out.push({
        text: `${num}-mavzu. ${san(t.title)}`,
        font: "TNR-B",
        fs: FS_BODY,
        color: C.dark,
        align: "center",
        dx: 20,
        dw: 20,
        keepNext: Boolean(t.desc),
      });
      if (t.desc) {
        out.push({ text: san(t.desc), font: "TNR", fs: FS_BODY, color: C.text, align: "justify", dx: 20, dw: 20, indent: 20 });
      }
    });
    return out;
  },
};

function paraHeight(doc, cellW, p) {
  const fs = p.fs || FS_BODY;
  const w = Math.max(1, cellW - (p.dx || 0) - (p.dw || 0));
  const opts = { width: w, align: p.align || "justify", indent: p.indent || 0, lineGap: p.lineGap || 0, lineBreak: true };
  if (!p.lead) return doc.font(p.font || "TNR").fontSize(fs).heightOfString(p.text, opts);
  const full = `${p.lead.text}${p.text}`;
  let h = 0;
  for (const f of ["TNR", "TNR-B"]) h = Math.max(h, doc.font(f).fontSize(fs).heightOfString(full, opts));
  return h;
}

function drawPara(doc, x, y, cellW, p) {
  const fs = p.fs || FS_BODY;
  const tx = x + (p.dx || 0);
  const w = Math.max(1, cellW - (p.dx || 0) - (p.dw || 0));
  const opts = { width: w, align: p.align || "justify", lineBreak: true };
  if (p.indent) opts.indent = p.indent;
  if (p.lineGap) opts.lineGap = p.lineGap;
  if (p.lead) {
    doc
      .font(p.lead.font)
      .fontSize(fs)
      .fillColor(C.dark)
      .text(p.lead.text, tx, y, { width: w, continued: true, indent: p.indent || 0 });
    doc.font(p.font || "TNR").fontSize(fs).fillColor(p.color || C.text).text(p.text, { width: w, align: opts.align });
    return doc.y;
  }
  doc
    .font(p.font || "TNR")
    .fontSize(fs)
    .fillColor(p.color || C.text)
    .text(p.text, tx, y, opts);
  return doc.y;
}

function drawBodyChunk(doc, y, no, paras, heights, h) {
  const overflow = y + h > PH - M;
  const boxH = overflow ? PH - M - y : h;
  const r0 = doc.bufferedPageRange();
  const startPage = r0.start + r0.count - 1;
  doc.rect(M, y, NO_W, boxH).strokeColor(C.border).lineWidth(0.5).stroke();
  doc.rect(M + NO_W, y, BODY_W, boxH).strokeColor(C.border).lineWidth(0.5).stroke();
  if (no) {
    doc
      .font("TNR-B")
      .fontSize(FS_HEADING)
      .fillColor(C.dark)
      .text(`${no}.`, M, y + ROW_PAD_Y, { width: NO_W, align: "center", lineBreak: false });
  }
  const x = M + NO_W + ROW_PAD_X;
  const w = BODY_W - 2 * ROW_PAD_X;
  let ty = y + ROW_PAD_Y;
  paras.forEach((p, i) => {
    const end = drawPara(doc, x, ty, w, p);
    ty = (overflow ? end : Math.max(ty + heights[i], end)) + PARA_GAP;
  });
  if (!overflow) return y + h;
  const r1 = doc.bufferedPageRange();
  const endPage = r1.start + r1.count - 1;
  const endY = doc.y + ROW_PAD_Y;
  for (let pg = startPage + 1; pg <= endPage; pg++) {
    doc.switchToPage(pg);
    const bottom = pg === endPage ? endY : PH - M;
    doc.rect(M, M, NO_W, bottom - M).strokeColor(C.border).lineWidth(0.5).stroke();
    doc.rect(M + NO_W, M, BODY_W, bottom - M).strokeColor(C.border).lineWidth(0.5).stroke();
  }
  return endY;
}

function drawBodyRow(doc, y, row) {
  const paras = (row.paras || []).filter((p) => p && p.text !== undefined && p.text !== null);
  if (!paras.length) return y;
  const w = BODY_W - 2 * ROW_PAD_X;
  const heights = paras.map((p) => Math.ceil(paraHeight(doc, w, p)));
  const gaps = PARA_GAP * (paras.length - 1);
  const total = heights.reduce((a, h) => a + h, 0) + gaps + 2 * ROW_PAD_Y;
  if (total <= PAGE_H) {
    y = chk(doc, y, total);
    return drawBodyChunk(doc, y, row.no, paras, heights, total);
  }
  const groups = [];
  for (let i = 0; i < paras.length; ) {
    let j = i;
    while (j < paras.length - 1 && paras[j].keepNext) j++;
    groups.push([i, j]);
    i = j + 1;
  }
  const groupH = ([a, b]) => heights.slice(a, b + 1).reduce((s, h) => s + h, 0) + PARA_GAP * (b - a);
  let gi = 0;
  let first = true;
  while (gi < groups.length) {
    let avail = BOTTOM - y - 2 * ROW_PAD_Y;
    if (groupH(groups[gi]) > avail && y > M) {
      doc.addPage();
      y = M;
      avail = BOTTOM - y - 2 * ROW_PAD_Y;
    }
    const from = groups[gi][0];
    let to = groups[gi][1];
    let acc = groupH(groups[gi]);
    gi++;
    while (gi < groups.length && acc + PARA_GAP + groupH(groups[gi]) <= avail) {
      acc += PARA_GAP + groupH(groups[gi]);
      to = groups[gi][1];
      gi++;
    }
    y = drawBodyChunk(
      doc,
      y,
      first ? row.no : "",
      paras.slice(from, to + 1),
      heights.slice(from, to + 1),
      acc + 2 * ROW_PAD_Y,
    );
    first = false;
  }
  return y;
}

function drawPageNumbers(doc) {
  const r = doc.bufferedPageRange();
  for (let i = r.start; i < r.start + r.count; i++) {
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("TNR")
      .fontSize(10)
      .fillColor(C.dark)
      .text(String(i - r.start + 1), M, PH - M + 5, {
        width: CW,
        align: "center",
      });
    doc.page.margins.bottom = bottomMargin;
  }
}

async function loadScienceProgramForPdf(id) {
  return ScienceProgram.findById(id)
    .populate({
      path: "science",
      select: "name title code scienceCode department",
      populate: { path: "department", select: "title" },
    })
    .populate({
      path: "directions",
      select: "name title faculty directionCode knowledgeArea educationArea",
      populate: { path: "faculty", select: "title" },
    })
    .populate("confirmation.rector", "firstName lastName middleName")
    .populate("academicYear", "title")
    .populate("approvalSteps.approvedBy", "firstName lastName middleName")
    .exec();
}

async function buildScienceProgramPdf(id) {
  const sp = await loadScienceProgramForPdf(id);
  if (!sp) throw new Error("Fan dasturi topilmadi");
  if (sp.formVersion === "v142") return buildScienceProgramV142Pdf(sp);

  const sciName = san(sp.science?.name || sp.science?.title) || "Fan nomi";
  const dirNames = (sp.directions || [])
    .map((d) => {
      const name = san(d?.name || d?.title);
      if (!name) return "";
      const code = san(d?.directionCode);
      return code ? `${code} – ${name}` : name;
    })
    .filter(Boolean);

  const doc = new PDFDocument({
    size: "A4",
    layout: "portrait",
    margins: { top: M, bottom: M, left: M, right: M },
    info: { Title: sciName, Creator: "Institut AIS" },
    bufferPages: true,
  });
  registerFonts(doc);

  const verifyQr = await prepareVerifyQr(sp, { docType: "scienceProgram" });
  await drawCoverPage(doc, sp, dirNames, verifyQr);

  let y = M;
  y = drawMetaTable(doc, sp, y, sciName);

  const rows = [];

  const row2 = [];
  const ess = sp.scienceEssence;
  if (ess) {
    row2.push(P.heading(san(ess.title) || "I. Fanning mazmuni"));
    if (ess.sciencePurpose?.desc)
      row2.push(
        P.lead(
          san(ess.sciencePurpose.title) || "Fanni o'qitishning maqsadi",
          ess.sciencePurpose.desc,
        ),
      );
    if (ess.scienceTasks?.desc)
      row2.push(
        P.lead(
          san(ess.scienceTasks.title) || "Fanni o'qitishning vazifalari",
          ess.scienceTasks.desc,
        ),
      );
  }

  const theo = sp.theoretical;
  if (theo) {
    row2.push(
      P.center(san(theo.title) || "II. Asosiy nazariy qism (ma'ruza mashg'ulotlari)"),
    );
    if (theo.desc) row2.push(P.bold(theo.desc));
    row2.push(...P.topics(theo.topics));
  }

  if (sp.seminarRecommendation?.desc) {
    row2.push(
      P.center(
        san(sp.seminarRecommendation.title) ||
          "III. Seminar mashg'ulotlari bo'yicha ko'rsatma va tavsiyalar",
      ),
    );
    row2.push(
      P.note("Seminar mashg'ulotlari uchun quyidagi mavzular tavsiya etiladi:", 20, 20, true),
    );
    row2.push(P.numList(sp.seminarRecommendation.desc));
  }

  if (sp.independentTask?.desc) {
    row2.push(
      P.center(san(sp.independentTask.title) || "IV. Mustaqil ta'lim va mustaqil ishlar"),
    );
    row2.push(P.note("Mustaqil ta'lim uchun tavsiya etiladigan topshiriqlar:", 10, 10, true));
    row2.push(P.numList(sp.independentTask.desc));
    row2.push(
      P.note(
        "Mustaqil o'zlashtiladigan mavzular bo'yicha talabalar tomonidan referatlar tayyorlash va uni taqdimot qilish tavsiya etiladi.",
        20,
        20,
      ),
    );
  }
  if (row2.length) rows.push({ no: "2", paras: row2 });

  if (sp.learningOutcome?.desc) {
    rows.push({
      no: "3",
      paras: [
        P.heading(
          san(sp.learningOutcome.title) ||
            "V. Fan o'qitilishining natijalari (shakllanadigan kompetensiyalar)",
        ),
        P.bold(
          san(sp.learningOutcome.learningOutcome) || "Fanni o'zlashtirish natijasida talaba:",
          { align: "center", dx: 20, dw: 20 },
        ),
        P.bulletList(sp.learningOutcome.desc),
      ],
    });
  }

  if (sp.teachingMethods?.desc) {
    rows.push({
      no: "4",
      paras: [
        P.heading(
          san(sp.teachingMethods.title) || "VI. Ta'lim texnologiyalari va metodlari:",
        ),
        P.bulletList(sp.teachingMethods.desc),
      ],
    });
  }

  if (sp.creditRequirements?.desc) {
    rows.push({
      no: "5",
      paras: [
        P.heading(
          san(sp.creditRequirements.title) || "VII. Kreditlarni olish uchun talablar:",
        ),
        P.text(sp.creditRequirements.desc),
      ],
    });
  }

  const litGroups =
    Array.isArray(sp.literatureGroups) && sp.literatureGroups.length
      ? sp.literatureGroups
      : [
          sp.guidanceLiterature && {
            slug: "guidance",
            title: sp.guidanceLiterature.title,
            desc: sp.guidanceLiterature.desc,
          },
          sp.primaryLiterature && {
            slug: "primary",
            title: sp.primaryLiterature.title,
            desc: sp.primaryLiterature.desc,
          },
          sp.additionalLiterature && {
            slug: "additional",
            title: sp.additionalLiterature.title,
            desc: sp.additionalLiterature.desc,
          },
          sp.informationSource && {
            slug: "information",
            title: sp.informationSource.title,
            desc: sp.informationSource.desc,
          },
        ].filter(Boolean);

  const litParas = [];
  for (const g of litGroups) {
    const txt =
      g.desc ||
      (Array.isArray(g.literatures) && g.literatures.length
        ? g.literatures.map((l, i) => `${i + 1}. ${l}`).join("\n")
        : null);
    if (!txt) continue;
    const gTitle = san(g.title);
    if (gTitle) litParas.push(P.center(gTitle));
    litParas.push(P.text(txt, { indent: 0 }));
  }
  if (litParas.length) rows.push({ no: "6", paras: litParas });

  const approvalInfo = sp.approval_info || buildAutoApprovalInfo(sp);
  if (approvalInfo) {
    rows.push({
      no: "7",
      paras: [
        P.heading("Fan dasturi tasdiqlash ma'lumoti"),
        P.text(approvalInfo, { indent: 20 }),
      ],
    });
  }

  if (sp.responsible?.desc) {
    rows.push({
      no: "8",
      paras: [
        P.bold(responsibleHeading(sp.responsible)),
        P.plain(sp.responsible.desc, 16, 4),
      ],
    });
  }
  if (sp.reviewer?.desc) {
    rows.push({
      no: "9",
      paras: [
        P.bold(san(sp.reviewer.title) || "Taqrizchilar:"),
        P.plain(sp.reviewer.desc, 16, 4),
      ],
    });
  }

  for (const row of rows) y = drawBodyRow(doc, y, row);

  drawPageNumbers(doc);
  doc.flushPages();
  return doc;
}

async function generateScienceProgramPdf(req, res, next) {
  try {
    const doc = await buildScienceProgramPdf(req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="fan-dasturi-${req.params.id}.pdf"`,
    );
    doc.pipe(res);
    doc.end();
  } catch (err) {
    return next(new ErrorHandler(400, "Fan dasturi PDF yaratishda xatolik", err.message));
  }
}

module.exports = {
  generateScienceProgramPdf,
  buildScienceProgramPdf,
  loadScienceProgramForPdf,
};
module.exports.buildDeanConfirmationBlock = buildDeanConfirmationBlock;
module.exports.resolveDeanFacultyName = resolveDeanFacultyName;
module.exports.buildAutoApprovalInfo = buildAutoApprovalInfo;
module.exports.chainHasDeanStep = chainHasDeanStep;
module.exports.registerFonts = registerFonts;
module.exports.responsibleHeading = responsibleHeading;
