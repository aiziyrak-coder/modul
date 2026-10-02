const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { appendSignature } = require("#shared/fileAccess");
const { resolvePublicBaseUrl } = require("#shared/publicBaseUrl");
const { ErrorHandler } = require("#shared/error");

const VIDEO_MAX_SIZE = 200 * 1024 * 1024;
const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VIDEO_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (VIDEO_TYPES.includes(file.mimetype)) cb(null, true);
    else
      cb(
        new Error("Faqat video fayl (mp4, webm, ogg, mov, avi, mkv) yuklash mumkin"),
        false,
      );
  },
}).single("videoRaw");

const ensureDir = (p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};

exports.uploadVideo = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: `Video hajmi ${VIDEO_MAX_SIZE / (1024 * 1024)}MB dan oshmasligi kerak`,
        });
      }
      return res.status(400).json({ message: `Multer xatosi: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message || String(err) });
    }
    next();
  });
};

exports.saveVideo = (req, res, next) => {
  if (!req.file) return next();

  const folderPath = process.env.FILEPATH;
  if (!folderPath) {
    return res
      .status(500)
      .json({ message: "FILEPATH muhit o'zgaruvchisi sozlanmagan" });
  }

  try {
    const dir = `${folderPath}uploads/video/qualification-topic-videos`;
    ensureDir(dir);

    const ext = path.extname(req.file.originalname) || ".mp4";
    const uniqueName = `${Date.now()}${ext}`;
    fs.writeFileSync(`${dir}/${uniqueName}`, req.file.buffer);

    const baseUrl = resolvePublicBaseUrl(req);
    if (!baseUrl) {
      throw new ErrorHandler(400, "Host ruxsat etilmagan");
    }
    req.body.videoRaw = appendSignature(
      `${baseUrl}/files/video/qualification-topic-videos/${uniqueName}`,
    );
    return next();
  } catch (e) {
    if (e instanceof ErrorHandler) {
      return res.status(e.statusCode).json({ message: e.message });
    }
    return res
      .status(500)
      .json({ message: `Video saqlashda xatolik: ${e.message}` });
  }
};
