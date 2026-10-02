"use strict";

const path = require("path");
const PDFDocument = require("pdfkit");
const { FONT_DIR, INSTITUTE_NAME } = require("#shared/pdfGenerators/pdfHelpers");
const { academicYearLabel } = require("./academicYearLabel");
const { areaText } = require("./programAreas");
const {
  buildDeanConfirmationBlock,
  resolveDeanFacultyName,
  facultyKengashiLabel,
} = require("./scienceProgramDean");
const { formatUzDateQuoted } = require("#modules/4.02-studyLoad/_shared/signatories");
const { drawSignatureBlock } = require("#modules/4.02-studyLoad/_shared/signatureBlock");
const { prepareVerifyQr, QR_SIZE_SLOT } = require("#modules/4.02-studyLoad/_shared/verifyQr");
const { buildHeaderSpans } = require("#modules/4.02-studyLoad/_shared/headerSpans");
const {
  applyClinicalHourSplit,
} = require("#modules/4.02-studyLoad/_services/scienceProgramMeta");

const F = {
  regular: path.join(FONT_DIR, "times.ttf"),
  bold: path.join(FONT_DIR, "timesbd.ttf"),
  italic: path.join(FONT_DIR, "timesi.ttf"),
  boldIt: path.join(FONT_DIR, "timesbi.ttf"),
};
function registerFonts(doc) {
  doc.registerFont("TNR", F.regular);
  doc.registerFont("TNR-B", F.bold);
  doc.registerFont("TNR-I", F.italic);
  doc.registerFont("TNR-BI", F.boldIt);
}

const MM = 72 / 25.4;
const PW = 595.28;
const PH = 841.89;
const M = 20 * MM;
const M_B = 25 * MM;
const CW = PW - 2 * M;
const BOTTOM = PH - M_B;
const PAGE_H = BOTTOM - M;
const PAGE_NUMBER_Y = 797;

const FS = Object.freeze({
  body: 14,
  heading: 14,
  cover: 14,
  title: 16,
  coverMeta: 13,
  table1: 10,
  table1Hdr: 9,
  table: 11,
  pageNo: 11,
});
const LINE_GAP = 2.1;
const TEXT = "#000";
const BORDER = "#000";
const LW = 0.5;
const FILL_HDR = "#d9d9d9";
const BLANK = "________________________________________";
const BLANK_SHORT = "____________________";
const DASH = "—";
const BULLET = "‣";

const NO_W = CW * 0.085;
const RIGHT_W = CW * 0.08;
const ROW_MIN_H = 20;
const ROW_PAD = 6;
const SPAN_PAD_X = 6;
const SPAN_PAD_Y = 3;
const PARA_GAP = 2;
const HANG_W = 16;
const TABLE_GAP = 14;
const INDENT = 28;

const COVER_LINES = Object.freeze([
  "O'ZBEKISTON RESPUBLIKASI SOG'LIQNI SAQLASH VAZIRLIGI",
  "O'ZBEKISTON RESPUBLIKASI OLIY TA'LIM, FAN VA INNOVATSIYALAR VAZIRLIGI",
  INSTITUTE_NAME,
]);
const DOC_TYPE_LINE = "FANINING O'QUV DASTURI";
const INSTITUTE_GENITIVE = "Farg'ona jamoat salomatligi tibbiyot institutining";
const CITY = "Farg'ona";

const SECTION_TITLES = Object.freeze({
  1: "1. Fan ma'lumotlari",
  2: "2. Fanning mazmuni",
  3: "3. Fanni o'zlashtirish uchun zarur boshlang'ich bilimlar",
  4: "4. Ta'lim natijalari (TN)",
  5: "5. Fan mazmuni va mashg'ulotlar shakli:",
  6: "6. Mustaqil ta'lim topshiriqlari*",
  7: "7. Ta'lim texnologiyalari va metodlari",
  8: "8. Talabalar tomonidan kreditlarni olish uchun talablar",
  9: "9. Talabala bilimini baholash mezoni",
  10: "10. Foydalanilgan adabiyotlar",
});

const INDEPENDENT_NOTE =
  "*Izoh: Fan (modul) yuzasidan talabalar bajaradigan mustaqil ish topshiriqlari " +
  "variativ tavsifga ega bo'lishi lozim. Mustaqil ish topshiriqlarining 1/3 qismi " +
  "kichik guruhlarda hamkorlikda ishlash (kooperativlik)ga mo'ljallangan bo'lishi kerak.";

const GRADING = Object.freeze([
  { key: "a", lead: "a) 5 baho olish uchun talabaning bilim darajasi quyidagilarga javob berishi lozim:" },
  { key: "b", lead: "b) 4 baho olish uchun talabaning bilim darajasi quyidagilarga javob berishi lozim:" },
  { key: "d", lead: "d) 3 baho olish uchun talabaning bilim darajasi quyidagilarga javob berishi lozim:" },
  { key: "e", lead: "e) quyidagi hollarda talabaning bilim darajasi qoniqarsiz 2 baho bilan baholanishi mumkin:" },
]);

