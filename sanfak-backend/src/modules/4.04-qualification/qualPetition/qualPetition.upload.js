const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { FILE_LIMITS } = require("#config/constants");
const { appendSignature } = require("#shared/fileAccess");
const { resolvePublicBaseUrl } = require("#shared/publicBaseUrl");
const { ErrorHandler } = require("#shared/error");

const DOC_FIELDS = [
  { name: "bachelorDiploma", maxCount: 1 },
  { name: "mastersDiploma", maxCount: 1 },
  { name: "moCertificate", maxCount: 1 },
];

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (FILE_LIMITS.ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Fayl turi qo'llab-quvvatlanmaydi! Ruxsat etilgan: ${FILE_LIMITS.ALLOWED_EXTENSIONS.join(", ")}`,
      ),
      false,
    );
  }
};
const uploadFields = multer({
  storage,
  fileFilter,
  limits: { fileSize: FILE_LIMITS.MAX_SIZE },
}).fields(DOC_FIELDS);

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

exports.uploadPetitionDocs = (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: `Fayl hajmi ${FILE_LIMITS.MAX_SIZE / (1024 * 1024)}MB dan oshmasligi kerak`,
        });
      }
      return res.status(400).json({ message: `Multer xatosi: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message || String(err) });
    }
    next();
  });
};

exports.savePetitionDocs = (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) return next();

    const folderPath = process.env.FILEPATH;
    if (!folderPath) {
      return res
        .status(500)
        .json({ message: "FILEPATH muhit o'zgaruvchisi sozlanmagan" });
    }

    const dir = `${folderPath}uploads/petition`;
    ensureDir(dir);
    const base = resolvePublicBaseUrl(req);
    if (!base) {
      throw new ErrorHandler(400, "Host ruxsat etilmagan");
    }

    DOC_FIELDS.forEach(({ name }) => {
      const arr = req.files[name];
      if (arr && arr[0]) {
        const file = arr[0];
        const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
        const uniqueName = `${Date.now()}-${name}${ext}`;
        fs.writeFileSync(`${dir}/${uniqueName}`, file.buffer);
        req.body[name] = appendSignature(`${base}/files/petition/${uniqueName}`);
      }
    });

    next();
  } catch (err) {
    if (err instanceof ErrorHandler) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    return res
      .status(500)
      .json({ message: `Faylni saqlashda xatolik: ${err.message}` });
  }
};
