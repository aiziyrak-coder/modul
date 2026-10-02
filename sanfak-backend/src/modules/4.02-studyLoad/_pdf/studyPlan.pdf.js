"use strict";
const { ErrorHandler } = require("#shared/error");
const PDFDocument = require("pdfkit");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { registerCyrillicFonts } = require("#shared/pdfGenerators/pdfHelpers");
const {
  particleValue,
  sortByColNum,
  CANONICAL,
} = require("#shared/particleHelpers");
const { statisticsMap } = require("./statisticsMap");
const { orderByLabels } = require("#modules/4.02-studyLoad/_services/summaryRows");
const {
  hasAggregateRow,
} = require("#modules/4.02-studyLoad/_shared/aggregateRow");
const {
  resolveLoadColumns,
  LOAD_ZONE,
} = require("#modules/4.02-studyLoad/_shared/planLoadColumns");
const { classifyRows, ROW_TYPE } = require("#modules/4.02-studyLoad/_shared/planRowType");
const {
  isNonScienceRow,
  isAttestationRow,
} = require("#modules/4.02-studyLoad/_services/scienceLinker");
const { drawSignatureBlock } = require("#modules/4.02-studyLoad/_shared/signatureBlock");

const PG = { width: 842, height: 595, margin: 18 };
const CW = PG.width - PG.margin * 2;
const PAGE_BOTTOM = PG.height - PG.margin;
const IZOH_HEAD_H = 60;
const TITLE_FS = 9.5;
const LEGEND_GAP = 12;
const LEGEND_BOX = 14;
const LEGEND_FS = 9;
const LEGEND_KEY_FS = 8;
const LEGEND_MIN_SPACE = 10;
const LEGEND_MAX_SPACE = 16;

const PAGE_OPTS = {
  size: "A4",
  layout: "landscape",
  margins: { top: PG.margin, bottom: PG.margin, left: PG.margin, right: PG.margin },
};
const BDR = "#444";
const LW = 0.4;

