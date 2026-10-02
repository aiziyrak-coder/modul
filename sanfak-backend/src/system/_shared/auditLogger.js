const AuditLog = require("#modules/4.01-auth/auditLog/auditLog.model");
const winston = require("#shared/winston.logger");

const SENSITIVE_KEY_PATTERN =
  /pin|token|secret|password|signature|jshshir|passport|phone|email|address|birth|salary|card/i;

const MAX_DEPTH = 6;
const MAX_ARRAY = 50;

const sanitizeDeep = (value, depth = 0) => {
  if (depth > MAX_DEPTH || value == null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((v) => sanitizeDeep(v, depth + 1));
  }
  if (typeof value !== "object") return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;

  const cleaned = {};
  Object.keys(value).forEach((key) => {
    if (SENSITIVE_KEY_PATTERN.test(key) && value[key]) cleaned[key] = "***";
    else cleaned[key] = sanitizeDeep(value[key], depth + 1);
  });
  return cleaned;
};

const sanitizeBody = (body) =>
  !body || typeof body !== "object" ? body : sanitizeDeep(body);

const SENSITIVE_QUERY_KEYS = /^(token|t|access_token|refreshToken|signature)$/i;

const sanitizeQuery = (query) => {
  if (!query || typeof query !== "object") return query;
  const cleaned = {};
  Object.keys(query).forEach((k) => {
    cleaned[k] =
      SENSITIVE_QUERY_KEYS.test(k) || SENSITIVE_KEY_PATTERN.test(k)
        ? "***"
        : query[k];
  });
  return cleaned;
};

const sanitizeUrl = (url) => {
  const str = String(url || "");
  const qIdx = str.indexOf("?");
  if (qIdx === -1) return str;

  const base = str.slice(0, qIdx + 1);
  const maskedQuery = str
    .slice(qIdx + 1)
    .split("&")
    .map((pair) => {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) return pair;
      const rawKey = pair.slice(0, eqIdx);
      let key = rawKey;
      try {
        key = decodeURIComponent(rawKey);
      } catch {}
      return SENSITIVE_QUERY_KEYS.test(key) || SENSITIVE_KEY_PATTERN.test(key)
        ? `${rawKey}=***`
        : pair;
    })
    .join("&");

  return base + maskedQuery;
};

const LOGGED_METHODS = ["POST", "GET", "PUT", "PATCH", "DELETE"];

const SKIP_PATHS = ["/api-docs", "/api/auth/profile", "/api/residency-sams/ingest"];

const READ_MODES = ["all", "records", "none"];
const rawReadMode = String(process.env.AUDIT_LOG_READS || "records").toLowerCase();
const READ_MODE = READ_MODES.includes(rawReadMode) ? rawReadMode : "records";

const isMeaningfulRead = (pathOnly) =>
  /[0-9a-f]{24}/i.test(pathOnly) || /\/(export|pdf|download)(\/|$)/i.test(pathOnly);

const collectFileNames = (req) => {
  const names = [];
  const push = (f) => {
    if (f && f.originalname) names.push(f.originalname);
  };
  if (req.file) push(req.file);
  if (Array.isArray(req.files)) req.files.forEach(push);
  else if (req.files && typeof req.files === "object") {
    Object.values(req.files).forEach((v) => {
      if (Array.isArray(v)) v.forEach(push);
      else push(v);
    });
  }
  return names.length ? names.slice(0, 20) : undefined;
};

const clientIp = (req) => {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim();
  return req.ip || (req.socket && req.socket.remoteAddress) || "";
};

const auditLogger = (req, res, next) => {
  if (!LOGGED_METHODS.includes(req.method)) return next();
  if (SKIP_PATHS.some((p) => req.originalUrl.startsWith(p))) return next();

  const startTime = Date.now();

  const shouldSkipRead = () => {
    if (req.method !== "GET" || READ_MODE === "all") return false;
    if (res.statusCode >= 400) return false;
    if (READ_MODE === "none") return true;
    return !isMeaningfulRead(req.originalUrl.split("?")[0]);
  };

  let written = false;
  const writeEntry = () => {
    if (written) return;
    written = true;
    if (shouldSkipRead()) return;

    const responseTime = Date.now() - startTime;

    const actor = req.user || null;
    const fallback = req.auditUser || null;

    const user = (actor && actor._id) || (fallback && fallback.id) || null;
    const userName = actor
      ? `${actor.lastName || ""} ${actor.firstName || ""}`.trim()
      : (fallback && fallback.name) || "";

    const pathOnly = req.originalUrl.split("?")[0];
    const moduleName = pathOnly.replace(/^\/api\//, "").split("/")[0] || "unknown";

    const idMatches = pathOnly.match(/[0-9a-f]{24}/gi);
    const targetId = idMatches
      ? idMatches[idMatches.length - 1].toLowerCase()
      : undefined;

    AuditLog.create({
      user,
      userName,
      action: `${req.method} ${sanitizeUrl(req.originalUrl)}`,
      module: moduleName,
      targetId,
      method: req.method,
      path: sanitizeUrl(req.originalUrl),
      statusCode: res.statusCode,
      requestBody: sanitizeBody(req.body),
      requestQuery: sanitizeQuery(req.query),
      files: collectFileNames(req),
      ip: clientIp(req),
      userAgent: req.headers["user-agent"] || "",
      responseTime,
    }).catch((err) => {
      winston.error("AuditLog write error:", err.message);
    });
  };

  res.on("finish", writeEntry);
  res.on("close", writeEntry);

  next();
};

module.exports = auditLogger;
module.exports.sanitizeUrl = sanitizeUrl;
