const AuditLog = require("#modules/4.01-auth/auditLog/auditLog.model");
const { requiresSignature } = require("#shared/fileAccess");
const winston = require("#shared/winston.logger");
const path = require("path");
const rateLimit = require("express-rate-limit");

const fileAccessLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    statusCode: 429,
    message: "Fayl so'rovlari chegarasi oshib ketdi. Biroz kuting.",
  },
  skip: (req) => {
    const rel = String(req.path || "").replace(/^\/+/, "");
    return !requiresSignature(rel, path.extname(rel).toLowerCase());
  },
});

const clientIp = (req) => {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim();
  return req.ip || (req.socket && req.socket.remoteAddress) || "";
};

const fileDownloadLogger = (req, res, next) => {
  if (req.method !== "GET") return next();

  let relPath;
  try {
    relPath = decodeURIComponent(req.path || "");
  } catch {
    relPath = String(req.path || "");
  }
  const ext = path.extname(relPath).toLowerCase();

  if (!requiresSignature(relPath.replace(/^\/+/, ""), ext)) return next();

  res.on("finish", () => {
    AuditLog.create({
      user: null,
      userName: "",
      action: `DOWNLOAD ${relPath}`,
      module: "files",
      method: "GET",
      path: `/files${relPath}`,
      statusCode: res.statusCode,
      files: [path.basename(relPath)],
      ip: clientIp(req),
      userAgent: req.headers["user-agent"] || "",
    }).catch((err) => {
      winston.error("AuditLog (file download) write error:", err.message);
    });
  });

  next();
};

module.exports = { fileDownloadLogger, fileAccessLimiter };
