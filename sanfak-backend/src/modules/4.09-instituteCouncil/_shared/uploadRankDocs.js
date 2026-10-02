const multer = require("multer");
const { FILE_LIMITS } = require("#config/constants");

const RANK_DOCS_MAX = 60;

const fileFilter = (req, file, cb) => {
  if (FILE_LIMITS.ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(
    new Error(
      `Fayl turi qo'llab-quvvatlanmaydi! Ruxsat etilgan turlar: ${FILE_LIMITS.ALLOWED_EXTENSIONS.join(", ")}`,
    ),
    false,
  );
};

const uploadFields = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: FILE_LIMITS.MAX_SIZE },
}).fields([{ name: "files", maxCount: RANK_DOCS_MAX }]);

const uploadRankDocs = (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          message: `Kutilmagan fayl maydoni: ${err.field} (bitta arizaga eng ko'pi ${RANK_DOCS_MAX} ta hujjat)`,
        });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: `Fayl hajmi ${FILE_LIMITS.MAX_SIZE / (1024 * 1024)}MB dan oshmasligi kerak`,
        });
      }
      return res.status(400).json({ message: `Multer xatosi: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ message: err.message || String(err) });
    }
    return next();
  });
};

module.exports = { uploadRankDocs, RANK_DOCS_MAX };