const LIT_GROUPS = Object.freeze([
  { slug: "primary", title: "Asosiy adabiyotlar" },
  { slug: "additional", title: "Qo'shimcha adabiyotlar" },
  { slug: "information", title: "Axborot manbalari" },
]);

const EDUCATION_FORM_LABEL = Object.freeze({
  kunduzgi: "kunduzgi",
  sirtqi: "sirtqi",
  kechki: "kechki",
  masofaviy: "masofaviy",
});

const AUD_LABEL = Object.freeze({
  maruza: "Ma'ruza",
  amaliy: "Amaliy",
  seminar: "Seminar",
  laboratoriya: "Lab-ya",
  klinik_amaliyot: "Klinik o'quv amaliyoti",
});
const AUD_FALLBACK = Object.freeze(["maruza", "amaliy", "laboratoriya"]);

const AUD_ALWAYS = Object.freeze(["laboratoriya"]);

function buildAuditoriumColumns(sp, { isClinical = false } = {}) {
  const { items } = applyClinicalHourSplit(sp && sp.hourItems, { isClinical });
  const present = items.filter((it) => Number(it.value) > 0);
  const fallback = present.length === 0;
  let cols;
  if (fallback) {
    cols = AUD_FALLBACK.map((slug) => ({ slug, value: null }));
  } else {
    const bySlug = new Map(present.map((it) => [it.slug, Number(it.value)]));
    for (const slug of AUD_ALWAYS) if (!bySlug.has(slug)) bySlug.set(slug, 0);
    const order = items.map((it) => it.slug);
    cols = order
      .filter((slug) => bySlug.has(slug))
      .map((slug) => ({ slug, value: bySlug.get(slug) }));
    for (const slug of AUD_ALWAYS) {
      if (!order.includes(slug)) {
        const idx = cols.findIndex((c) => c.slug === "klinik_amaliyot");
        const col = { slug, value: 0 };
        if (idx === -1) cols.push(col);
        else cols.splice(idx, 0, col);
      }
    }
  }
  cols = cols.map((c) => ({ ...c, label: AUD_LABEL[c.slug] }));
  const total = cols.reduce((acc, c) => acc + (c.value || 0), 0);
  return { cols, total, fallback };
}

function serialNumberText(sp) {
  const serial = san(sp && sp.serialNumber);
  if (!serial) return null;
  const dirs = Array.isArray(sp && sp.directions) ? sp.directions : [];
  const code = dirs.map((d) => san(d && d.directionCode)).find(Boolean);
  if (!code || serial.startsWith(code)) return serial;
  return `${code} — ${serial}`;
}

const TOPIC_GROUPS = Object.freeze([
  { type: "maruza", prefix: "M", label: "Ma'ruza (M)" },
  { type: "amaliy", prefix: "A", label: "Amaliy mashg'ulot (A)" },
  { type: "seminar", prefix: "S", label: "Seminar mashg'ulot (S)" },
  { type: "laboratoriya", prefix: "L", label: "Laboratoriya mashg'ulot (L)" },
  { type: "klinik_amaliyot", prefix: "K", label: "Klinik o'quv amaliyoti (K)" },
]);
const TEMPLATE_TOPIC_GROUPS = Object.freeze(["maruza", "amaliy", "laboratoriya"]);

function groupTopics(topics) {
  const list = Array.isArray(topics) ? topics.filter(Boolean) : [];
  const groups = TOPIC_GROUPS.map((g) => {
    const rows = list
      .filter((t) => t.type === g.type)
      .map((t, i) => ({
        code: san(t.code).trim() || `${g.prefix}${i + 1}`,
        title: san(t.title),
        refs: (Array.isArray(t.refs) ? t.refs : []).filter((n) => Number.isFinite(Number(n))),
        hours: Number(t.hours) || 0,
      }));
    return {
      type: g.type,
      prefix: g.prefix,
      label: g.label,
      rows,
      hours: rows.reduce((a, r) => a + r.hours, 0),
    };
  });
  const filled = groups.filter((g) => g.rows.length);
  if (filled.length) return filled;
  return groups
    .filter((g) => TEMPLATE_TOPIC_GROUPS.includes(g.type))
    .map((g) => ({
      ...g,
      blank: true,
      hours: null,
      rows: [{ code: `${g.prefix}1`, title: "", refs: [], hours: null }],
    }));
}

function numberOutcomes(outcomes) {
  const comp = Array.isArray(outcomes && outcomes.competencies) ? outcomes.competencies.filter(Boolean) : [];
  const skills = Array.isArray(outcomes && outcomes.skills) ? outcomes.skills.filter(Boolean) : [];
  let n = 0;
  const mk = (o) => {
    const auto = `TN${++n}`;
    return { code: san(o.code).trim() || auto, text: san(o.text) };
  };
  return { competencies: comp.map(mk), skills: skills.map(mk) };
}

