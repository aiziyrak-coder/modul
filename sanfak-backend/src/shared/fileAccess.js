"use strict";

const crypto = require("crypto");
const winston = require("./winston.logger");

const PUBLIC_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const isPublicImageExt = (ext) =>
  PUBLIC_IMAGE_EXTENSIONS.has(String(ext || "").toLowerCase());

const SIGNED_PATH_PREFIXES = ["images/public/"];

const isSignedPath = (relativePath) => {
  const norm = String(relativePath || "")
    .split("\\")
    .join("/")
    .replace(/^\/+/, "");
  return SIGNED_PATH_PREFIXES.some((prefix) => norm.startsWith(prefix));
};

const requiresSignature = (relativePath, ext) =>
  isSignedPath(relativePath) || !isPublicImageExt(ext);

const DEFAULT_TTL_SECONDS =
  Number(process.env.FILE_URL_TTL_SECONDS) || 10 * 365 * 24 * 60 * 60;

let cachedSecret = null;
const getSecret = () => {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.FILE_URL_SECRET || process.env.JWT_SECRET;
  if (!raw) {
    winston.error(
      "[fileAccess] FILE_URL_SECRET va JWT_SECRET topilmadi — fayl imzolash ishlamaydi",
    );
    cachedSecret = "";
    return cachedSecret;
  }
  if (!process.env.FILE_URL_SECRET) {
    winston.warn(
      "[fileAccess] FILE_URL_SECRET sozlanmagan — JWT_SECRET'dan hosila ishlatilmoqda. Productionda alohida FILE_URL_SECRET tavsiya etiladi.",
    );
  }
  cachedSecret = crypto
    .createHash("sha256")
    .update(`file-url-signing:${raw}`)
    .digest();
  return cachedSecret;
};

const computeSignature = (relativePath, expiry) =>
  crypto
    .createHmac("sha256", getSecret())
    .update(`${relativePath}:${expiry}`)
    .digest("hex")
    .slice(0, 32);

const signQuery = (relativePath, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const t = computeSignature(relativePath, expiry);
  return `t=${t}&e=${expiry}`;
};

const appendSignature = (fileUrl, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  if (!fileUrl || typeof fileUrl !== "string") return fileUrl;
  const marker = "/files/";
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return fileUrl;

  const relativePath = fileUrl.slice(idx + marker.length);
  const dotIdx = relativePath.lastIndexOf(".");
  const ext = dotIdx === -1 ? "" : relativePath.slice(dotIdx).toLowerCase();
  if (!requiresSignature(relativePath, ext)) return fileUrl;

  const sep = fileUrl.includes("?") ? "&" : "?";
  return `${fileUrl}${sep}${signQuery(relativePath, ttlSeconds)}`;
};

const verifySignature = (relativePath, t, e) => {
  if (!t || !e) return { valid: false, reason: "imzo yo'q" };

  const expiry = Number(e);
  if (!Number.isFinite(expiry)) {
    return { valid: false, reason: "yaroqsiz muddat" };
  }
  if (Math.floor(Date.now() / 1000) > expiry) {
    return { valid: false, reason: "muddati tugagan" };
  }

  const expected = computeSignature(relativePath, expiry);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(t), "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "imzo mos emas" };
  }
  return { valid: true };
};

module.exports = {
  PUBLIC_IMAGE_EXTENSIONS,
  SIGNED_PATH_PREFIXES,
  isPublicImageExt,
  isSignedPath,
  requiresSignature,
  signQuery,
  appendSignature,
  verifySignature,
};
