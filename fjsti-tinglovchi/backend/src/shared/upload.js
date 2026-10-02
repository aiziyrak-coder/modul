const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { ErrorHandler } = require("./error");

const FILES_DIR = path.resolve(process.env.FILES_DIR || "./files");
fs.mkdirSync(FILES_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FILES_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 40);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const maxMb = Number(process.env.MAX_UPLOAD_MB || 50);

const upload = multer({
  storage,
  limits: { fileSize: maxMb * 1024 * 1024, files: 10 },
});

function attachFileUrls(req, _res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  for (const f of files) {
    req.body[f.fieldname] = `/files/${f.filename}`;
  }
  return next();
}

function handleUploadError(err, _req, _res, next) {
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? `Fayl hajmi ${maxMb} MB dan oshmasligi kerak`
        : "Fayl yuklashda xatolik";
    return next(new ErrorHandler(400, msg, err.code));
  }
  return next(err);
}

module.exports = { upload, attachFileUrls, handleUploadError, FILES_DIR };