function numberLiterature(literatureGroups) {
  const groups = Array.isArray(literatureGroups) ? literatureGroups.filter(Boolean) : [];
  const itemsOf = (g) => {
    if (Array.isArray(g.literatures) && g.literatures.length) {
      return g.literatures.map(san).map((s) => s.trim()).filter(Boolean);
    }
    return san(g.desc)
      .split("\n")
      .map((s) => s.trim().replace(/^\d+[.)]\s*/, ""))
      .filter(Boolean);
  };
  let n = 0;
  const number = (texts) => texts.map((text) => ({ n: ++n, text }));
  const out = LIT_GROUPS.map((lg) => {
    const g = groups.find((x) => x.slug === lg.slug);
    return { slug: lg.slug, title: lg.title, items: g ? number(itemsOf(g)) : [] };
  });
  for (const g of groups) {
    if (LIT_GROUPS.some((lg) => lg.slug === g.slug)) continue;
    const items = number(itemsOf(g));
    if (items.length) out.push({ slug: g.slug, title: san(g.title) || "Boshqa adabiyotlar", items });
  }
  return out;
}

const BLANK_PROTOCOL_DATE = "20__-yil “___” __________dagi";

function protocolDateDagi(date) {
  const d = date ? new Date(date) : null;
  return d && !Number.isNaN(d.getTime()) ? `${formatUzDateQuoted(d)}dagi` : BLANK_PROTOCOL_DATE;
}
function protocolNumberSonli(number) {
  const n = san(number).trim();
  return `${n || "___"}-sonli`;
}

function effectiveProtocol(formProto, sp, stepKey) {
  const form = formProto || {};
  if (san(form.number).trim()) return form;
  const steps = Array.isArray(sp && sp.approvalSteps) ? sp.approvalSteps : [];
  const step = steps.find(
    (st) => st && st.step === stepKey && st.status === "approved" && st.protocol,
  );
  return step ? { number: step.protocol, date: step.date } : form;
}

const hasKafedraWord = (name) => /kafedra/i.test(name);
const kafedraLabel = (name) => (hasKafedraWord(name) ? `“${name}”` : `“${name}” kafedrasi`);

function councilSentence(sp, v) {
  const proto = effectiveProtocol(v && v.councilProtocol, sp, "dean");
  return (
    `Mazkur o'quv dasturi ${facultyKengashiLabel(resolveDeanFacultyName(sp))} ` +
    `${protocolDateDagi(proto.date)} ${protocolNumberSonli(proto.number)} ` +
    "yig'ilish bayoni bilan ma'qullangan."
  );
}

function departmentSentence(sp, v) {
  const proto = effectiveProtocol(v && v.departmentProtocol, sp, "kafedra");
  const dep = san(sp && sp.science && sp.science.department && sp.science.department.title).trim();
  return (
    `Mazkur o'quv dasturi ${INSTITUTE_GENITIVE} ${kafedraLabel(dep || BLANK_SHORT)} ` +
    "tomonidan taqdim etilgan (kafedraning " +
    `${protocolDateDagi(proto.date)} ${protocolNumberSonli(proto.number)} yig'ilish bayoni).`
  );
}

function formatPerson(p) {
  const fio = san(p && p.fio).trim();
  if (!fio) return "";
  const degree = san(p.degree).trim();
  const title = san(p.title).trim();
  const department = san(p.department).trim();
  const position = san(p.position).trim();
  let affiliation = position;
  if (department) {
    const sep = hasKafedraWord(department) ? ", " : " ";
    affiliation = `${kafedraLabel(department)}${position ? `${sep}${position}` : ""}`;
  }
  const tail = [degree, title, affiliation].filter(Boolean).join(", ");
  return tail ? `${fio} — ${tail}` : fio;
}

function educationFormLine(v) {
  const key = v && v.educationForm;
  const label = EDUCATION_FORM_LABEL[key] || EDUCATION_FORM_LABEL.kunduzgi;
  return `(${label} ta'lim shakli)`;
}

function splitSectionTitle(n) {
  const full = SECTION_TITLES[n];
  const i = full.indexOf(" ");
  return { no: full.slice(0, i), title: full.slice(i + 1) };
}

function san(v) {
  if (v == null) return "";
  if (typeof v === "object") return san(v.uz || v.ru || v.en || v.title || v.name || "");
  return String(v);
}

function ensure(doc, y, need) {
  if (y + need > BOTTOM) {
    doc.addPage();
    return M;
  }
  return y;
}

