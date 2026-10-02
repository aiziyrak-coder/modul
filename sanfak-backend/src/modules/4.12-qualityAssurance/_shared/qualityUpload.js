const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { FILE_LIMITS } = require("#config/constants");
const { ErrorHandler } = require("#shared/error");
const { appendSignature } = require("#shared/fileAccess");
const { resolvePublicBaseUrl } = require("#shared/publicBaseUrl");
const Indicator = require("#modules/4.12-qualityAssurance/indicator/indicator.model");
const IndicatorSubmission = require("#modules/4.12-qualityAssurance/indicatorSubmission/indicatorSubmission.model");

const MAX_FILES_PER_SUBMISSION = 10;

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
  limits: { fileSize: FILE_LIMITS.MAX_SIZE, files: MAX_FILES_PER_SUBMISSION },
}).any();

const uploadSubmissionFiles = (req, res, next) => {
  runMulter(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          new ErrorHandler(
            400,
            `Fayl hajmi ${FILE_LIMITS.MAX_SIZE / (1024 * 1024)}MB dan oshmasligi kerak`,
          ),
        );
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return next(
          new ErrorHandler(
            400,
            `Bitta yuborilmada ${MAX_FILES_PER_SUBMISSION} tadan ko'p fayl bo'lmasligi kerak`,
          ),
        );
      }
      return next(new ErrorHandler(400, `Fayl yuklash xatosi: ${err.message}`));
    }
    if (err) return next(new ErrorHandler(400, err.message || "Fayl yuklashda xatolik"));

    if (typeof req.body?.data === "string") {
      try {
        req.body.data = JSON.parse(req.body.data);
      } catch {
        return next(new ErrorHandler(400, "`data` maydoni noto'g'ri JSON"));
      }
    }
    return next();
  });
};

const resolveFileFieldNames = async (req) => {
  let indicatorId = req.body?.indicator;
  if (!indicatorId && req.params?.id) {
    const submission = await IndicatorSubmission.findById(req.params.id)
      .select("indicator")
      .lean();
    indicatorId = submission?.indicator;
  }
  if (!indicatorId) return null;

  const indicator = await Indicator.findById(indicatorId).select("dataFields").lean();
  if (!indicator) return null;

  return new Set(
    (indicator.dataFields || [])
      .filter((f) => f.fieldType === "file")
      .map((f) => f.fieldName),
  );
};

const isAllowedExtension = (filename) =>
  FILE_LIMITS.ALLOWED_EXTENSIONS.includes(path.extname(filename).toLowerCase());

const saveFile = (file, index, dir, baseUrl) => {
  if (!isAllowedExtension(file.originalname)) {
    throw new ErrorHandler(
      400,
      `Ruxsat etilmagan fayl kengaytmasi: ${path.extname(file.originalname).toLowerCase()}.` +
        ` Ruxsat etilganlar: ${FILE_LIMITS.ALLOWED_EXTENSIONS.join(", ")}`,
    );
  }
  const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
  const uniqueName = `${Date.now()}${index}${ext}`;
  fs.writeFileSync(`${dir}/${uniqueName}`, file.buffer);

  return {
    fileUrl: appendSignature(`${baseUrl}/files/file/submissions/${uniqueName}`),
    fileName: file.originalname,
    fileSize: file.size,
  };
};

const assertFieldsDeclared = (files, allowed) => {
  const unexpected = files.map((f) => f.fieldname).filter((n) => !allowed.has(n));
  if (unexpected.length) {
    throw new ErrorHandler(
      400,
      `Bu indikatorda bunday fayl maydoni yo'q: ${[...new Set(unexpected)].join(", ")}`,
    );
  }
};

const prepareDestination = () => {
  const folderPath = process.env.FILEPATH;
  if (!folderPath) {
    throw new ErrorHandler(500, "FILEPATH muhit o'zgaruvchisi sozlanmagan");
  }
  const dir = `${folderPath}uploads/file/submissions`;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const persistSubmissionFiles = async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) return next();

    const allowed = await resolveFileFieldNames(req);
    if (!allowed) throw new ErrorHandler(400, "Indikator topilmadi — fayl saqlanmadi");
    assertFieldsDeclared(files, allowed);

    const baseUrl = resolvePublicBaseUrl(req);
    if (!baseUrl) throw new ErrorHandler(400, "Host ruxsat etilmagan");

    const dir = prepareDestination();
    if (!req.body.data || typeof req.body.data !== "object") req.body.data = {};

    files.forEach((file, index) => {
      req.body.data[file.fieldname] = saveFile(file, index, dir, baseUrl);
    });

    return next();
  } catch (err) {
    if (err instanceof ErrorHandler) return next(err);
    return next(new ErrorHandler(400, "Fayllarni saqlashda xatolik", err.message));
  }
};

module.exports = { uploadSubmissionFiles, persistSubmissionFiles };
