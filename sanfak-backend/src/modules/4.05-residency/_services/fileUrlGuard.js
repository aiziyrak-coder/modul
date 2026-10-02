"use strict";

const { ErrorHandler } = require("#shared/error");
const { isHostAllowed } = require("#shared/publicBaseUrl");

const isFilesPath = (pathname) => pathname.startsWith("/files/");

const readPath = (obj, path) =>
  path
    .split(".")
    .reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), obj);

const MODE_OWN_FILE = "own-file";
const MODE_SCHEME = "scheme";

const guardFileUrl = (field = "fileUrl", { mode = MODE_OWN_FILE } = {}) => {
  function fileUrlGuardMw(req, res, next) {
    if (field.includes(".")) {
      const parentPath = field.slice(0, field.lastIndexOf("."));
      const parent = readPath(req.body ?? {}, parentPath);
      const badShape =
        parent !== undefined &&
        parent !== null &&
        (typeof parent !== "object" || Array.isArray(parent));
      if (badShape) {
        return next(
          new ErrorHandler(
            400,
            `"${parentPath}" obyekt bo'lishi kerak`,
            "FILE_URL_INVALID",
          ),
        );
      }
    }

    const value = readPath(req.body ?? {}, field);
    if (value === undefined || value === null || value === "") return next();

    if (typeof value !== "string") {
      return next(
        new ErrorHandler(400, `"${field}" matn bo'lishi kerak`, "FILE_URL_INVALID"),
      );
    }

    const isOwnPath = value.startsWith("/") && !value.startsWith("//");
    if (mode === MODE_SCHEME && !/^https?:\/\//i.test(value) && !isOwnPath) {
      return next(
        new ErrorHandler(
          400,
          `"${field}" http:// yoki https:// bilan boshlanishi kerak`,
          "FILE_URL_SCHEME_NOT_ALLOWED",
        ),
      );
    }

    let parsed;
    try {
      parsed = new URL(value, `${req.protocol}://${req.get("host")}`);
    } catch {
      return next(
        new ErrorHandler(400, `"${field}" yaroqsiz havola`, "FILE_URL_INVALID"),
      );
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return next(
        new ErrorHandler(
          400,
          mode === MODE_SCHEME
            ? `"${field}" faqat http(s) havolasi bo'lishi mumkin`
            : `"${field}" faqat fayl havolasi bo'lishi mumkin`,
          "FILE_URL_SCHEME_NOT_ALLOWED",
        ),
      );
    }

    if (mode === MODE_SCHEME) return next();

    if (!isFilesPath(parsed.pathname)) {
      return next(
        new ErrorHandler(
          400,
          `"${field}" tizimga yuklangan faylga ishora qilishi kerak`,
          "FILE_URL_NOT_OWN_FILE",
        ),
      );
    }

    if (!isOwnPath && !isHostAllowed(parsed.host)) {
      return next(
        new ErrorHandler(
          400,
          `"${field}" tashqi manzilga ishora qila olmaydi`,
          "FILE_URL_FOREIGN_HOST",
        ),
      );
    }

    return next();
  }

  fileUrlGuardMw.guardedField = field;
  fileUrlGuardMw.guardedMode = mode;
  return fileUrlGuardMw;
};

const guardLinkUrl = (field = "url") => guardFileUrl(field, { mode: MODE_SCHEME });

module.exports = { guardFileUrl, guardLinkUrl };