function para(doc, y, str, opts = {}) {
  const {
    x = M,
    w = CW,
    font = "TNR",
    fs = FS.body,
    align = "justify",
    indent = 0,
    after = 4,
  } = opts;
  y = ensure(doc, y, fs * 1.6);
  doc
    .font(font)
    .fontSize(fs)
    .fillColor(TEXT)
    .text(str, x, y, { width: w, align, indent, lineGap: LINE_GAP, lineBreak: true });
  return doc.y + after;
}

function cell(doc, text, x, y, w, h, opts = {}) {
  const { bold = false, fs = FS.table1, fsMin = 6, align = "center", placeholder = DASH, fill = null } = opts;
  const box = doc.rect(x, y, w, h).lineWidth(LW);
  if (fill) box.fillAndStroke(fill, BORDER);
  else box.strokeColor(BORDER).stroke();
  const raw = san(text).trim();
  const str = raw || placeholder;
  if (!str) return;
  const font = bold ? "TNR-B" : "TNR";
  const tw = Math.max(1, w - 6);
  let size = fs;
  doc.font(font).fontSize(size);
  let th = doc.heightOfString(str, { width: tw, align, lineBreak: true });
  while (th > h - 2 && size > fsMin) {
    size -= 0.5;
    doc.fontSize(size);
    th = doc.heightOfString(str, { width: tw, align, lineBreak: true });
  }
  const ty = y + Math.max(1, (h - th) / 2);
  doc.fillColor(TEXT).text(str, x + 3, ty, { width: tw, align, lineBreak: true });
}

function measure(doc, str, w, fs, font = "TNR") {
  const s = san(str).trim();
  if (!s) return fs * 1.2;
  return doc.font(font).fontSize(fs).heightOfString(s, { width: Math.max(1, w - 6), lineBreak: true });
}

function blankLine(doc, y, x = M + 24) {
  return para(doc, y, BLANK, { x, w: CW - (x - M), align: "left", after: 2 });
}

function tableCols(hasRight) {
  const titleW = CW - NO_W - (hasRight ? RIGHT_W : 0);
  const cols = [
    { x: M, w: NO_W, align: "center" },
    { x: M + NO_W, w: titleW, align: "left" },
  ];
  if (hasRight) cols.push({ x: M + NO_W + titleW, w: RIGHT_W, align: "center" });
  return cols;
}

function paraHeight(doc, w, p) {
  const fs = p.fs || FS.body;
  const tw = p.marker ? w - (p.markerW || HANG_W) : w;
  const opts = { width: Math.max(1, tw), align: p.align || "justify", indent: p.indent || 0, lineGap: LINE_GAP, lineBreak: true };
  if (!p.lead) return doc.font(p.font || "TNR").fontSize(fs).heightOfString(p.text, opts);
  const full = `${p.lead}${p.text}`;
  let h = 0;
  for (const f of ["TNR", "TNR-B", "TNR-BI"]) h = Math.max(h, doc.font(f).fontSize(fs).heightOfString(full, opts));
  return h;
}

function drawPara(doc, x, y, w, p) {
  const fs = p.fs || FS.body;
  let tx = x;
  let tw = w;
  if (p.marker) {
    const mw = p.markerW || HANG_W;
    doc.font("TNR").fontSize(fs).fillColor(TEXT).text(p.marker, x, y, { width: mw, lineBreak: false });
    tx = x + mw;
    tw = w - mw;
  }
  const opts = { width: Math.max(1, tw), align: p.align || "justify", indent: p.indent || 0, lineGap: LINE_GAP, lineBreak: true };
  if (p.lead) {
    doc.font(p.leadFont || "TNR-BI").fontSize(fs).fillColor(TEXT).text(p.lead, tx, y, { ...opts, continued: true });
    doc.font(p.font || "TNR").fontSize(fs).fillColor(TEXT).text(p.text, opts);
  } else {
    doc.font(p.font || "TNR").fontSize(fs).fillColor(TEXT).text(p.text, tx, y, opts);
  }
  return doc.y;
}

function rowHeight(doc, row, cols) {
  if (row.paras) {
    const w = CW - 2 * SPAN_PAD_X;
    const inner = row.paras.reduce((a, p) => a + paraHeight(doc, w, p) + PARA_GAP, -PARA_GAP);
    return Math.ceil(inner) + 2 * SPAN_PAD_Y;
  }
  let h = ROW_MIN_H;
  row.cells.forEach((c, i) => {
    const s = san(c && c.text).trim();
    if (!s) return;
    const font = c.bold ? "TNR-B" : "TNR";
    h = Math.max(h, Math.ceil(measure(doc, s, cols[i].w, c.fs || FS.body, font)) + ROW_PAD);
  });
  return h;
}

