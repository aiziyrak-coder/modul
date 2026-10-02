"use strict";

const { isDevEnv } = require("./env");

const DEV_DEFAULT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

const originOf = (urlLike) => {
  try {
    return new URL(urlLike).origin;
  } catch {
    return null;
  }
};

const resolveAllowedOrigins = (rawEnv = process.env.ALLOWED_ORIGINS) => {
  const configured = rawEnv
    ? rawEnv
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : [];
  const list = configured.length ? configured : isDevEnv() ? [...DEV_DEFAULT_ORIGINS] : [];

  const publicOrigin = process.env.PUBLIC_BASE_URL && originOf(process.env.PUBLIC_BASE_URL);
  if (publicOrigin && !list.includes(publicOrigin)) list.push(publicOrigin);

  return list;
};

const isSameOrigin = (origin, req) => {
  if (!origin || !req) return false;
  const protocol = req.protocol;
  const host = typeof req.get === "function" ? req.get("host") : undefined;
  if (!protocol || !host) return false;
  return `${protocol}://${host}`.toLowerCase() === String(origin).toLowerCase();
};

const isOriginAllowed = (origin, allowedOrigins = resolveAllowedOrigins(), req) =>
  !origin || isSameOrigin(origin, req) || allowedOrigins.includes(origin);

module.exports = {
  DEV_DEFAULT_ORIGINS,
  resolveAllowedOrigins,
  isSameOrigin,
  isOriginAllowed,
};
