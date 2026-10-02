"use strict";

const path = require("path");
const { requiresSignature, verifySignature } = require("./fileAccess");
const winston = require("./winston.logger");

const createFileAccessGuard = (uploadsRoot) => {
  const rootWithSep = uploadsRoot.endsWith(path.sep)
    ? uploadsRoot
    : uploadsRoot + path.sep;

  return (req, res, next) => {
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(req.path);
    } catch {
      return res.status(400).json({
        status: "error",
        statusCode: 400,
        message: "Yaroqsiz URL",
      });
    }

    const resolved = path.normalize(path.join(uploadsRoot, decodedPath));
    if (resolved !== uploadsRoot && !resolved.startsWith(rootWithSep)) {
      winston.warn(`[files] path traversal urinishi: ${req.originalUrl}`);
      return res.status(403).json({
        status: "error",
        statusCode: 403,
        message: "Ruxsat etilmagan yo'l",
      });
    }

    const ext = path.extname(resolved).toLowerCase();
    const relativePath = decodedPath.replace(/^\/+/, "");
    if (!requiresSignature(relativePath, ext)) {
      return next();
    }

    const { valid, reason } = verifySignature(
      relativePath,
      req.query.t,
      req.query.e,
    );
    if (!valid) {
      winston.warn(`[files] ruxsatsiz hujjat kirishi: ${relativePath} (${reason})`);
      return res.status(403).json({
        status: "error",
        statusCode: 403,
        message: "Ruxsat yo'q yoki havola muddati tugagan",
      });
    }

    return next();
  };
};

module.exports = createFileAccessGuard;