function drawRow(doc, y, row, h, cols) {
  if (row.paras) {
    doc.rect(M, y, CW, h).lineWidth(LW).strokeColor(BORDER).stroke();
    let ty = y + SPAN_PAD_Y;
    for (const p of row.paras) ty = drawPara(doc, M + SPAN_PAD_X, ty, CW - 2 * SPAN_PAD_X, p) + PARA_GAP;
    return y + h;
  }
  row.cells.forEach((c, i) => {
    const col = cols[i];
    cell(doc, c && c.text, col.x, y, col.w, h, {
      fs: (c && c.fs) || FS.body,
      bold: Boolean(c && c.bold),
      align: (c && c.align) || col.align,
      placeholder: "",
    });
  });
  return y + h;
}

function drawTableRow(doc, y, row, h, cols) {
  if (h <= PAGE_H) {
    y = ensure(doc, y, h);
    return drawRow(doc, y, row, h, cols);
  }
  if (!row.paras || row.paras.length < 2) {
    y = ensure(doc, y, PAGE_H);
    return drawRow(doc, y, row, h, cols);
  }
  const w = CW - 2 * SPAN_PAD_X;
  let chunk = [];
  let acc = 2 * SPAN_PAD_Y;
  const flush = () => {
    const part = { paras: chunk };
    y = drawTableRow(doc, y, part, rowHeight(doc, part, cols), cols);
    chunk = [];
    acc = 2 * SPAN_PAD_Y;
  };
  for (const p of row.paras) {
    const ph = paraHeight(doc, w, p) + PARA_GAP;
    if (chunk.length && acc + ph > PAGE_H) flush();
    chunk.push(p);
    acc += ph;
  }
  if (chunk.length) flush();
  return y;
}

function sectionHeaderRow({ no, title, rightCol }, cols) {
  const cells = [
    { text: no, bold: true, fs: FS.heading },
    { text: title, bold: true, fs: FS.heading },
  ];
  if (cols.length === 3) cells.push({ text: rightCol, bold: true, fs: FS.heading });
  return { cells };
}

function drawSectionTable(doc, y, { no, title, rows, rightCol }) {
  const cols = tableCols(rightCol != null);
  const header = sectionHeaderRow({ no, title, rightCol }, cols);
  const hHeader = rowHeight(doc, header, cols);
  const heights = rows.map((r) => rowHeight(doc, r, cols));
  const groupH = (i) => heights[i] + (rows[i].keepNext && i + 1 < rows.length ? heights[i + 1] : 0);
  const first = heights.length ? Math.min(groupH(0), PAGE_H - hHeader) : 0;
  y = ensure(doc, y, hHeader + first);
  y = drawRow(doc, y, header, hHeader, cols);
  rows.forEach((row, i) => {
    if (row.keepNext) y = ensure(doc, y, Math.min(groupH(i), PAGE_H));
    y = drawTableRow(doc, y, row, heights[i], cols);
  });
  return y + TABLE_GAP;
}

function numberedRow(n, text) {
  return { cells: [{ text: `${n}.` }, { text }] };
}

function textParas(text, lead) {
  const parts = san(text).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) parts.push(BLANK);
  return parts.map((t, i) => (lead && i === 0 ? { lead, text: t, indent: INDENT } : { text: t, indent: INDENT }));
}

function bulletParas(items) {
  return (items.length ? items : [""]).map((t) => ({ marker: BULLET, text: t || BLANK }));
}

function drawCover(doc, sp, v, sciName, verifyQr) {
  let y = M;
  for (const line of COVER_LINES) {
    doc.font("TNR-B").fontSize(FS.cover).fillColor(TEXT).text(line, M, y, { width: CW, align: "center" });
    y = doc.y + 2;
  }

  const block = buildDeanConfirmationBlock(sp);
  const tX = M + CW * 0.42;
  const tW = CW * 0.58;
  y = Math.max(y + 12, PH * 0.22);
  const blockH = drawSignatureBlock(doc, {
    x: tX,
    y,
    w: tW,
    align: "center",
    heading: '"TASDIQLAYMAN"',
    position: [{ text: block.position, fs: 12 }],
    sig: { name: block.name, dateText: block.date, source: block.source },
    fonts: { bold: "TNR-B", regular: "TNR", italic: "TNR-I" },
    scale: 1.5,
    qr: verifyQr ? { image: verifyQr.image, size: QR_SIZE_SLOT } : undefined,
    emptySlotGap: 6,
  });
  y += blockH;

  y = Math.max(y + 40, PH * 0.42);
  doc.font("TNR-B").fontSize(FS.title).fillColor(TEXT).text(sciName.toUpperCase(), M, y, { width: CW, align: "center" });
  y = doc.y + 6;
  doc.font("TNR-B").fontSize(FS.cover).fillColor(TEXT).text(DOC_TYPE_LINE, M, y, { width: CW, align: "center" });
  y = doc.y + 4;
  doc.font("TNR").fontSize(FS.cover).fillColor(TEXT).text(educationFormLine(v), M, y, { width: CW, align: "center" });
  y = doc.y + 34;

  const dirNames = (Array.isArray(sp.directions) ? sp.directions : [])
    .map((d) => {
      const name = san(d && (d.name || d.title));
      if (!name) return "";
      const code = san(d && d.directionCode);
      return code ? `${code} – ${name}` : name;
    })
    .filter(Boolean);
  const pairs = [
    ["Bilim sohasi:", areaText(sp, "knowledgeArea", DASH)],
    ["Ta'lim sohasi:", areaText(sp, "educationArea", DASH)],
    ["Ta'lim yo'nalishi:", dirNames.length ? dirNames.join("; ") : DASH],
  ];
  const lblX = M + CW * 0.1;
  const lblW = 140;
  const valX = lblX + lblW + 8;
  const valW = M + CW - valX;
  for (const [lb, vl] of pairs) {
    doc.font("TNR-B").fontSize(FS.coverMeta).fillColor(TEXT).text(lb, lblX, y, { width: lblW });
    const yLbl = doc.y;
    doc.font("TNR").fontSize(FS.coverMeta).fillColor(TEXT).text(vl, valX, y, { width: valW });
    y = Math.max(yLbl, doc.y) + 4;
  }

  const ayLabel = academicYearLabel(sp.academicYear);
  const year = ayLabel ? ayLabel.split("/")[0] : String(new Date().getFullYear());
  doc
    .font("TNR-B")
    .fontSize(FS.cover)
    .fillColor(TEXT)
    .text(`${CITY} – ${year}`, M, BOTTOM - FS.cover * 1.3, { width: CW, align: "center" });
}

