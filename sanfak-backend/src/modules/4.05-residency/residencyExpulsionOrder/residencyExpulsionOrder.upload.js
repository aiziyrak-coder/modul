"use strict";

const multer = require("multer");
const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");

const MB = 1024 * 1024;
const MAX_MB = Math.min(Number(process.env.RESIDENCY_EXPULSION_SCAN_MAX_MB) || 10, 25);
const MAX_SIZE = MAX_MB * MB;
const FIELD = "file";

const fail = (message, code) => new ErrorHandler(400, message, code, { reason: code });

const isOfficeSigner = (user) => user?.role?.title === ROLES.MAGISTRATURA_BOLIM;

const notOfficeSigner = () =>
  new ErrorHandler(403, "Faqat bo'lim xodimi (magistratura_bolim) bajaradi", "not_office_signer", {
    reason: "not_office_signer",
  });

const officeOnly = (req, res, next) => (isOfficeSigner(req.user) ? next() : next(notOfficeSigner()));

const runMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1, fields: 0 },
}).single(FIELD);

const MULTER_ERRORS = {
  LIMIT_FILE_SIZE: () => fail(`Skan hajmi ${MAX_MB} MB dan oshmasligi kerak`, "SCAN_TOO_LARGE"),
  LIMIT_UNEXPECTED_FILE: (err) =>
    fail(`Skan "${FIELD}" maydonida yuborilishi kerak (kelgani: ${err.field})`, "SCAN_FIELD_UNEXPECTED"),
  LIMIT_FILE_COUNT: () => fail("Faqat bitta fayl yuboriladi", "SCAN_FIELD_UNEXPECTED"),
  LIMIT_FIELD_COUNT: () => fail("Tanada faqat skan fayli bo'ladi", "SCAN_FIELD_UNEXPECTED"),
};

const receiveScan = (req, res, next) => {
  runMulter(req, res, (err) => {
    if (!err) {
      if (!req.file?.buffer?.length) return next(fail("Skan fayli tanlanmadi", "SCAN_FILE_REQUIRED"));
      return next();
    }
    const known = err instanceof multer.MulterError && MULTER_ERRORS[err.code];
    return next(known ? known(err) : fail(err.message || "Skanni yuklashda xatolik", "SCAN_UPLOAD_FAILED"));
  });
};

function displayName(originalname, ext) {
  const decoded = Buffer.from(String(originalname || ""), "latin1").toString("utf8");
  const clean = decoded
    .replace(/[\u0000-\u001f\u007f/\\\u202a-\u202e\u2066-\u2069]/g, "")
    .trim()
    .replace(/\.[A-Za-z][A-Za-z0-9]{0,4}$/, "")
    .slice(0, 200)
    .trim();
  return `${clean || "buyruq-skan"}.${ext}`;
}

module.exports = {
  officeOnly,
  receiveScan,
  isOfficeSigner,
  notOfficeSigner,
  displayName,
  MAX_SIZE,
};
