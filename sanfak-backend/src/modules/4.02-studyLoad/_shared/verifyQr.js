"use strict";

const QRCode = require("qrcode");
const winston = require("#shared/winston.logger");
const { resolvePublicBaseUrl } = require("#shared/publicBaseUrl");

const QR_SIZE_SLOT = 44;
const QR_SIZE_ROW = 40;
const QR_ERROR_CORRECTION = "M";
const QR_PNG_SCALE = 8;
const QR_MAX_URL_BYTES = 84;

function buildVerifyUrl(token) {
  const base = resolvePublicBaseUrl();
  if (base) return `${base}/verify/doc/${token}`;
  if (process.env.NODE_ENV === "production") return null;
  return `http://localhost:${process.env.PORT || 4000}/verify/doc/${token}`;
}

async function prepareVerifyQr(docLike, meta = {}) {
  const { docType = "?", allowInReview = false } = meta;
  const status = docLike?.status;
  const token = docLike?.verify?.token;
  const revokedAt = docLike?.verify?.revokedAt;
  const docId = docLike?._id;

  const statusOk =
    status === "approved" || (allowInReview === true && status === "in_review");
  if (!statusOk || !token || revokedAt) return null;

  const url = buildVerifyUrl(token);
  if (!url) {
    winston.error(
      `[verifyQr] PUBLIC_BASE_URL sozlanmagan — QR chizilmadi (docType=${docType}, docId=${docId})`,
    );
    return null;
  }
  if (Buffer.byteLength(url, "utf8") > QR_MAX_URL_BYTES) {
    winston.warn(
      `[verifyQr] tekshiruv URL ${Buffer.byteLength(url, "utf8")} bayt (> ${QR_MAX_URL_BYTES}) — QR moduli kichrayadi (docType=${docType})`,
    );
  }

  try {
    const image = await QRCode.toBuffer(url, {
      errorCorrectionLevel: QR_ERROR_CORRECTION,
      margin: 1,
      scale: QR_PNG_SCALE,
    });
    return { url, image };
  } catch (err) {
    winston.error(
      `[verifyQr] QR yaratishda xato (docType=${docType}, docId=${docId}): ${err.message}`,
    );
    return null;
  }
}

module.exports = {
  buildVerifyUrl,
  prepareVerifyQr,
  QR_SIZE_SLOT,
  QR_SIZE_ROW,
  QR_ERROR_CORRECTION,
  QR_MAX_URL_BYTES,
};