function drawPageTwo(doc, sp, v) {
  let y = M;
  y = para(doc, y, councilSentence(sp, v), { indent: INDENT, after: 10 });
  y = para(doc, y, departmentSentence(sp, v), { indent: INDENT, after: 24 });

  for (const [title, list] of [
    ["Tuzuvchilar:", v && v.authors],
    ["Taqrizchilar:", v && v.reviewers],
  ]) {
    y = ensure(doc, y, 60);
    doc.font("TNR-B").fontSize(FS.body).fillColor(TEXT).text(title, M, y, { width: CW });
    y = doc.y + 4;
    const rows = (Array.isArray(list) ? list : []).map(formatPerson).filter(Boolean);
    if (!rows.length) {
      y = blankLine(doc, y);
    } else {
      for (const row of rows) y = para(doc, y, row, { x: M + 24, w: CW - 24, align: "left", after: 3 });
    }
    y += 14;
  }
  return y;
}

const H_HDR = 24;
const H_VAL = 18;
const H_GRP = 30;
const H_SUB = 24;
const HDR = { bold: true, fs: FS.table1Hdr, placeholder: "", fill: FILL_HDR };
const VAL = { fs: FS.table1 };

function drawSection1(doc, sp, y) {
  const num = (n) => (n == null || n === "" ? null : String(n));

  const w4 = [0.26, 0.24, 0.2, 0.3].map((r) => CW * r);
  const x4 = [M, M + w4[0], M + w4[0] + w4[1], M + w4[0] + w4[1] + w4[2]];
  const blocks = [
    {
      labels: ["Fan/modul kodi", "O'quv yili", "Semestr", "ECTS — Kreditlar"],
      values: [
        san(sp.code) || san(sp.science && sp.science.scienceCode) || null,
        academicYearLabel(sp.academicYear) || null,
        num(sp.semester),
        num(sp.credits),
      ],
    },
    {
      labels: ["Fan/modul turi", "Ta'lim tili", "O'quv rejadagi tartib raqami", "Haftadagi dars soatlari"],
      values: [san(sp.moduleType) || null, san(sp.language) || null, serialNumberText(sp), num(sp.weeklyHours)],
    },
  ].map((b) => ({
    ...b,
    h: Math.max(H_VAL, ...b.values.map((val, i) => Math.ceil(measure(doc, val, w4[i], FS.table1)) + 6)),
  }));

  const { cols: audCols, total } = buildAuditoriumColumns(sp);
  const groupLabel =
    `Auditoriya mashg'ulotlari jami — ${total > 0 ? total : "..."} soat, shundan:`;
  const audW = (CW * 0.4) / audCols.length;
  const cols = [
    { key: "name", label: "Fanning nomi", w: CW * 0.3, grp1: null, value: san(sp.science && (sp.science.name || sp.science.title)) || "Fan nomi" },
    { key: "total", label: "Jami yuklama (soat)", w: CW * 0.11, grp1: null, value: num(sp.totalHours) },
    ...audCols.map((c) => ({ key: c.slug, label: c.label, w: audW, grp1: groupLabel, value: num(c.value) })),
    { key: "independent", label: "Mustaqil ta'lim (soat)", w: CW * 0.11, grp1: null, value: num(sp.independentHours) },
    { key: "coursework", label: "Kurs ishi", w: CW * 0.08, grp1: null, value: "-" },
  ];
  const xs = [];
  let cx = M;
  for (const c of cols) {
    xs.push(cx);
    cx += c.w;
  }
  const spans = buildHeaderSpans(cols).grp1;
  const inSpan = (i) => spans.some((s) => i >= s.from && i < s.to);
  const rowH = Math.max(24, Math.ceil(measure(doc, cols[0].value, cols[0].w, FS.table1)) + 8);

  const gridH = blocks.reduce((a, b) => a + H_HDR + b.h, 0) + H_GRP + H_SUB + rowH;
  const tcols = tableCols(false);
  const header = sectionHeaderRow(splitSectionTitle(1), tcols);
  const hHeader = rowHeight(doc, header, tcols);
  y = ensure(doc, y, hHeader + gridH);
  y = drawRow(doc, y, header, hHeader, tcols);

  for (const b of blocks) {
    b.labels.forEach((lb, i) => cell(doc, lb, x4[i], y, w4[i], H_HDR, HDR));
    y += H_HDR;
    b.values.forEach((val, i) => cell(doc, val, x4[i], y, w4[i], b.h, VAL));
    y += b.h;
  }

  for (const s of spans) {
    const sx = xs[s.from];
    const sw = cols.slice(s.from, s.to).reduce((a, c) => a + c.w, 0);
    cell(doc, s.value, sx, y, sw, H_GRP, HDR);
    for (let i = s.from; i < s.to; i++) cell(doc, cols[i].label, xs[i], y + H_GRP, cols[i].w, H_SUB, HDR);
  }
  cols.forEach((c, i) => {
    if (!inSpan(i)) cell(doc, c.label, xs[i], y, c.w, H_GRP + H_SUB, HDR);
  });
  y += H_GRP + H_SUB;

  cols.forEach((c, i) => cell(doc, c.value, xs[i], y, c.w, rowH, { ...VAL, align: i === 0 ? "left" : "center" }));
  return y + rowH + TABLE_GAP;
}

