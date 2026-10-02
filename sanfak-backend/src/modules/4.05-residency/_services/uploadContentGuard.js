"use strict";

const { ErrorHandler } = require("#shared/error");
const {
  extensionOf,
  verifyContent,
} = require("#modules/4.05-residency/_services/attachmentTypes");

const HEADER_BYTES = 4096;

const MESSAGES = {
  ATTACHMENT_TYPE_MISMATCH: (name) =>
    `"${name}" — fayl mazmuni kengaytmasiga mos kelmaydi (fayl buzilgan yoki nomi almashtirilgan)`,
};

const collect = (files) => {
  if (!files) return [];
  if (Array.isArray(files)) return files;
  return Object.values(files).flat().filter(Boolean);
};

function uploadContentGuardMw(req, res, next) {
  const uploaded = collect(req.files);
  if (!uploaded.length) return next();

  for (const file of uploaded) {
    if (!Buffer.isBuffer(file.buffer)) {
      return next(
        new ErrorHandler(
          500,
          "Fayl mazmunini tekshirib bo'lmadi",
          "ATTACHMENT_INSPECT_FAILED",
        ),
      );
    }

    const verdict = verifyContent(
      extensionOf(file.originalname),
      file.buffer.subarray(0, HEADER_BYTES),
    );

    if (!verdict.ok) {
      return next(
        new ErrorHandler(
          400,
          MESSAGES[verdict.code](file.originalname || "fayl"),
          verdict.code,
          { reason: verdict.detail },
        ),
      );
    }
  }

  return next();
}

const guardUploadContent = () => uploadContentGuardMw;

module.exports = { guardUploadContent, uploadContentGuardMw, HEADER_BYTES };
