"use strict";
const { ErrorHandler } = require("#shared/error");
const PersonalWorkPlan = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
const PersonalReport = require("#modules/4.03-teacher/personalReport/personalReport.model");
const {
  createDoc,
  pipeToResponse,
} = require("#shared/pdfGenerators/pdfHelpers");
const {
  buildGroupedVisibilityFilter,
  andFilters,
} = require("#modules/4.03-teacher/_shared/workPlanChain");
const {
  PG,
  CW,
  FOOTER_H,
  C,
  san,
  fmtDate,
  bdr,
  ct,
  measureCell,
  checkPage,
  drawFooterLandscape,
} = require("./_blankaTable");
const { prepareVerifyQr, QR_SIZE } = require("#modules/4.03-teacher/_shared/verifyQr");

const INTRO_SENTENCES = [
  "Zarur hollarda (ma'ruza mashg'ulotlari hajmi ko'p bo'lganda yoki professor, dotsent va katta o'qituvchilar yetarli bo'lmaganda) OTM Kengashining qaroriga asosan kamida 3 yillik ilmiy-pedagogik ish stajiga ega bo'lgan, biroq ilmiy unvon va ilmiy darajasi bo'lmagan o'qituvchilarga bir o'quv yilida 250 soatgacha hajmda ma'ruza mashg'ulotlarini o'tishga ruxsat beriladi.",
  "Professor-o'qituvchilarning o'quv (ma'ruza, amaliy, seminar va laboratoriya) soatlari hajmi 400 soatdan kam bo'lmasligi tavsiya etiladi.",
];

const COLS_TEACHING = [
  { key: "no", w: 18, hdr: "№" },
  { key: "science", w: 133, hdr: "Fan nomi", align: "left" },
  { key: "bachelor", w: 36, hdr: "bakalavriatura" },
  { key: "ordinatura", w: 34, hdr: "Klinik ordinatura" },
  { key: "magistratura", w: 34, hdr: "Magistratura" },
  { key: "faculty", w: 70, hdr: "fakultet", align: "left" },
  { key: "course", w: 22, hdr: "kurs" },
  { key: "stream", w: 28, hdr: "Oqim soni" },
  { key: "group", w: 28, hdr: "Guruh soni" },
  { key: "lecture", w: 44, hdr: "Ma'ruza o'tkazish" },
  {
    key: "practice",
    w: 65,
    hdr: "Amaliy, seminar va laboratoriya ishlarini o'tkazish",
  },
  { key: "on", w: 44, hdr: "Oraliq nazorat o'tkazish" },
  { key: "yan", w: 44, hdr: "Yakuniy nazorat o'tkazish" },
  { key: "retake", w: 40, hdr: "Qayta topshirish" },
  { key: "practiceLead", w: 44, hdr: "Malakaviy amaliyotga rahbarlik" },
  { key: "related", w: 44, hdr: "Turdosh fanlardan dars berish" },
  { key: "koLead", w: 44, hdr: "KO'larga rahbarlik qilish" },
  { key: "total", w: 34, hdr: "Jami" },
];

const TEACHING_HEADER_FS = 5;

const COLS_WORK = [
  { key: "no", w: 18, hdr: "№" },
  { key: "title", w: 380, hdr: "Ish turi", align: "left" },
  { key: "planned", w: 50, hdr: "Soni" },
  { key: "actual", w: 60, hdr: "Bajarildi" },
  { key: "semester", w: 80, hdr: "Semestr" },
  { key: "deadline", w: 80, hdr: "Muddat" },
  { key: "status", w: 138, hdr: "Holat" },
];

const SECTION_TITLES = {
  methodicalWork: "II. O'quv-uslubiy ishlar",
  researchWork: "III. Ilmiy-tadqiqot ishlari",
  mentoringWork: 'IV. "Ustoz-shogird" ishlari',
  organizationalWork: "V. Tashkiliy ishlar",
  extraWork: "VI. Rejadan tashqari ishlar",
};
const SECTION_KEYS = Object.keys(SECTION_TITLES);

const EMPTY_WORK_ROW = Object.fromEntries(
  COLS_WORK.map((col) => [col.key, col.key === "title" ? "Rejalashtirilmagan" : ""]),
);

