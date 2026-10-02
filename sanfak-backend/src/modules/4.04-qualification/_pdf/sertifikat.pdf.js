"use strict";

const { ErrorHandler } = require("#shared/error");
const { resolvePublicBaseUrl } = require("#shared/publicBaseUrl");

const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");
const QualEarnedCertificate = require("#modules/4.04-qualification/_shared/qualEarnedCertificate.model");
require("#modules/4.04-qualification/qualCourse/qualCourse.model");
require("#modules/4.04-qualification/qualCourseType/qualCourseType.model");
require("#modules/4.04-qualification/_shared/qualListener.model");
const { createDoc, pipeToResponse } = require("#shared/pdfGenerators/pdfHelpers");

const ASSETS = path.join(__dirname, "assets");
const INK = "#000000";

const TEMPLATES = {
  1: { file: "cert-tmpl-1.png", w: 2382, h: 1684, layout: "duo" },
  2: { file: "cert-tmpl-2.png", w: 1683, h: 1190, layout: "wide" },
  3: { file: "cert-tmpl-3.png", w: 1683, h: 1190, layout: "wide" },
};

const { SERIES } = require("#modules/4.04-qualification/_shared/certificateCode");

const QR_POS = {
  wide: [{ x: 1361, y: 855, size: 129 }],
  duo: [
    { x: 830, y: 1329, size: 200 },
    { x: 2020, y: 1327, size: 200 },
  ],
};

function certVerifyUrl(code, reqBase) {
  const base =
    process.env.PUBLIC_BASE_URL ||
    reqBase ||
    `http://localhost:${process.env.PORT || 4000}`;
  return `${base}/verify/${code}`;
}

