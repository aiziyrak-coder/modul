"use strict";

const { ErrorHandler } = require("#shared/error");
const { resolvePublicBaseUrl } = require("#shared/publicBaseUrl");

const QualEarnedCertificate = require("#modules/4.04-qualification/_shared/qualEarnedCertificate.model");
require("#modules/4.04-qualification/qualCourse/qualCourse.model");
require("#modules/4.04-qualification/_shared/qualListener.model");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const { createDoc, pipeToResponse } = require("#shared/pdfGenerators/pdfHelpers");
const { certVerifyUrl } = require("./sertifikat.pdf");
const {
  nextReferenceNumber,
} = require("#modules/4.04-qualification/_shared/qualCertificateNumber");
const institute = require("./institute");
const { ROLES } = require("#config/constants");
const { resolveSignatoryName } = require("./signatory");

const PAGE = { width: 612, height: 792 };
const MARGIN = { top: 56.7, right: 42.5, bottom: 56.7, left: 85.05 };
const CW = PAGE.width - MARGIN.left - MARGIN.right;
const INDENT = 36;
const {
  REFERENCE_PREFIX,
} = require("#modules/4.04-qualification/_shared/certificateCode");
const FS = 14;
const INK = "#000000";

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return `“${dt.getDate()}” ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}-yil`;
}

const COURSE_BLANK = "_".repeat(30);
const DATE_BLANK = `“${"_".repeat(5)}” ${"_".repeat(10)} 20_ yil`;

async function drawMalumotnoma(doc, d) {
  const left = MARGIN.left;
  doc.fillColor(INK);
  doc.y = MARGIN.top;

  doc.font("Helvetica-Bold").fontSize(FS).text("MA’LUMOTNOMA", left, MARGIN.top, {
    width: CW,
    align: "center",
  });
  doc.font("Helvetica").fontSize(FS);
  doc.moveDown(1.4);

  const namePrefix = "Ushbu ma’lumotnoma tinglovchi";
  const course = d.course || COURSE_BLANK;
  const from = d.from || DATE_BLANK;
  const to = d.to || DATE_BLANK;
  const bodyText =
    `Farg‘ona jamoat salomatligi tibbiyot instituti Malaka oshirish va qayta ` +
    `tayyorlash fakultetida ${course} kursi bo‘yicha ${from} dan ${to} gacha ` +
    `bo‘lgan muddatda tinglovchi sifatida tahsil oldi. Tinglovchi o‘quv ` +
    `mashg‘ulotlarida ishtirok etdi, biroq yakuniy attestatsiya natijalariga ` +
    `ko‘ra kursni muvaffaqiyatli tamomlay olmadi.`;

  doc.font("Helvetica").fontSize(FS);
  if (d.name) {
    doc.text(`${namePrefix} ${d.name}ga ${bodyText}`, left, doc.y, {
      width: CW,
      indent: INDENT,
      align: "justify",
      lineGap: 8,
    });
  } else {
    const prefixW = doc.widthOfString(namePrefix);
    const gaW = doc.widthOfString("ga");
    const uW = doc.widthOfString("_");
    const nUnder = Math.max(12, Math.floor((CW - INDENT - prefixW - gaW - 2) / uW));
    doc.text(`${namePrefix}${"_".repeat(nUnder)}ga`, left, doc.y, {
      width: CW,
      indent: INDENT,
      align: "left",
    });
    const blankStart = left + INDENT + prefixW;
    const blankW = nUnder * uW;
    const capY = doc.y - 1;
    doc.font("Helvetica").fontSize(9);
    const cap = "(F.I.Sh.)";
    const capW = doc.widthOfString(cap);
    const capMid = blankStart + blankW / 2;
    doc.text(cap, capMid - capW / 2, capY, { lineBreak: false });
    doc.y = capY + 13;
    doc.font("Helvetica").fontSize(FS);
    doc.text(bodyText, left, doc.y, { width: CW, align: "justify", lineGap: 8 });
  }

  doc.font("Helvetica").fontSize(FS).text(
    "Mazkur ma’lumotnoma talab qilingan joyga taqdim etish uchun berildi.",
    left,
    doc.y,
    { width: CW, indent: INDENT, align: "justify", lineGap: 8 },
  );

  const issued = d.issued || DATE_BLANK;
  doc.font("Helvetica").fontSize(FS).text(`Sana: ${issued}`, left, doc.y, {
    width: CW,
    align: "justify",
    lineGap: 8,
  });

  doc.moveDown(2.6);

  const sigY = doc.y;
  const dekanX = left + 330;
  doc.font("Helvetica-Bold").fontSize(FS);
  doc.text("Fakulteti dekani:", left + 72, sigY, { lineBreak: false });
  if (d.dekan) {
    doc.text(d.dekan, dekanX, sigY, { lineBreak: false });
  } else {
    doc.font("Helvetica").fontSize(FS);
    const uW = doc.widthOfString("_");
    const n = Math.max(10, Math.floor((left + CW - dekanX) / uW));
    doc.text("_".repeat(n), dekanX, sigY, { lineBreak: false });
  }

  if (d.code) {
    const qrBuf = await QRCode.toBuffer(certVerifyUrl(d.code, d.reqBase), {
      margin: 1,
      width: 400,
    });

    const qrSize = 72;
    const qrX = left + CW - qrSize;
    const qrY = sigY + 86;

    doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });
  }

  doc.flushPages();
  return doc;
}