const sanText = (v) =>
  String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\v\f]+/g, " ")
    .replace(/[ʻʼʽʾʿ`´‘’‚‛]/g, "'")
    .replace(/[“”„‟«»]/g, '"');

const YDA_IZOH =
  "Ixtisoslik fanlaridan integrallashgan yakuniy davlat attestatsiyasi";

const IZOH_STANDART = [
  "1 kredit 30 akademik soatni tashkil qiladi.",
  "GPA ko'rsatkichi avgust oyining uchinchi haftasida aniqlanadi.",
  "Tanlov fanlari bloki OTM kengashi qarori bilan mehnat bozori va kadrlar " +
    "buyurtmachilarining talablariga moslanuvchanlik va harakatchanlikni " +
    "ta'minlovchi fanlar majmuasidan belgilanadi.",
  "Harbiy tibbiy tayyorgarlik mashg'ulotlari tanlov fanlari blokining soatlari " +
    "hisobiga, harbiy yig'in esa ta'til vaqti hisobiga o'tkaziladi. Harbiy tibbiy " +
    "tayyorgarlik mashg'ulotlari o'tkazilmaydigan hollarda ushbu soatlardan OTM " +
    "kengashi qarori bilan mehnat bozori va kadrlar buyurtmachilarining " +
    "ehtiyojlariga muvofiq mutaxassislik va tanlov fanlari uchun foydalaniladi.",
  "O'quv reja asosida ishchi o'quv rejasini tuzishda talabalar yuklamasining " +
    "haftalik hajmini saqlagan holda o'quv fanlari bloki hajmini 5% gacha, " +
    "bloklar tarkibidagi fanlar hajmini 10% gacha o'zgartirish hamda auditoriya " +
    "yuklamasining umumiy hajmini saqlagan holda ayrim semestrlarda haftalik " +
    "yuklamalar hajmini erkin belgilash mumkin.",
  "Klinik fanlarga ajratilgan auditoriya soatlarining 50% ni klinik o'quv " +
    "amaliyoti tashkil qiladi.",
  "O'quv rejaga kiritiladigan ixtisoslikka oid fanlarning amaliy mashg'ulotlari " +
    "va laboratoriya ishlari oliy ta'lim muassasasi hamda bazaviy tashkilot va " +
    "korxonalarda o'tkaziladi.",
  "Nazariya va amaliyot yaxlitligini ta'minlash uchun talabalarning malakaviy " +
    "amaliyotlari bazaviy tashkilot va korxonalarda o'tkaziladi.",
  "Jismoniy tarbiya va sport fani fakultativ kurs sifatida talabaning ixtiyoriy " +
    "tanlovi asosida sport seksiyalarida tashkil etiladi.",
];


function ct(doc, x, y, w, h, text, o = {}) {
  const {
    fs = 6,
    b = false,
    c = "#000",
    al = "center",
    bg = null,
    va = "mid",
  } = o;
  if (bg) doc.rect(x, y, w, h).fill(bg);
  doc.rect(x, y, w, h).strokeColor(BDR).lineWidth(LW).stroke();
  const str = String(text ?? "");
  const tw = Math.max(1, w - 3);
  doc.font(b ? "Helvetica-Bold" : "Helvetica").fontSize(fs);
  const th = str ? doc.heightOfString(str, { width: tw, align: al }) : fs;
  const tp = va === "top" ? 2 : Math.max(1, (h - th) / 2);
  doc
    .fillColor(c)
    .text(str, x + 1.5, y + tp, {
      width: tw,
      height: h - 2,
      align: al,
      lineBreak: true,
      ellipsis: true,
    });
}

function ctFit(doc, x, y, w, h, text, o = {}) {
  const {
    fsMax = 5,
    fsMin = 3.2,
    b = false,
    c = "#000",
    al = "center",
    bg = null,
  } = o;
  if (bg) doc.rect(x, y, w, h).fill(bg);
  doc.rect(x, y, w, h).strokeColor(BDR).lineWidth(LW).stroke();
  const str = String(text ?? "");
  const font = b ? "Helvetica-Bold" : "Helvetica";
  const tw = Math.max(1, w - 3);
  let fs = fsMax;
  if (str) {
    doc.font(font);
    while (
      fs > fsMin &&
      doc.fontSize(fs).heightOfString(str, { width: tw, align: al }) > h - 2
    ) {
      fs -= 0.25;
    }
  }
  const tp = Math.max(
    1,
    (h - doc.fontSize(fs).heightOfString(str, { width: tw, align: al })) / 2,
  );
  doc
    .font(font)
    .fontSize(fs)
    .fillColor(c)
    .text(str, x + 1.5, y + tp, {
      width: tw,
      height: h - 2,
      align: al,
      lineBreak: true,
      ellipsis: true,
    });
}

function ctV(doc, x, y, w, h, text, o = {}) {
  const { fsMax = 6, fsMin = 3.2, b = true, c = "#000", bg = null } = o;
  if (bg) doc.rect(x, y, w, h).fill(bg);
  doc.rect(x, y, w, h).strokeColor(BDR).lineWidth(LW).stroke();
  const str = String(text ?? "");
  if (!str) return;
  const font = b ? "Helvetica-Bold" : "Helvetica";
  const avail = Math.max(1, h - 4);
  let fs = fsMax;
  doc.font(font);
  while (fs > fsMin && doc.fontSize(fs).widthOfString(str) > avail) fs -= 0.25;
  doc.save();
  doc.translate(x + w / 2, y + h / 2);
  doc.rotate(-90);
  doc
    .font(font)
    .fontSize(fs)
    .fillColor(c)
    .text(str, -(avail / 2), -(w / 2) + 1.5, {
      width: avail,
      height: w - 2,
      align: "center",
      lineBreak: false,
      ellipsis: true,
    });
  doc.restore();
}

function gmk(o) {
  if (!o) return [];
  return o instanceof Map ? Array.from(o.keys()) : Object.keys(o);
}
function gmv(o, k) {
  if (!o) return {};
  return o instanceof Map ? o.get(k) || {} : o[k] || {};
}

const ROW_STYLE = {
  [ROW_TYPE.SECTION_HEADER]: { bold: true, bg: "#f4f6fa" },
  [ROW_TYPE.AGGREGATE]: { bold: true, bg: "#ddd" },
};
const rowStyle = (type) => ROW_STYLE[type] || {};

const isPracticeBlock = (block) => isNonScienceRow({ title: block?.title });

function sumPlanItems(items, sems) {
  const acc = { credit: 0, particle: {}, semHour: {}, semCredit: {} };
  for (const it of items) {
    acc.credit += Number(it?.totalCredit) || 0;
    addParticles(acc.particle, it?.particle);
    addSemesters(acc, it?.semesters, sems);
  }
  return acc;
}

function addParticles(into, particle) {
  for (const pt of Array.isArray(particle) ? particle : []) {
    into[pt.slug] = (into[pt.slug] || 0) + (Number(pt.value) || 0);
  }
}

function addSemesters(acc, semesters, sems) {
  for (const sem of sems) {
    const sd = gmv(semesters, sem);
    const h = Number(sd.hour);
    if (Number.isFinite(h)) acc.semHour[sem] = (acc.semHour[sem] || 0) + h;
    const c = Number(sd.credit);
    if (Number.isFinite(c)) acc.semCredit[sem] = (acc.semCredit[sem] || 0) + c;
  }
}

function computePlanTotals(blocks, sems) {
  const fan = blocks.filter((b) => !isPracticeBlock(b));
  const prac = blocks.filter(isPracticeBlock);
  const attestation = prac.flatMap((b) => (b.sciences || []).filter(isAttestationRow));
  return {
    hasPractice: prac.length > 0,
    lastFanBlock: fan[fan.length - 1] ?? null,
    lastPracticeBlock: prac[prac.length - 1] ?? null,
    fan: sumPlanItems(fan, sems),
    practice: sumPlanItems([...prac, ...attestation], sems),
    grand: sumPlanItems([...fan, ...prac, ...attestation], sems),
  };
}

const HEADING = "O'QUV REJA";

const HEADER_MAX_LEN = 60;

const normApos = (s) =>
  String(s ?? "")
    .replace(/[ʻʼ‘’´`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const DOC_TITLE_MARKER = /ta['ʻʼ]?lim\s+yo['ʻʼ]?nalishi/i;

const headerText = (raw, fallback, docTitle) => {
  const t = String(raw ?? "").trim();
  if (!t || t.length > HEADER_MAX_LEN) return fallback;
  if (DOC_TITLE_MARKER.test(t)) return fallback;
  if (docTitle && normApos(t) === normApos(docTitle)) return fallback;
  return t;
};
function planHeading(rawTitle, dirTitle) {
  const t = normApos(rawTitle);
  if (!t) return HEADING;
  const d = normApos(dirTitle);
  const rest = d ? t.replace(d, "").replace(/\s+/g, " ").trim() : t;
  return rest || HEADING;
}

function drawPage1(doc, lp, dir, cfg) {
  let y = PG.margin;
  doc
    .font("Helvetica-Bold")
    .fontSize(TITLE_FS)
    .fillColor("#000")
    .text(cfg.ministry1, PG.margin, y, { width: CW, align: "center" });
  doc
    .font("Helvetica-Bold")
    .fontSize(TITLE_FS)
    .text(cfg.ministry2, PG.margin, doc.y + 1, { width: CW, align: "center" });
  doc
    .font("Helvetica-Bold")
    .fontSize(TITLE_FS)
    .text(cfg.instituteName, PG.margin, doc.y + 1, {
      width: CW,
      align: "center",
    });
  y = doc.y + 8;

  const col = CW / 3,
    by = y;

  if (lp.planSource === "ministry") {
    if (lp.basisNote) {
      const noteW = col * 0.45;
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor("#000")
        .text(String(lp.basisNote), PG.margin + (col - noteW) / 2, by, {
          width: noteW,
          align: "center",
          lineBreak: true,
          lineGap: 1.5,
        });
    }
  } else {
    drawSignatureBlock(doc, {
      x: PG.margin,
      y: by,
      w: col,
      align: "left",
      heading: '"TASDIQLAYMAN"',
      position: cfg.rectorTitle,
      sig: { name: "", dateText: `${lp.year || "202__"} yil`, source: "none" },
      gapSignature: 8,
    });
  }

  const ml = (v) =>
    v && typeof v === "object" ? v.uz || v.ru || v.eng || "" : v || "";

  const dt = ml(dir.title),
    dc = dir.directionCode || "";
  const planTitle = planHeading(lp.title, dt);
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#000")
    .text(planTitle, PG.margin + col, by, { width: col, align: "center" });
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text("Ta'lim yo'nalishi:", PG.margin + col, doc.y + 3, {
      width: col,
      align: "center",
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(dc ? `${dc} – ${dt}` : dt, PG.margin + col, doc.y + 1, {
      width: col,
      align: "center",
    });

  const rx = PG.margin + col * 2 + col * 0.3;
  const lines = [
    `Akademik daraja – ${ml(lp.academicLevel?.title)}`,
    `O'qish shakli – ${ml(lp.readingForm?.title) || ml(lp.educationForm?.title)}`,
    `Ta'lim shakli – ${ml(lp.educationForm?.title)}`,
    `O'qish muddati – ${ml(lp.studyPeriod?.title)}`,
    ml(lp.specialization?.title)
      ? `Ixtisoslik – ${ml(lp.specialization.title)}`
      : null,
  ].filter(Boolean);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#000");
  lines.forEach((l, i) => doc.text(l, rx, by + i * 11, { width: col - col * 0.3, lineBreak: false }));

  y = by + 62;

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#000")
    .text("I.    O'QUV JARAYONI JADVALI", PG.margin, y, {
      width: CW,
      align: "center",
    });
  y = doc.y + 4;

  const courses = lp.courses || [];
  if (!courses.length) return y;

  const KW = 18;
  const months = courses[0]?.months || [];
  const tw = months.reduce((s, m) => s + (m.weeks?.length || 0), 0);
  const sL = [
    "Jami",
    "Nazariy va amaliy ta'lim",
    "Attestatsiyalar",
    "Kredit ta'lim tizimiga kirish",
    "Malakaviy amaliyot",
    "Yakuniy davlat attestatsiyasi",
    "Ta'til haftalar soni",
    "GPA ko'rsatkichini hisoblash",
    "Hammasi",
  ];
  const SW = 24,
    tsw = sL.length * SW;
  const mw = CW - KW - tsw,
    ww = tw > 0 ? mw / tw : 8;
  const H1 = 88,
    H2 = 14,
    H3 = 12,
    HT = H1 + H2 + H3,
    RH = 15;
  const HDR_FS = { title: 8, month: 7, week: 6, group: 6, vertical: 6.5 };

  let x = PG.margin;
  ctV(doc, x, y, KW, HT, "Kurs", { fsMax: HDR_FS.title });
  x += KW;
  ct(doc, x, y, mw, H1, "Haftalar", { b: true, fs: HDR_FS.title });
  let mx = x;
  for (const m of months) {
    const w = (m.weeks?.length || 0) * ww;
    ct(doc, mx, y + H1, w, H2, m.month || "", { b: true, fs: HDR_FS.month });
    mx += w;
  }
  mx = x;
  let wn = 1;
  for (const m of months) {
    for (const wk of m.weeks || []) {
      ct(doc, mx, y + H1 + H2, ww, H3, String(wk.week ?? wn), { fs: HDR_FS.week });
      mx += ww;
      wn++;
    }
  }
  x += mw;
  const GT = 18,
    ST = 10;
  const g0 = x + SW,
    gw = SW * 5;
  ct(doc, g0, y, gw, GT, "O'quv jarayoni,\nhaftalari soni:", { b: true, fs: HDR_FS.group });
  ct(doc, g0, y + GT, gw, ST, "shundan", { b: true, fs: HDR_FS.group });
  let sx = x;
  sL.forEach((l, i) => {
    const inGroup = i >= 1 && i <= 5;
    const top = inGroup ? y + GT + ST : y;
    const h = inGroup ? HT - GT - ST : HT;
    ctV(doc, sx, top, SW, h, l, { fsMax: HDR_FS.vertical });
    sx += SW;
  });
  y += HT;

  for (const c of courses) {
    x = PG.margin;
    ct(doc, x, y, KW, RH, c.course || String(c.courseNum || ""), {
      b: true,
      fs: 6,
    });
    x += KW;
    const wm =
      c.weeks instanceof Map ? Object.fromEntries(c.weeks) : c.weeks || {};
    const ownKeys = {};
    for (const om of c.months || []) {
      for (const ow of om.weeks || []) ownKeys[String(ow.week)] = ow.key;
    }
    for (const m of months) {
      for (const wk of m.weeks || []) {
        const k = wm[String(wk.week)] || ownKeys[String(wk.week)] || "";
        ct(doc, x, y, ww, RH, k.trim(), {
          bg: "#fff",
          fs: 6,
          b: true,
          c: "#000",
        });
        x += ww;
      }
    }
    const st = statisticsMap(c.statistics);
    const sv = [
      c.total ?? "",
      st.theoreticalPractical ?? "",
      st.certification ?? "",
      st.creditSystem ?? "",
      st.qualification ?? "",
      st.final ?? "",
      st.vacation ?? "",
      st.gpa ?? "",
      st.all ?? c.total ?? "",
    ];
    sx = PG.margin + KW + mw;
    for (const v of sv) {
      ct(doc, sx, y, SW, RH, v === 0 || v === "0" ? "" : String(v), { fs: 6 });
      sx += SW;
    }
    y += RH;
  }

  if (lp.allValues) {
    ct(doc, PG.margin, y, KW + mw, RH, "Jami", { b: true, fs: 6 });
    const avTotal = lp.allValues.total;
    const av = statisticsMap(lp.allValues.statistics ?? lp.allValues);
    const jv = [
      avTotal ?? av.total ?? av.all ?? "",
      av.theoreticalPractical ?? "",
      av.certification ?? "",
      av.creditSystem ?? "",
      av.qualification ?? "",
      av.final ?? "",
      av.vacation ?? "",
      av.gpa ?? "",
      av.all ?? avTotal ?? "",
    ];
    sx = PG.margin + KW + mw;
    for (const v of jv) {
      ct(doc, sx, y, SW, RH, String(v), { b: true, fs: 5 });
      sx += SW;
    }
    y += RH;
  }

  y += LEGEND_GAP;
  const keys = (lp.keys || []).filter((k) => k.key);
  if (keys.length) {
    const BOX = LEGEND_BOX,
      GAP = 4;
    doc.font("Helvetica");
    const titleW = (k, size) => doc.fontSize(size).widthOfString(k.title || "");
    const itemsW = (size) => keys.reduce((s, k) => s + BOX + GAP + titleW(k, size), 0);
    const rowW = (size) => itemsW(size) + (keys.length - 1) * LEGEND_MIN_SPACE;
    let fs = LEGEND_FS;
    while (fs > 5 && rowW(fs) > CW) fs -= 0.25;
    const space = Math.min(
      LEGEND_MAX_SPACE,
      (CW - itemsW(fs)) / Math.max(1, keys.length - 1),
    );
    let lx = PG.margin + Math.max(0, (CW - itemsW(fs) - space * (keys.length - 1)) / 2);
    for (const k of keys) {
      const tw = titleW(k, fs);
      doc.rect(lx, y, BOX, BOX).lineWidth(0.4).fillAndStroke("#fff", "#333");
      doc
        .font("Helvetica-Bold")
        .fontSize(LEGEND_KEY_FS)
        .fillColor("#000")
        .text(k.key.trim(), lx, y + (BOX - LEGEND_KEY_FS) / 2, {
          width: BOX,
          align: "center",
          lineBreak: false,
        });
      doc
        .font("Helvetica")
        .fontSize(fs)
        .fillColor("#000")
        .text(k.title || "", lx + BOX + GAP, y + (BOX - fs) / 2, {
          width: tw + 2,
          lineBreak: false,
        });
      lx += BOX + GAP + tw + space;
    }
    y += BOX;
  }
}

function drawPage2(doc, blocks, meta, lp) {
  if (!blocks.length) return;

  const sems = [];
  for (const b of blocks) {
    for (const k of gmk(b.semesters)) if (!sems.includes(k)) sems.push(k);
    for (const s of b.sciences || [])
      for (const k of gmk(s.semesters)) if (!sems.includes(k)) sems.push(k);
  }
  sems.sort((a, b) => Number(a) - Number(b));
  const sc = sems.length;

  const dist = meta.distribution || {};
  const cNames = dist.courses || [];
  const kc = cNames.length || Math.ceil(sc / 2);
  const kGroups = [];
  let si = 0;
  for (let k = 0; k < kc; k++) {
    const ss = [];
    const pk = Math.ceil(sc / kc);
    for (let s = 0; s < pk && si < sc; s++) {
      ss.push(sems[si]);
      si++;
    }
    kGroups.push({ name: cNames[k] || `${k + 1}-kurs`, sems: ss });
  }

  const audWeeks = Array.isArray(dist.audience)
    ? dist.audience
    : dist.audience?.course || [];
  const credDist = Array.isArray(meta.credit?.distribution)
    ? meta.credit.distribution
    : meta.credit?.distribution?.course || [];
  const distWeekly = Array.isArray(dist.weekly) ? dist.weekly : [];
  const creditWeekly = Array.isArray(meta.credit?.weekly)
    ? meta.credit.weekly
    : [];

  let pCols = sortByColNum(meta?.particles?.items || []).map((it) => ({
    slug: it.slug,
    title: it.title || it.slug,
    canonical: it.canonical || null,
    colNum: it.colNum != null ? +it.colNum : null,
  }));
  if (!pCols.length) {
    for (const b of blocks) {
      const arr = Array.isArray(b.particle) ? b.particle : null;
      if (arr?.length) {
        pCols = sortByColNum(arr).map((p) => ({
          slug: p.slug,
          title: p.title || p.slug,
          canonical: p.canonical || null,
          colNum: p.colNum != null ? +p.colNum : null,
        }));
        break;
      }
      for (const s of b.sciences || []) {
        const sarr = Array.isArray(s.particle) ? s.particle : null;
        if (sarr?.length) {
          pCols = sortByColNum(sarr).map((p) => ({
            slug: p.slug,
            title: p.title || p.slug,
            canonical: p.canonical || null,
            colNum: p.colNum != null ? +p.colNum : null,
          }));
          break;
        }
      }
      if (pCols.length) break;
    }
  }

  const getParticleValue = (particle, pc) => {
    if (!particle) return "";
    if (Array.isArray(particle)) {
      if (pc.canonical) {
        const v = particleValue(particle, pc.canonical, NaN);
        if (Number.isFinite(v)) return v;
      }
      const v2 = particleValue(particle, pc.slug, NaN);
      return Number.isFinite(v2) ? v2 : "";
    }
    return particle[pc.slug] ?? "";
  };

  const yukCols = resolveLoadColumns(pCols).map((c) => ({
    ...c,
    title: normApos(c.title) || c.title,
  }));
  const numOrBlank = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n !== 0 ? String(n) : "";
  };

  const P_NR = 2.4;
  const P_CD = 3.8;
  const P_NM = 9.3;
  const P_JKR = 2.0;
  const P_COL = 2.2;
  const P_COL_OPT = 1.7;
  const colP = (yc) => (yc.optional ? P_COL_OPT : P_COL);
  const P_SEM = 1.7;
  const P_KR = 1.7;

  const yukP = yukCols.reduce((acc, yc) => acc + colP(yc), 0);
  const fixP = P_NR + P_CD + P_NM + P_JKR + yukP;
  const semSoatP = sc * P_SEM;
  const semKrP = sc * P_KR;
  const totalP = fixP + semSoatP + semKrP;
  const u = CW / totalP;

  const sN = u * P_NR,
    sCD = u * P_CD,
    sNM = u * P_NM,
    sJK = u * P_JKR,
    sSS = u * P_SEM,
    sKK = u * P_KR;
  for (const yc of yukCols) yc.w = u * colP(yc);
  const zoneW = (zone) =>
    yukCols.filter((c) => c.zone === zone).reduce((acc, c) => acc + c.w, 0);
  const yukW = zoneW(LOAD_ZONE.UMUMIY) + zoneW(LOAD_ZONE.AUDITORIYA) + zoneW(LOAD_ZONE.MUSTAQIL);
  const soatGW = sc * sSS;
  const krGW = sc * sKK;

  const HDR_FS = 5;
  const RFR = [9, 9, 9, 8, 9, 8, 10, 9, 8];
  const FOFF = [0];
  for (let i = 0; i < RFR.length; i++) FOFF.push(FOFF[i] + RFR[i]);
  const HH = FOFF[FOFF.length - 1];
  let y = doc.y;
  const fy = (i) => y + FOFF[i];
  const fh = (from, to) => FOFF[to] - FOFF[from];
  let x = PG.margin;

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#000")
    .text("II.  O'QUV REJASI", PG.margin, y, { width: CW, align: "center" });
  y = doc.y + 4;

  ctFit(doc, x, fy(0), sN, fh(0, 9), "T/r", { b: true, fsMax: HDR_FS });
  x += sN;
  const codeHdr = headerText(meta.code, "Fanning malakaviy kodi", lp?.title);
  ctV(doc, x, fy(0), sCD, fh(0, 9), codeHdr, { fsMax: HDR_FS });
  x += sCD;
  ctFit(
    doc,
    x,
    fy(0),
    sNM,
    fh(0, 9),
    "O'quv bloklari, fanlar va faoliyat turlarining nomlari",
    { b: true, fsMax: HDR_FS },
  );
  x += sNM;

  const yukX0 = x;
  const particleHdr = headerText(
    meta.particles?.title || meta.particles?.particle,
    "Talabaning o'quv yuklamasi (soatlarda)",
    lp?.title,
  );
  const distHdr = headerText(
    meta.distribution?.title || meta.distribution?.distribution,
    "Soatlarning kurslar, semestrlar va haftalar bo'yicha taqsimoti",
    lp?.title,
  );
  const creditHdr = headerText(
    meta.credit?.title || meta.credit?.credit,
    "Kreditlarning kurslar, semestrlar va haftalar bo'yicha taqsimoti",
    lp?.title,
  );
  ctFit(doc, yukX0, fy(0), yukW, fh(0, 1), particleHdr, {
    b: true,
    fsMax: HDR_FS,
  });
  ctFit(doc, yukX0 + yukW, fy(0), soatGW, fh(0, 1), distHdr, {
    b: true,
    fsMax: HDR_FS,
  });
  ctFit(doc, yukX0 + yukW + soatGW, fy(0), krGW, fh(0, 1), creditHdr, {
    b: true,
    fsMax: HDR_FS,
  });

  const umumiyW = zoneW(LOAD_ZONE.UMUMIY);
  const auditoriyaW = zoneW(LOAD_ZONE.AUDITORIYA);
  ctFit(doc, yukX0, fy(1), umumiyW, fh(1, 7), "Umumiy yuklamaning hajmi", {
    b: true,
    fsMax: HDR_FS,
  });
  ctFit(
    doc,
    yukX0 + umumiyW,
    fy(1),
    auditoriyaW,
    fh(1, 2),
    "Auditoriya mashg'ulotlari, soatlarda",
    { b: true, fsMax: HDR_FS },
  );
  const mustaqilCol = yukCols.find((c) => c.zone === LOAD_ZONE.MUSTAQIL);
  ctV(
    doc,
    yukX0 + umumiyW + auditoriyaW,
    fy(1),
    mustaqilCol.w,
    fh(1, 8),
    mustaqilCol.title,
    { fsMax: HDR_FS },
  );

  {
    let ax = yukX0 + umumiyW;
    for (const yc of yukCols.filter((c) => c.zone === LOAD_ZONE.AUDITORIYA)) {
      ctV(doc, ax, fy(2), yc.w, fh(2, 8), yc.title, { fsMax: HDR_FS });
      ax += yc.w;
    }
  }
  ctFit(doc, yukX0, fy(7), yukCols[0].w, fh(7, 8), "soat", {
    b: true,
    fsMax: HDR_FS,
  });
  ctFit(doc, yukX0 + yukCols[0].w, fy(7), yukCols[1].w, fh(7, 8), "%", {
    b: true,
    fsMax: HDR_FS,
  });

  function drawDistSide(x0, gw, sw, weekly, semVals, bannerLong) {
    let kx = x0;
    for (const kg of kGroups) {
      const kw = kg.sems.length * sw;
      ctFit(doc, kx, fy(1), kw, fh(1, 2), kg.name, {
        b: true,
        fsMax: HDR_FS,
      });
      kx += kw;
    }
    ctFit(doc, x0, fy(2), gw, fh(2, 3), "Kurslardagi haftalar soni", {
      b: true,
      fsMax: HDR_FS,
    });
    kx = x0;
    kGroups.forEach((kg, k) => {
      const kw = kg.sems.length * sw;
      ctFit(doc, kx, fy(3), kw, fh(3, 4), numOrBlank(weekly[k]), {
        b: true,
        fsMax: HDR_FS,
      });
      kx += kw;
    });
    ctFit(doc, x0, fy(4), gw, fh(4, 5), "Semestrlar", {
      b: true,
      fsMax: HDR_FS,
    });
    kx = x0;
    sems.forEach((sem) => {
      ctFit(doc, kx, fy(5), sw, fh(5, 6), sem, { fsMax: HDR_FS });
      kx += sw;
    });
    ctFit(doc, x0, fy(6), gw, fh(6, 7), bannerLong, {
      b: true,
      fsMax: HDR_FS,
    });
    kx = x0;
    sems.forEach((sem, i) => {
      ctFit(doc, kx, fy(7), sw, fh(7, 8), numOrBlank(semVals[i]), {
        fsMax: HDR_FS,
      });
      kx += sw;
    });
  }
  drawDistSide(
    yukX0 + yukW,
    soatGW,
    sSS,
    distWeekly,
    audWeeks,
    "Semestrdagi auditoriya mashg'ulotlari haftalarining soni",
  );
  drawDistSide(
    yukX0 + yukW + soatGW,
    krGW,
    sKK,
    creditWeekly,
    credDist,
    "Kredit taqsimoti",
  );

  const jkrX = yukX0 + yukW + soatGW + krGW;
  ctV(doc, jkrX, fy(0), sJK, fh(0, 6), "Jami kreditlar", { fsMax: HDR_FS });
  ctFit(doc, jkrX, fy(6), sJK, fh(6, 8), "", {});

  let colSeq = 1;
  const nextNo = () => colSeq++;
  ctFit(doc, PG.margin, fy(8), sN, fh(8, 9), nextNo(), { fsMax: HDR_FS });
  ctFit(doc, PG.margin + sN, fy(8), sCD, fh(8, 9), nextNo(), { fsMax: HDR_FS });
  ctFit(doc, PG.margin + sN + sCD, fy(8), sNM, fh(8, 9), nextNo(), {
    fsMax: HDR_FS,
  });
  {
    let nx = yukX0;
    for (const yc of yukCols) {
      ctFit(doc, nx, fy(8), yc.w, fh(8, 9), nextNo(), { fsMax: HDR_FS });
      nx += yc.w;
    }
  }
  const distSemNums = sems.map(() => nextNo());
  const creditSemNums = sems.map(() => nextNo());
  {
    let nx = yukX0 + yukW;
    sems.forEach((_, i) => {
      ctFit(doc, nx, fy(8), sSS, fh(8, 9), distSemNums[i], {
        fsMax: HDR_FS,
      });
      nx += sSS;
    });
    sems.forEach((_, i) => {
      ctFit(doc, nx, fy(8), sKK, fh(8, 9), creditSemNums[i], {
        fsMax: HDR_FS,
      });
      nx += sKK;
    });
  }
  ctFit(doc, jkrX, fy(8), sJK, fh(8, 9), nextNo(), { fsMax: HDR_FS });

  y += HH;

  const RH = 15,
    BH = 16;
  const F = 5.5;
  const F_CODE = 4.5;
  const ROWPAD = 4;
  function measureRowHeight(title, code, minH) {
    const t = title != null ? String(title) : "";
    const c = code != null ? String(code) : "";
    doc.font("Helvetica").fontSize(F);
    const th = t ? doc.heightOfString(t, { width: sNM - 3, align: "left" }) : 0;
    doc.font("Helvetica").fontSize(F_CODE);
    const ch = c ? doc.heightOfString(c, { width: sCD - 3, align: "center" }) : 0;
    return Math.max(minH, Math.ceil(Math.max(th, ch)) + ROWPAD);
  }

  function row(
    ry,
    rh,
    serial,
    code,
    title,
    particle,
    semesters,
    totalCredit,
    opts = {},
  ) {
    const { bold = false, bg = null } = opts;
    x = PG.margin;
    ct(doc, x, ry, sN, rh, serial ?? "", { fs: F, b: bold, bg });
    x += sN;
    ct(doc, x, ry, sCD, rh, code ?? "", { fs: F_CODE, b: bold, bg });
    x += sCD;
    ct(doc, x, ry, sNM, rh, title ?? "", { fs: F, al: "left", b: bold, bg });
    x += sNM;

    for (const yc of yukCols) {
      const val = getParticleValue(particle, yc);
      ct(doc, x, ry, yc.w, rh, numOrBlank(val), { fs: F, b: bold, bg });
      x += yc.w;
    }

    sems.forEach((sem) => {
      const sd = gmv(semesters, sem);
      ct(doc, x, ry, sSS, rh, numOrBlank(sd.hour), { fs: F, b: bold, bg });
      x += sSS;
    });
    sems.forEach((sem) => {
      const sd = gmv(semesters, sem);
      ct(doc, x, ry, sKK, rh, numOrBlank(sd.credit), { fs: F, b: bold, bg });
      x += sKK;
    });

    ct(doc, x, ry, sJK, rh, numOrBlank(totalCredit), { fs: F, b: bold, bg });
    x += sJK;
  }

  const fileHasTotals = hasAggregateRow(blocks);
  const totals = computePlanTotals(blocks, sems);

  function totalRow(ry, label, tot, mode) {
    if (ry + BH > PG.height - PG.margin - 10) {
      doc.addPage(PAGE_OPTS);
      ry = PG.margin + 3;
    }
    const st = { b: true, fs: F, bg: "#ddd" };
    let tx = PG.margin;
    ct(doc, tx, ry, sN, BH, "", { bg: "#ddd" });
    ct(doc, tx + sN, ry, sCD, BH, "", { bg: "#ddd" });
    ct(doc, tx + sN + sCD, ry, sNM, BH, label, { ...st, fs: 7, al: "center" });
    tx += sN + sCD + sNM;
    const full = mode === "full";
    for (const yc of yukCols) {
      const show = full || yc.canonical === CANONICAL.HOUR;
      ct(doc, tx, ry, yc.w, BH, show ? numOrBlank(tot.particle[yc.slug]) : "", st);
      tx += yc.w;
    }
    for (const sem of sems) {
      ct(doc, tx, ry, sSS, BH, full ? numOrBlank(tot.semHour[sem]) : "", st);
      tx += sSS;
    }
    for (const sem of sems) {
      ct(doc, tx, ry, sKK, BH, numOrBlank(tot.semCredit[sem]), st);
      tx += sKK;
    }
    ct(doc, tx, ry, sJK, BH, numOrBlank(tot.credit), st);
    return ry + BH;
  }

  for (const block of blocks) {
    const bt = `${block.serialNumber || ""} ${block.title || ""}`.trim();
    const blockCode = block.code || block.blockCode || "";
    const blockH = measureRowHeight(bt, blockCode, BH);
    if (y + blockH + RH > PG.height - PG.margin - 10) {
      doc.addPage(PAGE_OPTS);
      y = PG.margin + 3;
    }
    row(
      y,
      blockH,
      "",
      blockCode,
      bt,
      block.particle,
      block.semesters,
      block.totalCredit,
      { bold: true, bg: "#eef2f7" },
    );
    y += blockH;

    const rowTypes = classifyRows(block.sciences || []);
    for (const [i, sci] of (block.sciences || []).entries()) {
      const sciH = measureRowHeight(sci.title, sci.code, RH);
      if (y + sciH > PG.height - PG.margin - 10) {
        doc.addPage(PAGE_OPTS);
        y = PG.margin + 3;
      }
      row(
        y,
        sciH,
        sci.serialNumber,
        sci.code,
        sci.title,
        sci.particle,
        sci.semesters,
        sci.totalCredit,
        rowStyle(rowTypes[i]),
      );
      y += sciH;
    }

    if (!fileHasTotals && totals.hasPractice) {
      if (block === totals.lastFanBlock) y = totalRow(y, "Jami", totals.fan, "full");
      if (block === totals.lastPracticeBlock) y = totalRow(y, "Jami", totals.practice, "soat");
    }
  }

  if (fileHasTotals) return y;
  if (totals.hasPractice) return totalRow(y, "HAMMASI", totals.grand, "soat");
  return totalRow(y, "Jami", totals.grand, "full");
}

function drawPage3(doc, lp, y, cfg) {
  const ensureSpace = (needed) => {
    if (y + needed <= PAGE_BOTTOM) return;
    doc.addPage(PAGE_OPTS);
    y = PG.margin + 10;
  };

  const comments = lp.comment ?? lp.comments;
  if (comments && typeof comments === "string" && comments.trim()) {
    ensureSpace(IZOH_HEAD_H);
    y += 10;
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#000")
      .text("Izoh:", PG.margin, y, { width: CW });
    y = doc.y + 4;
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#000")
      .text(sanText(comments), PG.margin + 5, y, {
        width: CW - 10,
        lineGap: 2,
        align: "justify",
      });
    y = doc.y + 3;
  }

  y += 12;
  if (lp.learningProcess?.keys?.length) {

    const tW = CW * 0.42;
    const hW = CW * 0.12;
    const sW = CW * 0.12;
    const nW = CW * 0.34;
    const RH = 18;
    const rowCount = lp.learningProcess.keys.filter(
      (k) => (k.title || "").toUpperCase() !== "JAMI",
    ).length;
    ensureSpace(RH * (rowCount + 2));

    ct(doc, PG.margin, y, tW, RH, "O'quv jarayonining tarkibiy qismlari", {
      b: true,
      fs: 7,
    });
    ct(doc, PG.margin + tW, y, hW, RH, "Hafta", { b: true, fs: 7 });
    ct(doc, PG.margin + tW + hW, y, sW, RH, "Semestr", { b: true, fs: 7 });
    ct(doc, PG.margin + tW + hW + sW, y, nW, RH, "", { b: true, fs: 7 });
    y += RH;

    const noteX = PG.margin + tW + hW + sW;
    const noteY = y;
    const dataRows = (lp.learningProcess.keys || []).filter(
      (k) => (k.title || "").toUpperCase() !== "JAMI",
    );
    const noteH = (dataRows.length + 1) * RH;

    for (const { item: k, label } of orderByLabels(dataRows, lp.summaryRows, (r) => r.key)) {
      const title = (label ? sanText(label) : k.title) || "";

      ct(doc, PG.margin, y, tW, RH, title, { fs: 7, al: "center" });
      ct(doc, PG.margin + tW, y, hW, RH, String(k.week || ""), { fs: 7 });
      ct(
        doc,
        PG.margin + tW + hW,
        y,
        sW,
        RH,
        k.semester ? String(k.semester) : "",
        { fs: 7 },
      );

      y += RH;
    }

    ct(doc, PG.margin, y, tW, RH, "JAMI", { b: true, fs: 7, bg: "#eee" });
    const totalWeeks = (lp.learningProcess.keys || [])
      .filter((k) => (k.title || "").toUpperCase() !== "JAMI")
      .reduce((s, k) => s + (k.week || 0), 0);
    ct(doc, PG.margin + tW, y, hW, RH, String(totalWeeks), {
      b: true,
      fs: 7,
      bg: "#eee",
    });
    ct(doc, PG.margin + tW + hW, y, sW, RH, "", { bg: "#eee" });
    y += RH;

    ct(doc, noteX, noteY, nW, noteH, lp.attestationNote || YDA_IZOH, {
      fs: 6.5,
      al: "center",
    });
  }

  const lineH = 22;

  const signatures = [
    { role: "O'quv ishlari bo'yicha prorektor" },
    { role: "O'quv-uslubiy boshqarma boshlig'i" },
    { role: "Fakultet dekanlari" },
  ];
  ensureSpace(
    20 + signatures.length * lineH + 8 + 12 + (cfg.kadrlarLines || []).length * 10,
  );
  y += 20;

  for (const sig of signatures) {
    const rowH = drawSignatureBlock(doc, {
      x: PG.margin,
      y,
      w: CW,
      layout: "row",
      position: sig.role,
      sig: { name: "", dateText: "", source: "none" },
    });
    y += Math.max(lineH, rowH);
  }

  y += 8;
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#000")
    .text("Kadrlar buyurtmachisi:", PG.margin, y);
  doc.font("Helvetica").fontSize(7).fillColor("#333");
  (cfg.kadrlarLines || []).forEach((line) => {
    doc.text(line, PG.margin, doc.y + 1);
  });
}

const generateStudyPlanPdf = async (req, res, next) => {
  try {
    const plan = await StudyPlanModel.findById(req.params.id)
      .populate({
        path: "learningProcess",
        populate: [
          { path: "direction", select: "title directionCode" },
          { path: "academicLevel", select: "title" },
          { path: "educationForm", select: "title" },
          { path: "readingForm", select: "title" },
          { path: "studyPeriod", select: "title" },
          { path: "specialization", select: "title" },
        ],
      })
      .exec();

    if (!plan) return next(new ErrorHandler(404, "O'quv reja topilmadi"));

    const lp = plan.learningProcess || {};
    const dir = lp.direction || {};
    const meta = plan.meta || {};

    const cfg = {
      ministry1:
        process.env.PDF_MINISTRY_1 ||
        "O'ZBEKISTON RESPUBLIKASI SOG'LIQNI SAQLASH VAZIRLIGI",
      ministry2:
        process.env.PDF_MINISTRY_2 ||
        "O'ZBEKISTON RESPUBLIKASI OLIY TA'LIM, FAN VA INNOVASIYALAR VAZIRLIGI",
      instituteName:
        process.env.PDF_INSTITUTE_NAME ||
        "FARG'ONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI",
      rectorTitle: process.env.PDF_RECTOR_TITLE || "Institut rektori",
      particleTitle:
        meta.particles?.title ||
        meta.particles?.particle ||
        "Talabaning o'quv yuklamasi (soatlarda)",
      distributionTitle:
        meta.distribution?.title ||
        meta.distribution?.distribution ||
        "Soatlarning semestrlar va haftalar bo'yicha taqsimoti",
      creditTitle:
        meta.credit?.title ||
        meta.credit?.credit ||
        "Kreditlarning semestrlar va haftalar bo'yicha taqsimoti",
      kadrlarLines: (
        process.env.PDF_KADRLAR ||
        "Sog'liqni saqlash vazirligi\nFan va ta'lim boshqarmasi\nboshlig'i"
      ).split("\n"),
    };

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: {
        top: PG.margin,
        bottom: PG.margin,
        left: PG.margin,
        right: PG.margin,
      },
      bufferPages: true,
      info: { Creator: "Institut AIS", Producer: "PDFKit" },
    });
    registerCyrillicFonts(doc);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="oquv-reja-${plan._id}.pdf"`,
    );
    doc.pipe(res);

    drawPage1(doc, lp, dir, cfg);

    if ((plan.blocks || []).length) {
      doc.addPage(PAGE_OPTS);
      doc.y = PG.margin + 3;
      const lastY = drawPage2(doc, plan.blocks, plan.meta || {}, lp);

      const neededSpace = 400;
      if (lastY && lastY + neededSpace > PG.height - PG.margin) {
        doc.addPage(PAGE_OPTS);
        drawPage3(doc, lp, PG.margin + 10, cfg);
      } else {
        drawPage3(doc, lp, (lastY || PG.margin) + 10, cfg);
      }
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font("Helvetica")
        .fontSize(5)
        .fillColor("#999")
        .text(
          `O'quv reja  |  ${i - range.start + 1} / ${range.count}`,
          PG.margin,
          PG.height - PG.margin + 3,
          { width: CW, align: "center" },
        );
      doc.page.margins.bottom = bottomMargin;
    }

    doc.end();
  } catch (err) {
    return next(new ErrorHandler(500, "PDF yaratishda xatolik", err.message));
  }
};

module.exports = {
  generateStudyPlanPdf,
  _internals: { computePlanTotals, isPracticeBlock, rowStyle, ROW_STYLE },
};