function fmtDot(d) {
  if (!d) return "";
  const dt = new Date(d);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}.${mm}.${dd}`;
}

function drawWide(put, d) {
  put(d.number, 731, 330, 17, true, 232);
  put(d.diplom, 242, 426, 17, false, 178);
  put(d.fullName, 177, 494, 17, true, 1330);
  put(d.from, 455, 564, 17, false, 280);
  put(d.to, 851, 564, 17, false, 284);
  put(d.credits, 177, 635, 17, false, 82);
  put(d.direction, 490, 636, 17, false, 1070);
  put(d.issued, 253, 1039, 17, false, 155);
  put(d.reg, 1384, 1047, 10, false, 92);
}

function drawDuo(put, d, putWrap) {
  put(d.number, 541, 482, 15, false, 244);
  put(d.diplom, 878, 563, 14, false, 181);
  put(d.fullName, 150, 715, 14, false, 909);
  put(d.from, 150, 871, 12, false, 346);
  put(d.to, 578, 871, 12, false, 376);
  put(d.credits, 150, 947, 12, false, 128);
  putWrap(d.direction, [
    { x: 508, y: 945, w: 551 },
    { x: 150, y: 1021, w: 882 },
  ], 13);
  put(d.reg, 322, 1431, 11, false, 190);
  put(d.issued, 473, 1484, 9, false, 190);

  put(d.number, 1733, 483, 15, false, 243);
  put(d.diplom, 1975, 715, 14, false, 180);
  put(d.fullName, 1343, 791, 14, false, 898);
  put(d.from, 1473, 871, 12, false, 347);
  put(d.to, 1895, 871, 12, false, 346);
  put(d.credits, 1903, 947, 12, false, 154);
  putWrap(d.direction, [
    { x: 1765, y: 1096, w: 443 },
    { x: 1343, y: 1172, w: 865 },
  ], 13);
  put(d.reg, 1763, 1416, 11, false, 203);
  put(d.issued, 1648, 1497, 9, false, 189);
}

async function buildSertifikatPdf(id, reqBase) {
  const cert = await QualEarnedCertificate.findById(id)
    .populate({
      path: "course",
      select: "title creditHours startDate endDate courseType",
      populate: { path: "courseType", select: "template" },
    })
    .populate({ path: "listener", model: "QualListener", select: "fullName" })
    .lean();

  if (!cert) throw new Error("Sertifikat yozuvi topilmadi");

  const course = cert.course || {};
  const tmplNum =
    cert.template || (course.courseType && course.courseType.template) || 1;
  const T = TEMPLATES[tmplNum] || TEMPLATES[1];

  const number = cert.number || "00001";
  const code = `${SERIES[tmplNum] || "I"}${number}`;

  const d = {
    fullName: (cert.listener && cert.listener.fullName) || "",
    from: fmtDot(course.startDate),
    to: fmtDot(course.endDate),
    credits: course.creditHours != null ? String(course.creditHours) : "",
    direction: course.title || "",
    number,
    issued: fmtDot(cert.createdAt),
    diplom: number,
    reg: cert.regNumber || "",
  };

  const doc = createDoc({
    layout: "landscape",
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  const W = doc.page.width;
  const H = doc.page.height;
  const SX = W / T.w;
  const SY = H / T.h;

  doc.image(path.join(ASSETS, T.file), 0, 0, { width: W, height: H });

  doc.registerFont("CertMono", path.join(ASSETS, "lucon.ttf"));
  const SIZE_SCALE = 1.12;
  const ASC = 0.73;
  const LIFT = 8;
  const put = (text, ix, iy, size = 12, bold = false, maxImgW = null, prop = false) => {
    if (text == null || text === "") return;
    let fs = size * SIZE_SCALE;
    const family = prop ? (bold ? "Helvetica-Bold" : "Helvetica") : "CertMono";
    doc.font(family).fontSize(fs).fillColor(INK);
    if (maxImgW) {
      const maxPt = maxImgW * SX;
      while (fs > 5 && doc.widthOfString(String(text)) > maxPt) {
        fs -= 0.5;
        doc.fontSize(fs);
      }
    }
    const topPt = iy * SY + ASC * (size - fs) - LIFT * SY;
    const textW = doc.widthOfString(String(text));
    const drawX = maxImgW ? ix * SX + (maxImgW * SX - textW) / 2 : ix * SX;
    doc.text(String(text), drawX, topPt, { lineBreak: false });
  };

  const putWrap = (text, slots, size) => {
    if (text == null || text === "") return;
    const str = String(text);
    doc.font("CertMono").fontSize(size * SIZE_SCALE);
    if (doc.widthOfString(str) <= slots[0].w * SX) {
      put(str, slots[0].x, slots[0].y, size, false, slots[0].w);
      return;
    }
    const words = str.split(/\s+/);
    let head = words[0];
    let tail = words.slice(1).join(" ");
    for (let i = words.length - 1; i >= 1; i -= 1) {
      const cand = words.slice(0, i).join(" ");
      if (doc.widthOfString(cand) <= slots[0].w * SX) {
        head = cand;
        tail = words.slice(i).join(" ");
        break;
      }
    }
    put(head, slots[0].x, slots[0].y, size, false, slots[0].w);
    put(tail, slots[1].x, slots[1].y, size, false, slots[1].w);
  };

  if (T.layout === "wide") drawWide(put, d);
  else drawDuo(put, d, putWrap);

  const qrBuf = await QRCode.toBuffer(certVerifyUrl(code, reqBase), { margin: 1, width: 400 });
  for (const p of QR_POS[T.layout] || []) {
    const qx = p.x * SX;
    const qy = p.y * SY;
    const qs = p.size * SX;
    const cv = p.cover || { x: p.x - 2, y: p.y - 2, w: p.size + 4, h: p.size + 4 };
    doc.save();
    doc.rect(cv.x * SX, cv.y * SY, cv.w * SX, cv.h * SY).fill("#ffffff");
    doc.image(qrBuf, qx, qy, { width: qs, height: qs });
    doc.restore();
  }

  return doc;
}

async function saveSertifikatPdf(certId, reqBase) {
  const cert = await QualEarnedCertificate.findById(certId)
    .select("number template")
    .lean();
  if (!cert) throw new Error("Sertifikat yozuvi topilmadi");
  const code = `${SERIES[cert.template || 1] || "I"}${cert.number || "00001"}`;
  const dir = path.join(__dirname, "../../../../uploads/pdfs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${code}.pdf`;
  const origin = certVerifyUrl("", reqBase).replace(/\/verify\/$/, "");
  const fileUrl = `${origin}/files/pdfs/${filename}`;
  const doc = await buildSertifikatPdf(certId, reqBase);
  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(path.join(dir, filename));
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);
    doc.end();
  });
  await QualEarnedCertificate.updateOne(
    { _id: certId },
    { $set: { file: fileUrl } },
  );
  return fileUrl;
}

async function generateSertifikatPdf(req, res, next) {
  try {
    const cert = await QualEarnedCertificate.findById(req.params.id)
      .select("number template")
      .lean();
    const code = `${SERIES[(cert && cert.template) || 1] || "I"}${(cert && cert.number) || "00001"}`;
    const reqBase = resolvePublicBaseUrl(req);
    const doc = await buildSertifikatPdf(req.params.id, reqBase);
    pipeToResponse(res, doc, code);
    doc.end();
  } catch (err) {
    return next(new ErrorHandler(400, "Sertifikat PDF xatolik", err.message));
  }
}

module.exports = {
  buildSertifikatPdf,
  generateSertifikatPdf,
  saveSertifikatPdf,
  certVerifyUrl,
};
