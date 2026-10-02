"use strict";

const multer = require("multer");
const { ErrorHandler } = require("#shared/error");
const files = require("#modules/4.05-residency/_services/announcementFiles");
const {
  resolveType,
  ACCEPT_EXTENSIONS,
} = require("#modules/4.05-residency/_services/attachmentTypes");

const MB = 1024 * 1024;

const MAX_FILE_SIZE =
  Number(process.env.RESIDENCY_ANNOUNCEMENT_MAX_FILE_MB || 25) * MB;
const MAX_FILES = Number(process.env.RESIDENCY_ANNOUNCEMENT_MAX_FILES || 10);
const MAX_TOTAL_SIZE =
  Number(process.env.RESIDENCY_ANNOUNCEMENT_MAX_TOTAL_MB || 100) * MB;

const FIELD = "files";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    files
      .ensureTmpDir()
      .then(() => cb(null, files.resolveTmpRoot()))
      .catch(cb);
  },
  filename: (req, file, cb) => {
    cb(null, files.createTmpPath().split(/[/\\]/).pop());
  },
});

const runMulter = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
}).array(FIELD, MAX_FILES);

const mb = (bytes) => Math.round(bytes / MB);

const cleanupRequestFiles = async (req) => {
  const paths = (req.files || []).map((f) => f.path).filter(Boolean);
  await files.discardMany(paths);
};

const receiveFiles = (req, res, next) => {
  runMulter(req, res, (err) => {
    if (!err) return next();

    cleanupRequestFiles(req).finally(() => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new ErrorHandler(
              400,
              `Fayl hajmi ${mb(MAX_FILE_SIZE)} MB dan oshmasligi kerak`,
              "ATTACHMENT_TOO_LARGE",
            ),
          );
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return next(
            new ErrorHandler(
              400,
              `Bitta e'longa ko'pi bilan ${MAX_FILES} ta fayl biriktirish mumkin`,
              "ATTACHMENT_TOO_MANY",
            ),
          );
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(
            new ErrorHandler(
              400,
              `Kutilmagan fayl maydoni: ${err.field}. Fayllar "${FIELD}" maydonida yuborilishi kerak`,
              "ATTACHMENT_FIELD_UNEXPECTED",
            ),
          );
        }
        return next(
          new ErrorHandler(400, `Fayl yuklash xatosi: ${err.message}`, err.code),
        );
      }
      return next(
        new ErrorHandler(
          400,
          err.message || "Fayl yuklashda xatolik",
          "ATTACHMENT_UPLOAD_FAILED",
        ),
      );
    });
  });
};

const decodeOriginalName = (name) =>
  Buffer.from(String(name || ""), "latin1").toString("utf8");

const TYPE_ERRORS = {
  ATTACHMENT_TYPE_NOT_ALLOWED: (detail) =>
    `"${detail}" turdagi fayl qabul qilinmaydi. Ruxsat etilgan: ${ACCEPT_EXTENSIONS.join(", ")}`,
  ATTACHMENT_TYPE_MISMATCH: () =>
    "Fayl mazmuni kengaytmasiga mos kelmaydi (fayl buzilgan yoki nomi almashtirilgan)",
};

const inspectFiles = async (req, res, next) => {
  const uploaded = req.files || [];
  if (!uploaded.length) {
    return next(
      new ErrorHandler(
        400,
        "Kamida bitta fayl tanlang",
        "ATTACHMENT_FILE_REQUIRED",
      ),
    );
  }

  const tmpPaths = uploaded.map((f) => f.path);

  try {
    const drafts = [];
    let batchSize = 0;

    for (const file of uploaded) {
      const originalName = decodeOriginalName(file.originalname);

      const { checksum, header, size } = await files.inspect(file.path);

      if (size === 0) {
        throw new ErrorHandler(
          400,
          `"${originalName}" — bo'sh fayl`,
          "ATTACHMENT_EMPTY",
        );
      }

      const resolved = resolveType(originalName, header);
      if (!resolved.ok) {
        const message = TYPE_ERRORS[resolved.code](resolved.detail);
        throw new ErrorHandler(
          400,
          `"${originalName}": ${message}`,
          resolved.code,
        );
      }

      const verdict = await files.scan(file.path);
      if (!verdict.clean) {
        throw new ErrorHandler(
          400,
          `"${originalName}" xavfsizlik tekshiruvidan o'tmadi`,
          "ATTACHMENT_INFECTED",
        );
      }

      batchSize += size;
      drafts.push({
        tmpPath: file.path,
        name: files.sanitizeFilename(originalName, resolved.ext),
        ext: resolved.ext,
        mimeType: resolved.type.mime,
        bytes: size,
        checksum,
      });
    }

    if (batchSize > MAX_TOTAL_SIZE) {
      throw new ErrorHandler(
        400,
        `Fayllarning umumiy hajmi ${mb(MAX_TOTAL_SIZE)} MB dan oshmasligi kerak`,
        "ATTACHMENT_QUOTA_EXCEEDED",
      );
    }

    req.attachmentDrafts = drafts;
    return next();
  } catch (err) {
    await files.discardMany(tmpPaths);
    return next(
      err instanceof ErrorHandler
        ? err
        : new ErrorHandler(
            500,
            "Fayllarni tekshirishda xatolik",
            err.message,
          ),
    );
  }
};

module.exports = {
  FIELD,
  MAX_FILE_SIZE,
  MAX_FILES,
  MAX_TOTAL_SIZE,
  receiveFiles,
  inspectFiles,
};
