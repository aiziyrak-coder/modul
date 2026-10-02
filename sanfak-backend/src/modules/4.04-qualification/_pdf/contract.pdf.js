"use strict";

const { ErrorHandler } = require("#shared/error");

const QualContract = require("#modules/4.04-qualification/qualContract/qualContract.model");
require("#modules/4.04-qualification/qualCourse/qualCourse.model");
require("#modules/4.04-qualification/qualCourseType/qualCourseType.model");
require("#modules/4.04-qualification/_shared/qualListener.model");
require("#modules/4.04-qualification/qualPetition/qualPetition.model");
require("#references/province/province.model");
require("#references/region/region.model");
const {
  createDoc,
  pipeToResponse,
  ensureSpace,
  PAGE,
  CONTENT_WIDTH,
} = require("#shared/pdfGenerators/pdfHelpers");
const institute = require("./institute");
const { preamble, section1, section2, sections } = require("./contract.text");
const { ROLES } = require("#config/constants");
const { resolveSignatoryName } = require("./signatory");

const INK = "#000000";
const BODY = 11;

const MOCK = {
  prov: "Farg'ona viloyati",
  reg: "Farg'ona shahri",
  passport: "AA 1234567",
  validUntil: "01.01.2035",
  issuedBy: "Farg'ona shahar IIB",
  mfy: "Yangiobod MFY",
  street: "Mustaqillik ko'chasi, 12-uy",
};

const ONES = ["", "bir", "ikki", "uch", "to'rt", "besh", "olti", "yetti", "sakkiz", "to'qqiz"];
const TENS = ["", "o'n", "yigirma", "o'ttiz", "qirq", "ellik", "oltmish", "yetmish", "sakson", "to'qson"];
const SCALE = ["", "ming", "million", "milliard", "trillion"];

function threeToWords(n) {
  const p = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  if (h) p.push(ONES[h], "yuz");
  if (t) p.push(TENS[t]);
  if (o) p.push(ONES[o]);
  return p.join(" ");
}

function sumToWords(num) {
  let n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return "nol";
  const groups = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    parts.push((threeToWords(groups[i]) + (SCALE[i] ? " " + SCALE[i] : "")).trim());
  }
  return parts.join(" ");
}

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function fmtDateWords(d) {
  const dt = d ? new Date(d) : new Date();
  return `"${dt.getDate()}" ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}-yil`;
}

