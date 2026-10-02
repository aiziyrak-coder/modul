const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { ErrorHandler } = require("#shared/error");
const { appendSignature } = require("#shared/fileAccess");
const { resolvePublicBaseUrl } = require("#shared/publicBaseUrl");

const MAX_SIZE = 15 * 1024 * 1024;
const FIELD = "applicationFile";
const FOLDER = "science-council-public";

const runMulter = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    return cb(new Error("Ariza fayli faqat PDF formatida bo'lishi kerak"), false);
  },
  limits: { fileSize: MAX_SIZE, files: 1 },
}).single(FIELD);

const uploadApplicationFile = (req, res, next) => {
  runMulter(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new ErrorHandler(400, `Kutilmagan fayl maydoni: ${err.field}`));
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          new ErrorHandler(
            400,
            `Fayl hajmi ${MAX_SIZE / (1024 * 1024)}MB dan oshmasligi kerak`,
          ),
        );
      }
      return next(new ErrorHandler(400, `Fayl yuklash xatosi: ${err.message}`));
    }
    if (err) return next(new ErrorHandler(400, err.message || "Fayl yuklashda xatolik"));
    if (!req.file) return next(new ErrorHandler(400, "Ariza fayli (PDF) majburiy"));
    return next();
  });
};

const persistApplicationFile = (req, res, next) => {
  try {
    const folderPath = process.env.FILEPATH;
    if (!folderPath) {
      return next(new ErrorHandler(500, "FILEPATH muhit o'zgaruvchisi sozlanmagan"));
    }

    const dir = `${folderPath}uploads/file/${FOLDER}`;
    fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(req.file.originalname).toLowerCase() || ".pdf";
    const uniqueName = `${Date.now()}${ext}`;
    const diskPath = `${dir}/${uniqueName}`;
    fs.writeFileSync(diskPath, req.file.buffer);
    req.savedFilePath = diskPath;

    const baseUrl = resolvePublicBaseUrl(req);
    if (!baseUrl) {
      return next(new ErrorHandler(400, "Host ruxsat etilmagan"));
    }
    const filePath = appendSignature(
      `${baseUrl}/files/file/${FOLDER}/${uniqueName}`,
    );

    req.body.workFile = {
      uploaded: true,
      fileName: req.file.originalname,
      filePath,
      uploadedAt: new Date(),
      version: 1,
    };
    return next();
  } catch (err) {
    return next(new ErrorHandler(400, "Ariza faylini saqlashda xatolik", err.message));
  }
};

const discardSavedFile = (req) => {
  if (!req.savedFilePath) return;
  try {
    fs.unlinkSync(req.savedFilePath);
  } catch {}
  req.savedFilePath = null;
};

module.exports = {
  uploadApplicationFile,
  persistApplicationFile,
  discardSavedFile,
  MAX_SIZE,
  FIELD,
};
