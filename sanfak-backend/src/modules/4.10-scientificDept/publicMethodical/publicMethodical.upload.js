const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { ErrorHandler } = require("#shared/error");
const { appendSignature } = require("#shared/fileAccess");
const { resolvePublicBaseUrl } = require("#shared/publicBaseUrl");

const PDF = ["application/pdf"];
const DOCX = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

const FIELDS = {
  documentMethodical: {
    slot: "methodical",
    label: "Uslubiy tavsiyanoma (.docx)",
    types: DOCX,
    ext: "DOCX",
  },
  documentProtocol: {
    slot: "protocol",
    label: "Kafedra bayonnomasi (.pdf)",
    types: PDF,
    ext: "PDF",
  },
  documentTitul: {
    slot: "titul",
    label: "Titul varag'i (.docx)",
    types: DOCX,
    ext: "DOCX",
  },
  documentExternal: {
    slot: "external",
    label: "Tashqi taqriz (.pdf)",
    types: PDF,
    ext: "PDF",
  },
  documentInternal: {
    slot: "internal",
    label: "Ichki taqriz (.pdf)",
    types: PDF,
    ext: "PDF",
  },
  documentAntiplagiat: {
    slot: "antiplagiat",
    label: "Antiplagiat to'liq hisoboti (.pdf)",
    types: PDF,
    ext: "PDF",
  },
};

const PUBLIC_MAX_SIZE = 10 * 1024 * 1024;

const multerFilter = (req, file, cb) => {
  const rule = FIELDS[file.fieldname];
  if (!rule) return cb(new Error(`Kutilmagan fayl maydoni: ${file.fieldname}`), false);
  if (rule.types.includes(file.mimetype)) return cb(null, true);
  return cb(
    new Error(`"${rule.label}" uchun faqat ${rule.ext} qabul qilinadi`),
    false,
  );
};

const runMulter = multer({
  storage: multer.memoryStorage(),
  fileFilter: multerFilter,
  limits: { fileSize: PUBLIC_MAX_SIZE, files: Object.keys(FIELDS).length },
}).fields(Object.keys(FIELDS).map((name) => ({ name, maxCount: 1 })));

const uploadMethodicalDocs = (req, res, next) => {
  runMulter(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new ErrorHandler(400, `Kutilmagan fayl maydoni: ${err.field}`));
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          new ErrorHandler(
            400,
            `Fayl hajmi ${PUBLIC_MAX_SIZE / (1024 * 1024)}MB dan oshmasligi kerak`,
          ),
        );
      }
      return next(new ErrorHandler(400, `Fayl yuklash xatosi: ${err.message}`));
    }
    if (err) return next(new ErrorHandler(400, err.message || "Fayl yuklashda xatolik"));
    return next();
  });
};

const requireAllDocs = (req, res, next) => {
  const missing = Object.keys(FIELDS).filter(
    (field) => !(req.files && req.files[field] && req.files[field][0]),
  );
  if (missing.length) {
    return next(
      new ErrorHandler(
        400,
        `Quyidagi hujjatlar yuklanmadi: ${missing.map((f) => FIELDS[f].label).join(", ")}`,
      ),
    );
  }
  return next();
};

const persistMethodicalDocs = (req, res, next) => {
  try {
    const folderPath = process.env.FILEPATH;
    if (!folderPath) {
      return next(new ErrorHandler(500, "FILEPATH muhit o'zgaruvchisi sozlanmagan"));
    }

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

    const files = {};
    for (const [field, rule] of Object.entries(FIELDS)) {
      const file = req.files && req.files[field] && req.files[field][0];
      if (!file) continue;
      files[rule.slot] = save(file);
    }
    req.body.files = files;
    return next();
  } catch (err) {
    return next(new ErrorHandler(400, "Hujjatlarni saqlashda xatolik", err.message));
  }
};

module.exports = {
  uploadMethodicalDocs,
  requireAllDocs,
  persistMethodicalDocs,
  FIELDS,
  PUBLIC_MAX_SIZE,
};
