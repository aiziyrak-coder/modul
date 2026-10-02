"use strict";

const QRCode = require("qrcode");
const winston = require("#shared/winston.logger");
const { resolvePublicBaseUrl } = require("#shared/publicBaseUrl");
const { isDevEnv } = require("#shared/env");

const QR_SIZE = 44;
const QR_ERROR_CORRECTION = "M";
const QR_PNG_SCALE = 8;
const QR_MAX_URL_BYTES = 84;

const QR_STATUSES = new Set(["submitted", "approved", "completed"]);

function buildVerifyUrl(token) {
  const base = resolvePublicBaseUrl();
  if (base) return `${base}/verify/plan/${token}`;
  if (!isDevEnv()) return null;
  return `http://localhost:${process.env.PORT || 4000}/verify/plan/${token}`;
}

function activeToken(plan) {
  const v = (plan && plan.verify) || {};
  if (!plan || !QR_STATUSES.has(plan.status) || v.revokedAt) return null;
  return v.token || null;
}

async function prepareVerifyQr(plan) {
  const token = activeToken(plan);
  if (!token) return null;

  const url = buildVerifyUrl(token);
  if (!url) {
    winston.error(`[workPlanVerifyQr] PUBLIC_BASE_URL sozlanmagan — QR chizilmadi (planId=${plan._id})`);
    return null;
  }
  if (Buffer.byteLength(url, "utf8") > QR_MAX_URL_BYTES) {
    winston.warn(`[workPlanVerifyQr] tekshiruv URL ${Buffer.byteLength(url, "utf8")} bayt (> ${QR_MAX_URL_BYTES}) — QR moduli kichrayadi`);
  }
  try {
    const image = await QRCode.toBuffer(url, {
      errorCorrectionLevel: QR_ERROR_CORRECTION,
      margin: 1,
      scale: QR_PNG_SCALE,
    });
    return { url, image };
  } catch (err) {
    winston.error(`[workPlanVerifyQr] QR yaratishda xato (planId=${plan._id}): ${err.message}`);
    return null;
  }
}

module.exports = {
  buildVerifyUrl,
  prepareVerifyQr,
  QR_SIZE,
  QR_STATUSES,
  QR_ERROR_CORRECTION,
  QR_MAX_URL_BYTES,
};