function drawSection2(doc, sp, y) {
  const ess = sp.scienceEssence || {};
  const paras = [
    ...textParas(ess.sciencePurpose && ess.sciencePurpose.desc),
    ...textParas(ess.scienceTasks && ess.scienceTasks.desc),
  ];
  return drawSectionTable(doc, y, { ...splitSectionTitle(2), rows: [{ paras }] });
}

function drawSection3(doc, v, y) {
  const list = (Array.isArray(v && v.prerequisites) ? v.prerequisites : []).filter((p) => p && san(p.title).trim());
  const rows = list.length
    ? list.map((p, i) => {
        const code = san(p.code).trim();
        return numberedRow(i + 1, `${code ? `(${code}) ` : ""}${san(p.title).trim()}`);
      })
    : [numberedRow(1, "")];
  return drawSectionTable(doc, y, { ...splitSectionTitle(3), rows });
}

function drawSection4(doc, v, y) {
  const { competencies, skills } = numberOutcomes(v && v.outcomes);
  const compRows = competencies.length ? competencies : [{ code: "TN1", text: "" }];
  const skillRows = skills.length ? skills : [{ code: `TN${compRows.length + 1}`, text: "" }];
  const tn = (r) => ({ cells: [{ text: r.code, bold: true, fs: FS.table }, { text: r.text, fs: FS.table }] });
  const sub = (t) => ({ cells: [{ text: "" }, { text: t, bold: true }], keepNext: true });
  const rows = [sub("Kasbiy kompetensiyalar:"), ...compRows.map(tn), sub("Ko'nikmalar:"), ...skillRows.map(tn)];
  return drawSectionTable(doc, y, { ...splitSectionTitle(4), rows });
}

const hoursText = (h) => (h == null ? "" : String(h));

function drawSection5(doc, v, y) {
  const rows = [];
  for (const g of groupTopics(v && v.topics)) {
    rows.push({
      cells: [{ text: "" }, { text: g.label, bold: true, fs: FS.table }, { text: hoursText(g.hours), bold: true, fs: FS.table }],
      keepNext: true,
    });
    for (const r of g.rows) {
      const text = r.refs.length ? `${r.title} [${r.refs.join(",")}]` : r.title;
      rows.push({ cells: [{ text: r.code, fs: FS.table }, { text, fs: FS.table }, { text: hoursText(r.hours), fs: FS.table }] });
    }
  }
  return drawSectionTable(doc, y, { ...splitSectionTitle(5), rightCol: "Soat", rows });
}

