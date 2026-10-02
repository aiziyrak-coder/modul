"use strict";

const multer = require("multer");
const { ErrorHandler } = require("#shared/error");

const MB = 1024 * 1024;
const MAX_SIZE = Number(process.env.GIFTED_IMPORT_MAX_MB || 5) * MB;

const FIELD = "file";

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);

const runMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
}).single(FIELD);

const mb = (bytes) => Math.round(bytes / MB);

const receiveRoster = (req, res, next) => {
  runMulter(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          new ErrorHandler(
            400,
            `Fayl hajmi ${mb(MAX_SIZE)} MB dan oshmasligi kerak`,
            "ROSTER_TOO_LARGE",
          ),
        );
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(
          new ErrorHandler(
            400,
            `Fayl "${FIELD}" maydonida yuborilishi kerak (kelgani: ${err.field})`,
            "ROSTER_FIELD_UNEXPECTED",
          ),
        );
      }
    }
    return next(
      new ErrorHandler(400, err.message || "Fayl yuklashda xatolik", "ROSTER_UPLOAD_FAILED"),
    );
  });
};

const inspectRoster = (req, res, next) => {
  const file = req.file;
  if (!file || !file.buffer?.length) {
    return next(
      new ErrorHandler(400, "Fayl tanlanmadi (bo'sh so'rov)", "ROSTER_FILE_REQUIRED"),
    );
  }

  const head = file.buffer.subarray(0, 4);

  if (head.equals(OLE2_MAGIC)) {
    return next(
      new ErrorHandler(
        400,
        "Eski `.xls` formati qabul qilinmaydi — faylni Excel'da \"Save As → .xlsx\" bilan qayta saqlang",
        "ROSTER_TYPE_LEGACY_XLS",
      ),
    );
  }

  if (!head.equals(ZIP_MAGIC)) {
    return next(
      new ErrorHandler(
        400,
        "Fayl `.xlsx` emas (mazmuni bo'yicha tekshirildi) — shablonni yuklab olib, uni to'ldiring",
        "ROSTER_TYPE_NOT_ALLOWED",
      ),
    );
  }

  return next();
};

module.exports = { FIELD, MAX_SIZE, receiveRoster, inspectRoster };