function fmtDateNumeric(d) {
  const dt = d ? new Date(d) : new Date();
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${dt.getFullYear()}`;
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

function para(doc, text) {
  if (!text) return;
  ensureSpace(doc, 28);
  doc
    .font("Helvetica")
    .fontSize(BODY)
    .fillColor(INK)
    .text(String(text), PAGE.margin, doc.y, {
      width: CONTENT_WIDTH,
      align: "justify",
      lineGap: 2,
    });
  doc.moveDown(0.45);
}

function bullet(doc, text) {
  if (!text) return;
  ensureSpace(doc, 24);
  const indent = 16;
  const y = doc.y;
  doc.font("Helvetica").fontSize(BODY).fillColor(INK).text("•", PAGE.margin + 3, y, { width: 10 });
  doc
    .font("Helvetica")
    .fontSize(BODY)
    .fillColor(INK)
    .text(String(text), PAGE.margin + indent, y, {
      width: CONTENT_WIDTH - indent,
      align: "justify",
      lineGap: 2,
    });
  doc.moveDown(0.35);
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 42);
  doc.moveDown(0.25);
  doc
    .font("Helvetica-Bold")
    .fontSize(BODY + 0.5)
    .fillColor(INK)
    .text(title, PAGE.margin, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.35);
}

function renderPara(doc, p) {
  if (typeof p === "string" && p.startsWith("- ")) bullet(doc, p.slice(2));
  else para(doc, p);
}

function drawGridTable(doc, columns, rows) {
  const totalDef = columns.reduce((s, c) => s + (c.width || 1), 0);
  const colW = columns.map((c) => ((c.width || 1) / totalDef) * CONTENT_WIDTH);
  const colX = [];
  let cx = PAGE.margin;
  for (const w of colW) {
    colX.push(cx);
    cx += w;
  }
  const PAD = 5;
  const SIZE = 10.5;
  const all = [{ cells: columns.map((c) => c.header), header: true }, ...rows];

  let y = doc.y;
  for (const row of all) {
    const font = row.header ? "Helvetica-Bold" : "Helvetica";
    doc.font(font).fontSize(SIZE);
    let rowH = 0;
    row.cells.forEach((cell, i) => {
      const h = doc.heightOfString(String(cell ?? ""), { width: colW[i] - PAD * 2, lineGap: 1 });
      if (h > rowH) rowH = h;
    });
    rowH += PAD * 2;
    if (y + rowH > PAGE.height - PAGE.margin - 20) {
      doc.addPage();
      y = PAGE.margin;
    }
    row.cells.forEach((cell, i) => {
      doc.rect(colX[i], y, colW[i], rowH).strokeColor(INK).lineWidth(0.7).stroke();
      const s = String(cell ?? "");
      doc.font(font).fontSize(SIZE).fillColor(INK);
      const h = doc.heightOfString(s, { width: colW[i] - PAD * 2, lineGap: 1 });
      doc.text(s, colX[i] + PAD, y + (rowH - h) / 2, {
        width: colW[i] - PAD * 2,
        align: columns[i].align || "center",
        lineGap: 1,
      });
    });
    y += rowH;
  }
  doc.y = y;
  doc.moveDown(0.6);
}

const PRICE_COLUMNS = [
  { header: "T/r", width: 0.55, align: "center" },
  { header: "Mutaxassislik nomi", width: 2.6, align: "center" },
  { header: "soat", width: 0.7, align: "center" },
  { header: "O'qitish muddati", width: 1.4, align: "center" },
  { header: "Bir tinglovchi uchun to'lanadigan mablag' (so'm)", width: 2.6, align: "center" },
];

function drawRequisites(doc, c, fullName, rektorName) {
  ensureSpace(doc, 250);
  doc.moveDown(0.8);
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(INK)
    .text("TOMONLARNING REKVIZITLARI:", PAGE.margin, doc.y, { width: CONTENT_WIDTH, align: "center" });
  doc.moveDown(0.6);

  const colW = CONTENT_WIDTH / 2;
  const leftX = PAGE.margin;
  const rightX = PAGE.margin + colW + 8;
  const inner = colW - 12;
  const headY = doc.y;

  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Ijrochi", leftX, headY, { width: inner });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Buyurtmachi", rightX, headY, { width: inner });

  let ly = headY + 17;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK)
    .text(institute.INSTITUTE_FULL, leftX, ly, { width: inner, lineGap: 1 });
  ly = doc.y + 2;
  const ijLines = [
    `Manzil: ${institute.ADDRESS}`,
    `Tel/Fax: ${institute.PHONE_FAX}`,
    `Shxr: ${institute.SHXR}`,
    `STIR: ${institute.STIR}   OKNX: ${institute.OKNX}`,
    institute.TREASURY,
    `X/r: ${institute.XR}`,
    institute.BANK,
    `MFO: ${institute.MFO}   INN: ${institute.INN}`,
  ];
  doc.font("Helvetica").fontSize(10).fillColor(INK)
    .text(ijLines.join("\n"), leftX, ly, { width: inner, lineGap: 2 });
  ly = doc.y + 10;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK)
    .text(`Rektor  ______________  ${rektorName}`, leftX, ly, { width: inner });
  const leftEndY = doc.y;

  const pet = c.petition || {};
  const prov = pet.province && pet.province.title ? pet.province.title : MOCK.prov;
  const reg = pet.region && pet.region.title ? pet.region.title : MOCK.reg;
  const passportFull = [pet.passportSeries, pet.passportNumber].filter(Boolean).join(" ") || MOCK.passport;
  const mfyPart = pet.mfy ? `${pet.mfy} MFY` : MOCK.mfy;
  const streetPart = pet.street || MOCK.street;
  const buyLines = [
    `F.I.Sh: ${fullName}`,
    `Pasport seriyasi va raqami: ${passportFull}`,
    `Amal qilish muddati: ${pet.passportValidUntil || MOCK.validUntil}`,
    `Kim tomonidan berilgani: ${pet.passportIssuedBy || MOCK.issuedBy}`,
    `Manzili: ${prov}, ${reg},`,
    `${mfyPart}, ${streetPart}`,
  ];
  const ry = headY + 17;
  doc.font("Helvetica").fontSize(10).fillColor(INK)
    .text(buyLines.join("\n"), rightX, ry, { width: inner, lineGap: 4 });
  let ry2 = doc.y + 10;
  doc.font("Helvetica").fontSize(10).fillColor(INK)
    .text("Buyurtmachi imzosi: _______________", rightX, ry2, { width: inner });
  ry2 = doc.y + 6;
  doc.font("Helvetica").fontSize(10).fillColor(INK)
    .text(`Sana: ${fmtDateNumeric(c.createdAt)}`, rightX, ry2, { width: inner });
  const rightEndY = doc.y;

  doc.y = Math.max(leftEndY, rightEndY);
}

async function buildContractPdf(id) {
  const c = await QualContract.findById(id)
    .populate({
      path: "course",
      select: "title creditHours price startDate endDate form courseType",
      populate: { path: "courseType", select: "title" },
    })
    .populate({ path: "listener", model: "QualListener", select: "fullName passport" })
    .populate({
      path: "petition",
      select:
        "province region phone institution passport passportSeries passportNumber passportValidUntil passportIssuedBy mfy street",
      populate: [
        { path: "province", select: "title" },
        { path: "region", select: "title" },
      ],
    })
    .lean();

  if (!c) throw new Error("Shartnoma topilmadi");

  const course = c.course || {};
  const fullName = (c.listener && c.listener.fullName) || "____________________";
  const price = c.totalPrice || course.price || 0;
  const priceFmt = price.toLocaleString("ru-RU");
  const days = daysBetween(course.startDate, course.endDate);
  const number = c.number || "____";
  const rektorName = await resolveSignatoryName(ROLES.REKTOR, institute.REKTOR);

  const doc = createDoc();

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(INK)
    .text(`MALAKA OSHIRISH TO'G'RISIDA SHARTNOMA № ${number}`, { align: "center" });
  doc.moveDown(0.7);

  const dl = doc.y;
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(INK)
    .text(`${institute.CITY} sh.`, PAGE.margin, dl, { width: CONTENT_WIDTH / 2, align: "left" });
  doc.text(fmtDateWords(c.createdAt), PAGE.margin + CONTENT_WIDTH / 2, dl, {
    width: CONTENT_WIDTH / 2,
    align: "right",
  });
  doc.moveDown(1);

  para(doc, preamble(rektorName, fullName));

  sectionTitle(doc, section1.title);
  for (const p of section1.paras) renderPara(doc, p);

  sectionTitle(doc, section2.title);
  para(doc, section2.intro);
  drawGridTable(doc, PRICE_COLUMNS, [
    {
      cells: [
        "1",
        course.title || "—",
        course.creditHours != null ? String(course.creditHours) : "—",
        days != null ? `${days} kun` : "—",
        `${priceFmt}\n(${sumToWords(price)})`,
      ],
    },
    { cells: ["", "Jami:", "", "", priceFmt] },
  ]);
  for (const p of section2.after) renderPara(doc, p);

  for (const s of sections) {
    sectionTitle(doc, s.title);
    for (const p of s.paras) renderPara(doc, p);
  }

  drawRequisites(doc, c, fullName, rektorName);

  doc.flushPages();
  return doc;
}

async function generateContractPdf(req, res, next) {
  try {
    const doc = await buildContractPdf(req.params.id);
    pipeToResponse(res, doc, `shartnoma-${req.params.id}`);
    doc.end();
  } catch (err) {
    return next(new ErrorHandler(400, "Shartnoma PDF xatolik", err.message));
  }
}

module.exports = { buildContractPdf, generateContractPdf, sumToWords };
