const winston = require("#shared/winston.logger");
const { isDevEnv } = require("#shared/env");

const PROVIDERS = {
  pin: require("./pin.provider"),
  oneid: require("./oneid.provider"),
};

const raw = (process.env.AUTH_PROVIDER || "").trim().toLowerCase();
const isProd = !isDevEnv();

const allowPinInProd =
  (process.env.ALLOW_PIN_IN_PROD || "").trim().toLowerCase() === "true";
const pinExceptionActive = isProd && raw === "pin" && allowPinInProd;

if (isProd && raw !== "oneid" && !pinExceptionActive) {
  throw new Error(
    `AUTH_PROVIDER production'da faqat "oneid" bo'lishi mumkin (hozirgi: "${raw || "bo'sh"}")`,
  );
}

if (isProd && !PROVIDERS[raw]) {
  throw new Error(`AUTH_PROVIDER noto'g'ri: "${raw}"`);
}

const activeProvider = PROVIDERS[raw] || PROVIDERS.pin;

if (!PROVIDERS[raw]) {
  winston.warn(
    `[auth] AUTH_PROVIDER noto'g'ri/bo'sh ("${raw || "bo'sh"}") → "pin" ga tushirildi (FAQAT dev)`,
  );
} else if (activeProvider.name === "pin") {
  winston.warn(
    "[auth] PIN rejimi FAQAT dev/staging uchun — provayder tekshiruvi YO'Q",
  );
}

if (pinExceptionActive) {
  winston.warn(
    "[auth] ⚠️ PRODUCTION'da PIN rejimi YOQILGAN (ALLOW_PIN_IN_PROD=true) — " +
      "bu VAQTINCHALIK istisno. PIN yagona kalit: provayder " +
      "tekshiruvi YO'Q, ikkinchi faktor YO'Q. OneID ulangach bayroq " +
      "va istisno OLIB TASHLANADI.",
  );
}

module.exports = activeProvider;