function drawSection6(doc, sp, v, y) {
  const tasks = (Array.isArray(v && v.independentTasks) ? v.independentTasks : []).filter(Boolean);
  const sum = tasks.reduce((a, t) => a + (Number(t.hours) || 0), 0);
  const total = tasks.length ? sum : sp.independentHours;
  const list = tasks.length ? tasks : [{ title: "", hours: null }];
  const rows = list.map((t, i) => ({
    cells: [{ text: String(t.order || i + 1), fs: FS.table }, { text: t.title, fs: FS.table }, { text: hoursText(t.hours), fs: FS.table }],
  }));
  y = drawSectionTable(doc, y, { ...splitSectionTitle(6), rightCol: hoursText(total), rows });
  const note = san(v && v.independentNote) || INDEPENDENT_NOTE;
  return para(doc, y - TABLE_GAP + 4, note, { font: "TNR-I", fs: 12, after: TABLE_GAP });
}

function drawSection7(doc, v, y) {
  const items = (Array.isArray(v && v.techMethods) ? v.techMethods : []).map(san).map((s) => s.trim()).filter(Boolean);
  return drawSectionTable(doc, y, { ...splitSectionTitle(7), rows: [{ paras: bulletParas(items) }] });
}

function drawSection8(doc, sp, y) {
  const paras = textParas(sp.creditRequirements && sp.creditRequirements.desc);
  return drawSectionTable(doc, y, { ...splitSectionTitle(8), rows: [{ paras }] });
}

function drawSection9(doc, v, y) {
  const grading = (v && v.grading) || {};
  const rows = GRADING.map((g) => {
    const items = (Array.isArray(grading[g.key]) ? grading[g.key] : []).map(san).map((s) => s.trim()).filter(Boolean);
    const letter = `${g.key}) `;
    const lead = items.length ? `${letter}${items[0].replace(/^[abde]\)\s*/i, "")}` : g.lead;
    const bullets = items.length ? items.slice(1) : [];
    return { paras: [{ text: lead, align: "left" }, ...bulletParas(bullets)] };
  });
  return drawSectionTable(doc, y, { ...splitSectionTitle(9), rows });
}

function drawSection10(doc, sp, y) {
  const rows = [];
  for (const g of numberLiterature(sp.literatureGroups)) {
    rows.push({ paras: [{ text: g.title, font: "TNR-B", align: "center" }], keepNext: true });
    if (!g.items.length) rows.push({ cells: [{ text: "" }, { text: "" }] });
    for (const it of g.items) rows.push(numberedRow(it.n, it.text));
  }
  return drawSectionTable(doc, y, { ...splitSectionTitle(10), rows });
}

function drawPageNumbers(doc) {
  const r = doc.bufferedPageRange();
  for (let i = r.start; i < r.start + r.count; i++) {
    if (i === r.start) continue;
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("TNR")
      .fontSize(FS.pageNo)
      .fillColor(TEXT)
      .text(String(i - r.start + 1), M, PAGE_NUMBER_Y, { width: CW, align: "center" });
    doc.page.margins.bottom = bottomMargin;
  }
}

async function buildScienceProgramV142Pdf(sp) {
  const v = (sp && sp.v142) || {};
  const sciName = san(sp.science && (sp.science.name || sp.science.title)) || "Fan nomi";

  const doc = new PDFDocument({
    size: "A4",
    layout: "portrait",
    margins: { top: M, bottom: M_B, left: M, right: M },
    info: { Title: sciName, Creator: "Institut AIS" },
    bufferPages: true,
  });
  registerFonts(doc);

  const verifyQr = await prepareVerifyQr(sp, { docType: "scienceProgram" });

  drawCover(doc, sp, v, sciName, verifyQr);
  doc.addPage();
  drawPageTwo(doc, sp, v);
  doc.addPage();

  let y = M;
  y = drawSection1(doc, sp, y);
  y = drawSection2(doc, sp, y);
  y = drawSection3(doc, v, y);
  y = drawSection4(doc, v, y);
  y = drawSection5(doc, v, y);
  y = drawSection6(doc, sp, v, y);
  y = drawSection7(doc, v, y);
  y = drawSection8(doc, sp, y);
  y = drawSection9(doc, v, y);
  drawSection10(doc, sp, y);

  drawPageNumbers(doc);
  doc.flushPages();
  return doc;
}

module.exports = {
  buildScienceProgramV142Pdf,
  buildAuditoriumColumns,
  serialNumberText,
  AUD_ALWAYS,
  groupTopics,
  numberOutcomes,
  numberLiterature,
  councilSentence,
  departmentSentence,
  formatPerson,
  educationFormLine,
  splitSectionTitle,
  AUD_LABEL,
  AUD_FALLBACK,
  TOPIC_GROUPS,
  SECTION_TITLES,
  GRADING,
  LIT_GROUPS,
  COVER_LINES,
  DOC_TYPE_LINE,
  INDEPENDENT_NOTE,
  PAGE_NUMBER_Y,
  NO_W,
  RIGHT_W,
  FILL_HDR,
  drawSectionTable,
  registerFonts,
};