const STATUS_LABEL = {
  planned: "Rejalashtirilgan",
  completed: "Bajarilgan",
  overdue: "Kechiktirilgan",
  cancelled: "Bekor qilingan",
};

const {
  KAFEDRA_SIGNATORIES,
  SIGNATORIES,
} = require("#modules/4.03-teacher/_shared/workPlanSignatories");

const MID_TEXT =
  "O'quv-uslubiy boshqarma, fakultet dekanati, ichki nazorat va monitoring bo'limi tomonidan tekshirildi va tasdiqlandi";

const SIGN_W = {
  pos: 230,
  fio: 130,
  kind: 62,
  imzoA: 100,
  sanaA: 92,
  imzoB: 100,
  sanaB: 92,
};

const ERI_TEXT = "(ERI bilan imzolangan)";
const REJECTED_TEXT = "Rad etilgan";
const EMPTY_CELL = { imzo: "", sana: "" };

function num(v) {
  return v ? String(v) : "";
}

function shortName(user) {
  if (!user) return "";
  const initials = [user.firstName, user.middleName]
    .filter(Boolean)
    .map((s) => `${String(s).trim().charAt(0).toUpperCase()}.`)
    .join("");
  return [user.lastName, initials].filter(Boolean).join(" ").trim();
}

function fullName(user) {
  if (!user) return "";
  return [user.lastName, user.firstName, user.middleName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function semesterLabel(sem) {
  const arr = Array.isArray(sem) ? sem : sem ? [sem] : [];
  if (!arr.length) return "";
  return arr
    .map((s) => (s === 1 ? "Kuzgi" : s === 2 ? "Bahorgi" : String(s)))
    .join(", ");
}

const round2 = (n) => Math.round(n * 100) / 100;

const isDecomposed = (h) => h.on !== null && h.on !== undefined;

function decomposedCells(s, h, practice) {
  if (!isDecomposed(h)) {
    return { stream: "", group: "", on: "", yan: "", retake: "", practiceLead: "" };
  }
  return {
    stream: h.lecture ? num(s.streamCount) : "",
    group: practice ? num(s.groupCount) : "",
    on: num(h.on),
    yan: num(h.yan),
    retake: num(h.retake),
    practiceLead: num(h.practiceLead),
  };
}

function buildTeachingRows(plan) {
  const sciences = plan?.teachingLoad?.sciences || [];
  const facultyTitle = plan?.teacher?.department?.faculty?.title || "";
  return sciences.map((s, i) => {
    const h = s.hoursByType || {};
    const practice = (h.seminar || 0) + (h.laboratory || 0) + (h.practical || 0);
    return {
      no: String(i + 1),
      science: s.science?.title || s.scienceName || "",
      bachelor: "",
      ordinatura: "",
      magistratura: "",
      faculty: facultyTitle,
      course: num(s.course),
      lecture: num(h.lecture),
      practice: num(practice),
      ...decomposedCells(s, h, practice),
      related: "",
      koLead: "",
      total: num(s.totalHour),
    };
  });
}

function buildTeachingTotalRow(plan, rows) {
  const sum = (key) =>
    num(round2(rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0)));
  const empty = {};
  for (const col of COLS_TEACHING) empty[col.key] = "";
  return {
    ...empty,
    science: "Jami",
    lecture: sum("lecture"),
    practice: sum("practice"),
    on: sum("on"),
    yan: sum("yan"),
    retake: sum("retake"),
    practiceLead: sum("practiceLead"),
    total: num(plan?.teachingLoad?.plannedHour),
  };
}

function unassignedOf(h) {
  if (isDecomposed(h)) return { hours: (h.otherWork || 0) + (h.adjustment || 0), legacy: false };
  return { hours: h.independent || 0, legacy: Boolean(h.independent) };
}

const FOOTNOTE_WHY = {
  legacy: "eski formatdagi qatorlarda ON, YAN, qayta topshirish va amaliyot soatlari ajratilmagan; boshqa o'quv ishlari",
  fresh: "boshqa o'quv ishlari va qo'lda kiritilgan tuzatishlar",
};

function teachingFootnote(plan) {
  const parts = (plan?.teachingLoad?.sciences || []).map((s) => unassignedOf(s.hoursByType || {}));
  const hours = round2(parts.reduce((acc, p) => acc + p.hours, 0));
  if (!hours) return null;
  const why = parts.some((p) => p.legacy) ? FOOTNOTE_WHY.legacy : FOOTNOTE_WHY.fresh;
  return `* Ustunlarda ko'rsatilmagan soatlar: ${hours} (${why}).`;
}

function buildWorkRows(items = []) {
  return items.map((item, i) => ({
    no: String(i + 1),
    title: item.title || "",
    planned: num(item.plannedCount),
    actual: num(item.actualCount),
    semester: semesterLabel(item.semester),
    deadline: fmtDate(item.deadline),
    status: STATUS_LABEL[item.effectiveStatus || item.status] || "",
  }));
}

function approvalCell(step) {
  if (!step) return { ...EMPTY_CELL };
  if (step.status === "approved") {
    return { imzo: ERI_TEXT, sana: fmtDate(step.date) };
  }
  if (step.status === "rejected") {
    return { imzo: REJECTED_TEXT, sana: fmtDate(step.date) };
  }
  return { ...EMPTY_CELL };
}

function buildSignatureRows(plan, reports = []) {
  const approvals = plan?.approvals || [];
  return SIGNATORIES.map(({ step, label }) => {
    const approval = approvals.find((a) => a.step === step);
    const row = {
      step,
      label,
      fio: fullName(approval?.approvedBy),
      taqsimot: { kuzgi: approvalCell(approval), bahorgi: { ...EMPTY_CELL } },
      bajaruv: { kuzgi: { ...EMPTY_CELL }, bahorgi: { ...EMPTY_CELL } },
    };
    if (step === "dekan") {
      for (const report of reports) {
        const dekanStep = (report.approvals || []).find(
          (a) => a.step === "dekan",
        );
        const cell = approvalCell(dekanStep);
        if (report.semester === 1) row.bajaruv.kuzgi = cell;
        else if (report.semester === 2) row.bajaruv.bahorgi = cell;
      }
    }
    return row;
  });
}

function buildKotibLines(reports = []) {
  return reports.flatMap((report) => {
    const kotib = (report.approvals || []).find((a) => a.step === "kotib");
    if (!kotib || kotib.status !== "approved") return [];
    const who = fullName(kotib.approvedBy);
    const semester = report.semester === 2 ? "Bahorgi" : "Kuzgi";
    return [
      `Hisobot: ${semester} semestr — kengash kotibi ${who ? `${who} ` : ""}tasdiqladi, ${fmtDate(kotib.date)}`,
    ];
  });
}

function pickReports(reports = []) {
  const bySemester = new Map();
  for (const report of reports) {
    const prev = bySemester.get(report.semester);
    if (!prev) {
      bySemester.set(report.semester, report);
      continue;
    }
    const signed = (r) =>
      (r.approvals || []).some(
        (a) => a.step === "dekan" && a.status === "approved",
      );
    if (signed(report) && !signed(prev)) bySemester.set(report.semester, report);
  }
  return [...bySemester.values()];
}

function rowHeight(doc, cols, row, opts = {}) {
  const { fs = 6, bold = false, minH = 12 } = opts;
  let h = minH;
  for (const col of cols) {
    const value = row[col.key] ?? "";
    h = Math.max(
      h,
      measureCell(doc, value, col.w, {
        fs,
        bold,
        align: col.align || "center",
      }) + 3,
    );
  }
  return h;
}

function drawRow(doc, cols, row, y, opts = {}) {
  const { fs = 6, bold = false, bg, h } = opts;
  let x = PG.M;
  for (const col of cols) {
    bdr(doc, x, y, col.w, h, bg);
    ct(doc, row[col.key] ?? "", x, y, col.w, h, {
      fs,
      bold,
      align: col.align || "center",
    });
    x += col.w;
  }
  return y + h;
}

function headerRowOf(cols) {
  const row = {};
  for (const col of cols) row[col.key] = col.hdr;
  return row;
}

function drawTable(doc, cols, rows, y, opts = {}) {
  const { headerFs = 5.5, rowFs = 6, boldLastRow = false } = opts;
  const header = headerRowOf(cols);
  const drawHeader = (yy) => {
    const h = rowHeight(doc, cols, header, {
      fs: headerFs,
      bold: true,
      minH: 14,
    });
    return drawRow(doc, cols, header, yy, {
      fs: headerFs,
      bold: true,
      bg: C.headerBg,
      h,
    });
  };

  const firstRowH = rows.length
    ? rowHeight(doc, cols, rows[0], { fs: rowFs })
    : 12;
  const headerH = rowHeight(doc, cols, header, {
    fs: headerFs,
    bold: true,
    minH: 14,
  });
  y = checkPage(doc, y, headerH + firstRowH);
  y = drawHeader(y);

  rows.forEach((row, i) => {
    const bold = boldLastRow && i === rows.length - 1;
    const h = rowHeight(doc, cols, row, { fs: rowFs, bold });
    if (y + h > PG.H - PG.M - FOOTER_H) {
      doc.addPage();
      y = drawHeader(PG.M);
    }
    y = drawRow(doc, cols, row, y, { fs: rowFs, bold, h });
  });
  return y;
}

function drawCenteredText(doc, text, y, opts = {}) {
  const { fs = 8, bold = false, italic = false, gapAfter = 4 } = opts;
  const h = measureCell(doc, text, CW + 3, { fs, bold, italic });
  const yy = checkPage(doc, y, h + gapAfter);
  ct(doc, text, PG.M, yy, CW, h, { fs, bold, italic, align: "center" });
  return yy + h + gapAfter;
}

function drawLeftText(doc, text, y, opts = {}) {
  const { fs = 7, bold = false, gapAfter = 3, align = "left" } = opts;
  const h = measureCell(doc, text, CW + 3, { fs, bold, align });
  const yy = checkPage(doc, y, h + gapAfter);
  ct(doc, text, PG.M, yy, CW, h, { fs, bold, align });
  return yy + h + gapAfter;
}

function drawSectionHeading(doc, text, y) {
  return drawLeftText(doc, text, y + 4, { fs: 8, bold: true, gapAfter: 2 });
}

function drawVerifyQr(doc, qr, y) {
  if (!qr) return y;
  const yy = checkPage(doc, y + 4, QR_SIZE + 4);
  doc.image(qr.image, PG.M + CW - QR_SIZE, yy, { width: QR_SIZE, height: QR_SIZE });
  ct(doc, "Hujjat haqiqiyligini tekshirish uchun QR kodni skanerlang", PG.M, yy, CW - QR_SIZE - 6, QR_SIZE, {
    fs: 6.5,
    align: "right",
  });
  return yy + QR_SIZE + 4;
}

function drawSignatureTable(doc, rows, y) {
  const W = SIGN_W;
  const H1 = 13;
  const H2 = 12;
  const posX = PG.M;
  const fioX = posX + W.pos;
  const kindX = fioX + W.fio;
  const imzoAX = kindX + W.kind;
  const sanaAX = imzoAX + W.imzoA;
  const imzoBX = sanaAX + W.sanaA;
  const sanaBX = imzoBX + W.imzoB;

  const drawHead = (yy) => {
    bdr(doc, posX, yy, W.pos + W.fio, H1, C.headerBg);
    ct(doc, "Mas'ul shaxslar", posX, yy, W.pos + W.fio, H1, {
      fs: 6.5,
      bold: true,
    });
    bdr(doc, kindX, yy, W.kind, H1 + H2, C.headerBg);
    ct(doc, "Hisobot turi", kindX, yy, W.kind, H1 + H2, { fs: 6, bold: true });
    bdr(doc, imzoAX, yy, W.imzoA + W.sanaA, H1, C.headerBg);
    ct(doc, "KUZGI SEMESTR", imzoAX, yy, W.imzoA + W.sanaA, H1, {
      fs: 6.5,
      bold: true,
    });
    bdr(doc, imzoBX, yy, W.imzoB + W.sanaB, H1, C.headerBg);
    ct(doc, "BAHORGI SEMESTR", imzoBX, yy, W.imzoB + W.sanaB, H1, {
      fs: 6.5,
      bold: true,
    });
    const y2 = yy + H1;
    bdr(doc, posX, y2, W.pos, H2, C.headerBg);
    ct(doc, "Lavozimi", posX, y2, W.pos, H2, { fs: 6, bold: true });
    bdr(doc, fioX, y2, W.fio, H2, C.headerBg);
    ct(doc, "F.I.SH.", fioX, y2, W.fio, H2, { fs: 6, bold: true });
    bdr(doc, imzoAX, y2, W.imzoA, H2, C.headerBg);
    ct(doc, "Imzo", imzoAX, y2, W.imzoA, H2, { fs: 6, bold: true });
    bdr(doc, sanaAX, y2, W.sanaA, H2, C.headerBg);
    ct(doc, "Tasdiqlangan sana", sanaAX, y2, W.sanaA, H2, {
      fs: 6,
      bold: true,
    });
    bdr(doc, imzoBX, y2, W.imzoB, H2, C.headerBg);
    ct(doc, "Imzo", imzoBX, y2, W.imzoB, H2, { fs: 6, bold: true });
    bdr(doc, sanaBX, y2, W.sanaB, H2, C.headerBg);
    ct(doc, "Tasdiqlangan sana", sanaBX, y2, W.sanaB, H2, {
      fs: 6,
      bold: true,
    });
    return yy + H1 + H2;
  };

  y = checkPage(doc, y + 4, H1 + H2 + 28);
  y = drawHead(y);

  for (const row of rows) {
    const labelH = measureCell(doc, row.label, W.pos, { fs: 6, align: "left" });
    const fioH = measureCell(doc, row.fio, W.fio, { fs: 6 });
    const half = Math.max(13, Math.ceil(Math.max(labelH, fioH) / 2) + 3);
    const blockH = half * 2;
    if (y + blockH > PG.H - PG.M - FOOTER_H) {
      doc.addPage();
      y = drawHead(PG.M);
    }
    bdr(doc, posX, y, W.pos, blockH);
    ct(doc, row.label, posX, y, W.pos, blockH, { fs: 6, align: "left" });
    bdr(doc, fioX, y, W.fio, blockH);
    ct(doc, row.fio, fioX, y, W.fio, blockH, { fs: 6 });

    const pair = [
      { kind: "taqsimot", data: row.taqsimot },
      { kind: "bajaruv", data: row.bajaruv },
    ];
    pair.forEach(({ kind, data }, idx) => {
      const ry = y + idx * half;
      bdr(doc, kindX, ry, W.kind, half);
      ct(doc, kind, kindX, ry, W.kind, half, { fs: 6 });
      const cells = [
        { x: imzoAX, w: W.imzoA, text: data.kuzgi.imzo, eri: true },
        { x: sanaAX, w: W.sanaA, text: data.kuzgi.sana },
        { x: imzoBX, w: W.imzoB, text: data.bahorgi.imzo, eri: true },
        { x: sanaBX, w: W.sanaB, text: data.bahorgi.sana },
      ];
      for (const cell of cells) {
        bdr(doc, cell.x, ry, cell.w, half);
        ct(doc, cell.text, cell.x, ry, cell.w, half, {
          fs: 6,
          italic: Boolean(cell.eri) && cell.text === ERI_TEXT,
        });
      }
    });
    y += blockH;
  }
  return y;
}

async function buildPersonalWorkPlanPdf(id, scope = {}) {
  const plan = await PersonalWorkPlan.findOne({ _id: id, ...scope })
    .populate({
      path: "teacher",
      select: "firstName lastName middleName department position",
      populate: [
        {
          path: "department",
          select: "title faculty",
          populate: { path: "faculty", select: "title" },
        },
        { path: "position", select: "title" },
      ],
    })
    .populate("academicYear", "title")
    .populate("teachingLoad.sciences.science", "title scienceCode")
    .populate("approvals.approvedBy", "firstName lastName")
    .exec();

  if (!plan) {
    throw new ErrorHandler(
      404,
      "Shaxsiy ish reja topilmadi (yoki sizga tegishli emas)",
    );
  }

  const reports = pickReports(
    await PersonalReport.find({ plan: plan._id })
      .select("semester status approvals")
      .populate("approvals.approvedBy", "firstName lastName")
      .lean()
      .exec(),
  );

  const verifyQr = await prepareVerifyQr(plan);
  const academicYearTitle = plan.academicYear?.title || "";
  const doc = createDoc({
    layout: "landscape",
    margins: { top: PG.M, bottom: PG.M, left: PG.M, right: PG.M },
  });

  let y = PG.M;
  const headingName = shortName(plan.teacher);
  y = drawCenteredText(
    doc,
    `${headingName}${headingName ? "ning" : ""} ${academicYearTitle} o'quv yili uchun shaxsiy ish rejasi`.trim(),
    y,
    { fs: 11, bold: true, gapAfter: 6 },
  );

  for (const sentence of INTRO_SENTENCES) {
    y = drawLeftText(doc, sentence, y, { fs: 7, align: "justify", gapAfter: 2 });
  }

  y = drawSectionHeading(
    doc,
    `I. O'quv ishlari ${academicYearTitle} o'quv yili`.replace(/\s+/g, " "),
    y,
  );
  const teachingRows = buildTeachingRows(plan);
  const rowsWithTotal = teachingRows.length
    ? [...teachingRows, buildTeachingTotalRow(plan, teachingRows)]
    : [buildTeachingTotalRow(plan, teachingRows)];
  y = drawTable(doc, COLS_TEACHING, rowsWithTotal, y, {
    boldLastRow: true,
    headerFs: TEACHING_HEADER_FS,
  });
  const footnote = teachingFootnote(plan);
  if (footnote) y = drawLeftText(doc, footnote, y + 2, { fs: 6.5 });

  const stavkaValues = [
    ...new Set(
      (plan.teachingLoad?.sciences || [])
        .map((s) => s.stavka)
        .filter((v) => v || v === 0),
    ),
  ];
  if (stavkaValues.length) {
    y = drawLeftText(doc, `Stavka: ${stavkaValues.join(" / ")}`, y + 2, {
      fs: 7,
      bold: true,
    });
  }

  for (const key of SECTION_KEYS) {
    y = drawSectionHeading(doc, SECTION_TITLES[key], y);
    const items = plan[key] || [];
    const rows = items.length ? buildWorkRows(items) : [EMPTY_WORK_ROW];
    y = drawTable(doc, COLS_WORK, rows, y);
  }

  const signatureRows = buildSignatureRows(plan, reports);
  const kafedraCount = KAFEDRA_SIGNATORIES.length;
  y = drawSignatureTable(doc, signatureRows.slice(0, kafedraCount), y);
  y = drawCenteredText(doc, MID_TEXT, y + 4, { fs: 7, gapAfter: 2 });
  y = drawSignatureTable(doc, signatureRows.slice(kafedraCount), y);
  y = drawVerifyQr(doc, verifyQr, y);

  for (const line of buildKotibLines(reports)) {
    y = drawLeftText(doc, line, y + 3, { fs: 7 });
  }

  drawFooterLandscape(doc, "Shaxsiy ish reja", plan.status);
  doc.flushPages();
  return doc;
}

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

async function generatePersonalWorkPlanPdf(req, res, next) {
  try {
    const scope = andFilters(
      req.scope,
      buildGroupedVisibilityFilter(req.user?.role?.title),
    );
    const doc = await buildPersonalWorkPlanPdf(req.params.id, scope);
    pipeToResponse(res, doc, `shaxsiy-ish-reja-${req.params.id}`);
    doc.end();
  } catch (err) {
    return next(wrapErr(err, "Shaxsiy ish reja PDF yaratishda xatolik"));
  }
}

module.exports = {
  generatePersonalWorkPlanPdf,
  buildPersonalWorkPlanPdf,
  COLS_TEACHING,
  COLS_WORK,
  SIGNATORIES,
  SECTION_TITLES,
  INTRO_SENTENCES,
  MID_TEXT,
  SIGN_W,
  ERI_TEXT,
  buildTeachingRows,
  buildTeachingTotalRow,
  teachingFootnote,
  buildWorkRows,
  buildSignatureRows,
  buildKotibLines,
  pickReports,
  shortName,
  san,
};
