const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { ErrorHandler } = require("#shared/error");
const { appendSignature } = require("#shared/fileAccess");
const { resolvePublicBaseUrl } = require("#shared/publicBaseUrl");

const FIELD_TO_SLOT = {
  documentReferral: "referral",
  documentApplication: "application",
  documentPassport: "passport",
  documentDiploma: "diploma",
  documentObjektivka: "objektivka",
  documentTopic: "topic",
  documentOrder: "order",
};

const DOC_LABEL = {
  documentReferral: "Tashkilot rahbari tasdiqlagan muhrli xat",
  documentApplication: "Ariza (FJSTI rektori nomiga)",
  documentPassport: "Pasport nusxasi",
  documentDiploma: "Diplom nusxasi (ilovasi bilan)",
  documentObjektivka: "Obyektivka (ma'lumotnoma)",
  documentTopic: "OAK byulleteni / Ilmiy kengash e'loni nusxasi",
  documentOrder: "Izlanuvchi yoki doktoranturaga kirganlik buyrug'i",
};

const PUBLIC_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const PUBLIC_MAX_SIZE = 10 * 1024 * 1024;

const multerFilter = (req, file, cb) => {
  if (PUBLIC_ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
  return cb(new Error("Fayl turi qo'llab-quvvatlanmaydi! Ruxsat etilgan: PDF, JPG, PNG"), false);
};

const runMulter = multer({
  storage: multer.memoryStorage(),
  fileFilter: multerFilter,
  limits: { fileSize: PUBLIC_MAX_SIZE, files: Object.keys(FIELD_TO_SLOT).length },
}).fields(Object.keys(FIELD_TO_SLOT).map((name) => ({ name, maxCount: 1 })));

const uploadApplicantDocs = (req, res, next) => {
  runMulter(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new ErrorHandler(400, `Kutilmagan fayl maydoni: ${err.field}`));
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          new ErrorHandler(400, `Fayl hajmi ${PUBLIC_MAX_SIZE / (1024 * 1024)}MB dan oshmasligi kerak`),
        );
      }
      return next(new ErrorHandler(400, `Fayl yuklash xatosi: ${err.message}`));
    }
    if (err) return next(new ErrorHandler(400, err.message || "Fayl yuklashda xatolik"));
    return next();
  });
};

const requireAllDocs = (req, res, next) => {
  const missing = Object.keys(FIELD_TO_SLOT).filter(
    (field) => !(req.files && req.files[field] && req.files[field][0]),
  );
  if (missing.length) {
    return next(
      new ErrorHandler(
        400,
        `Quyidagi hujjatlar yuklanmagan: ${missing.map((f) => DOC_LABEL[f]).join(", ")}`,
      ),
    );
  }
  return next();
};

const persistApplicantDocs = (req, res, next) => {
  try {
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

    const documents = {};
    for (const [field, slot] of Object.entries(FIELD_TO_SLOT)) {
      const file = req.files && req.files[field] && req.files[field][0];
      if (!file) continue;
      documents[slot] = save(file);
    }
    req.body.documents = documents;
    return next();
  } catch (err) {
    return next(new ErrorHandler(400, "Hujjatlarni saqlashda xatolik", err.message));
  }
};

module.exports = {
  uploadApplicantDocs,
  requireAllDocs,
  persistApplicantDocs,
  FIELD_TO_SLOT,
  PUBLIC_ALLOWED_TYPES,
  PUBLIC_MAX_SIZE,
};
