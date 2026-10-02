"use strict";

const winston = require("./winston.logger");
const { isDevEnv } = require("./env");

let warnedOnce = false;

const hostOf = (urlLike) => {
  try {
    return new URL(urlLike).host;
  } catch {
    return null;
  }
};

const DEV_LOCALHOST_RE = /^(localhost|127\.0\.0\.1)(:\d+)?$/i;

const buildAllowlist = () => {
  const hosts = new Set();

  const publicHost = process.env.PUBLIC_BASE_URL && hostOf(process.env.PUBLIC_BASE_URL);
  if (publicHost) hosts.add(publicHost.toLowerCase());

  const originsEnv = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : [];
  originsEnv.forEach((origin) => {
    const h = hostOf(origin);
    if (h) hosts.add(h.toLowerCase());
  });

  return hosts;
};

const isHostAllowed = (host) => {
  if (!host) return false;
  const h = String(host).toLowerCase();
  if (isDevEnv() && DEV_LOCALHOST_RE.test(h)) return true;
  return buildAllowlist().has(h);
};

const resolvePublicBaseUrl = (req) => {
  const envBase = process.env.PUBLIC_BASE_URL;
  if (envBase && envBase.trim()) return envBase.trim().replace(/\/+$/, "");

  const host = req && typeof req.get === "function" && req.get("host");
  if (host && isHostAllowed(host)) {
    if (!warnedOnce) {
      warnedOnce = true;
      winston.warn(
        "[publicBaseUrl] PUBLIC_BASE_URL sozlanmagan — Host allowlist'dan olindi",
      );
    }
    return `${req.protocol}://${host}`;
  }

  return null;
};

module.exports = { resolvePublicBaseUrl, isHostAllowed };
