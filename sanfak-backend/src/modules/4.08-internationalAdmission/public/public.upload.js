const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { FILE_LIMITS } = require("#config/constants");
const { ErrorHandler } = require("#shared/error");
const { appendSignature } = require("#shared/fileAccess");
const { resolvePublicBaseUrl } = require("#shared/publicBaseUrl");

const FIELD_TO_SLOT = {
  documentPassport: "passport",
  documentDiploma: "diploma",
  documentCertificate: "certificate",
};

const multerFilter = (req, file, cb) => {
  if (FILE_LIMITS.ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
  return cb(
    new Error(
      `Fayl turi qo'llab-quvvatlanmaydi! Ruxsat etilgan: ${FILE_LIMITS.ALLOWED_EXTENSIONS.join(", ")}`,
    ),
    false,
  );
};

const runMulter = multer({
  storage: multer.memoryStorage(),
  fileFilter: multerFilter,
  limits: { fileSize: FILE_LIMITS.MAX_SIZE },
}).fields([
  { name: "file", maxCount: 1 },
  { name: "documentPassport", maxCount: 1 },
  { name: "documentDiploma", maxCount: 1 },
  { name: "documentCertificate", maxCount: 1 },
]);

const uploadApplicationDocs = (req, res, next) => {
  runMulter(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new ErrorHandler(400, `Kutilmagan fayl maydoni: ${err.field}`));
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          new ErrorHandler(400, `Fayl hajmi ${FILE_LIMITS.MAX_SIZE / (1024 * 1024)}MB dan oshmasligi kerak`),
        );
      }
      return next(new ErrorHandler(400, `Fayl yuklash xatosi: ${err.message}`));
    }
    if (err) return next(new ErrorHandler(400, err.message || "Fayl yuklashda xatolik"));
    return next();
  });
};

const persistApplicationDocs = (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) return next();

    const folderPath = process.env.FILEPATH;
    if (!folderPath) return next(new ErrorHandler(500, "FILEPATH muhit o'zgaruvchisi sozlanmagan"));

    const dir = `${folderPath}uploads/images/public`;
    fs.mkdirSync(dir, { recursive: true });

    const baseUrl = resolvePublicBaseUrl(req);
    if (!baseUrl) {
      return next(new ErrorHandler(400, "Host ruxsat etilmagan"));
    }
    let i = 0;
    const save = (file) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
      const uniqueName = `${Date.now()}${i}${ext}`;
      i += 1;
      fs.writeFileSync(`${dir}/${uniqueName}`, file.buffer);
      return appendSignature(`${baseUrl}/files/images/public/${uniqueName}`);
    };

    const photo = req.files.file && req.files.file[0];
    if (photo) req.body.photoUrl = save(photo);

    const documents = {};
    for (const [field, slot] of Object.entries(FIELD_TO_SLOT)) {
      const file = req.files[field] && req.files[field][0];
      if (!file) continue;
      documents[slot] = {
        fileUrl: save(file),
        fileName: file.originalname,
        fileSize: file.size,
      };
    }
    req.body.documents = documents;
    return next();
  } catch (err) {
    return next(new ErrorHandler(400, "Hujjatlarni saqlashda xatolik", err.message));
  }
};

module.exports = { uploadApplicationDocs, persistApplicationDocs };