function newDoc() {
  return createDoc({
    size: "LETTER",
    margins: { top: MARGIN.top, bottom: MARGIN.bottom, left: MARGIN.left, right: MARGIN.right },
  });
}

async function buildMalumotnomaPdf(id, reqBase) {
  const cert = await QualEarnedCertificate.findById(id)
    .populate({ path: "course", select: "title startDate endDate" })
    .populate({ path: "listener", model: "QualListener", select: "fullName" })
    .lean();
  if (!cert) throw new Error("Ma'lumotnoma yozuvi topilmadi");

  let number = cert.number;
  if (!number) {
    number = await nextReferenceNumber();
    await QualEarnedCertificate.updateOne({ _id: cert._id }, { $set: { number } });
  }

  const course = cert.course || {};
  const dekan = await resolveSignatoryName(ROLES.DEKAN, institute.DEKAN);
  const doc = newDoc();
  return drawMalumotnoma(doc, {
    name: (cert.listener && cert.listener.fullName) || null,
    course: course.title || null,
    from: fmtDate(course.startDate),
    to: fmtDate(course.endDate),
    issued: fmtDate(cert.createdAt),
    dekan,
    code: `${REFERENCE_PREFIX}${number}`,
    reqBase,
  });
}

function buildMalumotnomaBlank() {
  return drawMalumotnoma(newDoc(), {
    name: null, course: null, from: null, to: null, issued: null, dekan: null,
  });
}

async function saveMalumotnomaPdf(certId, reqBase) {
  const doc = await buildMalumotnomaPdf(certId, reqBase);
  const cert = await QualEarnedCertificate.findById(certId).select("number").lean();
  const code = `${REFERENCE_PREFIX}${(cert && cert.number) || "00001"}`;

  const dir = path.join(__dirname, "../../../../uploads/pdfs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${code}.pdf`;

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(path.join(dir, filename));
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);
    doc.end();
  });

  const origin = certVerifyUrl("", reqBase).replace(/\/verify\/$/, "");
  const fileUrl = `${origin}/files/pdfs/${filename}`;
  await QualEarnedCertificate.updateOne({ _id: certId }, { $set: { file: fileUrl } });
  return fileUrl;
}

async function generateMalumotnomaPdf(req, res, next) {
  try {
    const reqBase = resolvePublicBaseUrl(req);
    const doc = await buildMalumotnomaPdf(req.params.id, reqBase);
    pipeToResponse(res, doc, `malumotnoma-${req.params.id}`);
    doc.end();
  } catch (err) {
    return next(new ErrorHandler(400, "Ma'lumotnoma PDF xatolik", err.message));
  }
}

module.exports = {
  buildMalumotnomaPdf,
  buildMalumotnomaBlank,
  saveMalumotnomaPdf,
  generateMalumotnomaPdf,
  REFERENCE_PREFIX,
};
