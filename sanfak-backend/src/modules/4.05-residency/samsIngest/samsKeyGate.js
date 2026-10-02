"use strict";

const crypto = require("crypto");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");

const HEADER = "x-sams-service-key";
const MIN_KEY_LENGTH = 32;

function configuredKey() {
  const key = process.env.SAMS_SERVICE_KEY;
  if (typeof key !== "string" || key.length < MIN_KEY_LENGTH) return null;
  if (key === process.env.SERVICE_KEY) return null;
  return key;
}

const digest = (s) => crypto.createHash("sha256").update(s, "utf8").digest();

function samsKeyGate(req, _res, next) {
  const expected = configuredKey();
  const given = req.get(HEADER) || "";
  if (expected && given && crypto.timingSafeEqual(digest(given), digest(expected))) {
    return next();
  }
  const path = String(req.originalUrl || "").split("?")[0];
  winston.warn(`[residency-sams] rejected service key ip=${req.ip} path=${path}`);
  return next(
    new ErrorHandler(401, "SAMS xizmat kaliti yaroqsiz", "", { reason: "sams_key_invalid" }),
  );
}

if (!configuredKey()) {
  winston.warn(
    "[residency-sams] SAMS_SERVICE_KEY sozlanmagan (yo'q, <32 belgi yoki SERVICE_KEY bilan bir xil) — /api/residency-sams/* 401 qaytaradi",
  );
}

module.exports = { samsKeyGate, configuredKey, HEADER, MIN_KEY_LENGTH };
