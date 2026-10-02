const path = require("path");

const MAX_FILE_MB = 30;
const MAX_SIZE = MAX_FILE_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".jpg", ".jpeg", ".png"];

const taskFileGuard = (req, res, next) => {
  const files = req.files?.files || [];

  for (const file of files) {
    const ext = path.extname(file.originalname || "").toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({
        message: `Ruxsat etilmagan fayl turi: ${ext || "noma'lum"}. Faqat: ${ALLOWED_EXTENSIONS.join(", ")}`,
      });
    }

    if (file.size > MAX_SIZE) {
      return res.status(400).json({
        message: `Fayl hajmi ${MAX_FILE_MB}MB dan oshmasligi kerak: ${file.originalname}`,
      });
    }
  }

  return next();
};

module.exports = { taskFileGuard, MAX_SIZE, MAX_FILE_MB, ALLOWED_EXTENSIONS };
