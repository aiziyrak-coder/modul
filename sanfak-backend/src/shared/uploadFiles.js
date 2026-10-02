const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "../../.env"),
});
const fs = require("fs");
const multer = require("multer");
const { FILE_LIMITS } = require("../config/constants");
const { appendSignature } = require("./fileAccess");
const { resolvePublicBaseUrl } = require("./publicBaseUrl");
const { ErrorHandler } = require("./error");

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.fieldname === "content") {
    file.originalname = `${file.originalname}.txt`;
    file.mimetype = "text/plain";
  }

  if (FILE_LIMITS.ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Fayl turi qo'llab-quvvatlanmaydi! Ruxsat etilgan turlar: ${FILE_LIMITS.ALLOWED_EXTENSIONS.join(", ")}`,
      ),
      false,
    );
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: {
    fileSize: FILE_LIMITS.MAX_SIZE,
  },
});

const uploadFields = upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "files", maxCount: 10 },
  { name: "bachelorDegree", maxCount: 10 },
  { name: "masterDegree", maxCount: 10 },
  { name: "scientificDegree", maxCount: 10 },
  { name: "scientificTitle", maxCount: 10 },
  { name: "file", maxCount: 1 },
  { name: "planFile", maxCount: 1 },
  { name: "content", maxCount: 1 },
]);

exports.uploadImages = async (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res
          .status(400)
          .json({ message: `Kutilmagan fayl maydoni: ${err.field}` });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: `Fayl hajmi ${FILE_LIMITS.MAX_SIZE / (1024 * 1024)}MB dan oshmasligi kerak`,
        });
      }
      return res.status(400).json({ message: `Multer xatosi: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message || err });
    }

    next();
  });
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const resolveUploadFolder = (req) => {
  const SKIP = ["api", "v1", "v2", "v3", "upload", "uploads"];

  const segments = (req.baseUrl + req.path)
    .split("/")
    .filter(Boolean)
    .filter((seg) => !isNaN(seg) === false)
    .filter((seg) => !SKIP.includes(seg.toLowerCase()));

  return (segments[0] || "uploads").toLowerCase().trim();
};

const buildFileUrl = (req, relativePath) => {
  const baseUrl = resolvePublicBaseUrl(req);
  if (!baseUrl) {
    throw new ErrorHandler(400, "Host ruxsat etilmagan");
  }
  return appendSignature(`${baseUrl}/files/${relativePath}`);
};

const isAllowedExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return FILE_LIMITS.ALLOWED_EXTENSIONS.includes(ext);
};

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return { value: bytes, unit: "B" };
  } else if (bytes < 1024 * 1024) {
    return { value: +(bytes / 1024).toFixed(2), unit: "KB" };
  } else if (bytes < 1024 * 1024 * 1024) {
    return { value: +(bytes / (1024 * 1024)).toFixed(2), unit: "MB" };
  } else {
    return { value: +(bytes / (1024 * 1024 * 1024)).toFixed(2), unit: "GB" };
  }
}

exports.resizeImages = async (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) return next();

  const folderPath = process.env.FILEPATH;
  if (!folderPath) {
    return res
      .status(500)
      .json({ message: "FILEPATH muhit o'zgaruvchisi sozlanmagan" });
  }

  const folderName = resolveUploadFolder(req);

  const fieldToFolder = {
    files: "images",
    photo: "photo",
    file: "file",
    planFile: "planFile",
    content: "content",
  };

  try {
    ensureDir(`${folderPath}uploads`);
    Object.keys(req.files).forEach((field) => {
      const sub = fieldToFolder[field];
      if (sub) {
        ensureDir(`${folderPath}uploads/${sub}`);
        ensureDir(`${folderPath}uploads/${sub}/${folderName}`);
      }
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: `Fayl tizimida xatolik: ${err.message}` });
  }

  try {
    if (req.files["files"]) {
      req.body.media = [];

      await Promise.all(
        req.files["files"].map(async (file, index) => {
          const ext = path.extname(file.originalname).toLowerCase() || ".jpg";

          if (!isAllowedExtension(file.originalname)) {
            throw new Error(
              `Ruxsat etilmagan fayl kengaytmasi: ${ext}. Ruxsat etilganlar: ${FILE_LIMITS.ALLOWED_EXTENSIONS.join(", ")}`,
            );
          }

          const uniqueName = `${Date.now()}${index}${ext}`;
          const destPath = `${folderPath}uploads/images/${folderName}/${uniqueName}`;

          fs.writeFileSync(destPath, file.buffer);

          req.body.media.push({
            image: buildFileUrl(req, `images/${folderName}/${uniqueName}`),
          });
        }),
      );
    }

    if (req.files["bachelorDegree"]) {
      req.body.degrees = req.body.degrees || {};
      req.body.degrees.bachelorDegree = [];

      await Promise.all(
        req.files["bachelorDegree"].map(async (file, index) => {
          const ext = path.extname(file.originalname).toLowerCase() || ".jpg";

          if (!isAllowedExtension(file.originalname)) {
            throw new Error(
              `Ruxsat etilmagan fayl kengaytmasi: ${ext}. Ruxsat etilganlar: ${FILE_LIMITS.ALLOWED_EXTENSIONS.join(", ")}`
            );
          }

          const uniqueName = `${Date.now()}${index}${ext}`;
          const destPath = `${folderPath}uploads/bachelor/${uniqueName}`;

          await fs.promises.mkdir(
            `${folderPath}uploads/bachelor`,
            { recursive: true }
          );

          fs.writeFileSync(destPath, file.buffer);

          req.body.degrees.bachelorDegree.push({
            title: file.originalname,
            path: buildFileUrl(req, `bachelor/${uniqueName}`)
          });
        })
      );
    }

    if (req.files["masterDegree"]) {
      req.body.degrees = req.body.degrees || {};
      req.body.degrees.masterDegree = [];

      await Promise.all(
        req.files["masterDegree"].map(async (file, index) => {
          const ext = path.extname(file.originalname).toLowerCase() || ".jpg";

          if (!isAllowedExtension(file.originalname)) {
            throw new Error(
              `Ruxsat etilmagan fayl kengaytmasi: ${ext}. Ruxsat etilganlar: ${FILE_LIMITS.ALLOWED_EXTENSIONS.join(", ")}`
            );
          }

          const uniqueName = `${Date.now()}${index}${ext}`;
          const destPath = `${folderPath}uploads/master/${uniqueName}`;

          await fs.promises.mkdir(
            `${folderPath}uploads/master`,
            { recursive: true }
          );

          fs.writeFileSync(destPath, file.buffer);

          req.body.degrees.masterDegree.push({
            title: file.originalname,
            path: buildFileUrl(req, `master/${uniqueName}`)
          });
        })
      );
    }

    if (req.files["scientificDegree"]) {
      req.body.degrees = req.body.degrees || {};
      req.body.degrees.scientificDegree = [];

      await Promise.all(
        req.files["scientificDegree"].map(async (file, index) => {
          const ext = path.extname(file.originalname).toLowerCase() || ".jpg";

          if (!isAllowedExtension(file.originalname)) {
            throw new Error(
              `Ruxsat etilmagan fayl kengaytmasi: ${ext}. Ruxsat etilganlar: ${FILE_LIMITS.ALLOWED_EXTENSIONS.join(", ")}`
            );
          }

          const uniqueName = `${Date.now()}${index}${ext}`;
          const destPath = `${folderPath}uploads/scientific/${uniqueName}`;

          await fs.promises.mkdir(
            `${folderPath}uploads/scientific`,
            { recursive: true }
          );

          fs.writeFileSync(destPath, file.buffer);

          req.body.degrees.scientificDegree.push({
            title: file.originalname,
            path: buildFileUrl(req, `scientific/${uniqueName}`)
          });
        })
      );
    }

    if (req.files["scientificTitle"]) {
      req.body.degrees = req.body.degrees || {};
      req.body.degrees.scientificTitle = [];

      await Promise.all(
        req.files["scientificTitle"].map(async (file, index) => {
          const ext = path.extname(file.originalname).toLowerCase() || ".jpg";

          if (!isAllowedExtension(file.originalname)) {
            throw new Error(
              `Ruxsat etilmagan fayl kengaytmasi: ${ext}. Ruxsat etilganlar: ${FILE_LIMITS.ALLOWED_EXTENSIONS.join(", ")}`
            );
          }

          const uniqueName = `${Date.now()}${index}${ext}`;
          const destPath = `${folderPath}uploads/rank/${uniqueName}`;

          await fs.promises.mkdir(
            `${folderPath}uploads/rank`,
            { recursive: true }
          );

          fs.writeFileSync(destPath, file.buffer);

          req.body.degrees.scientificTitle.push({
            title: file.originalname,
            path: buildFileUrl(req, `rank/${uniqueName}`)
          });
        })
      );
    }


    if (req.files["photo"]) {
      const file = req.files["photo"][0];
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";

      if (!isAllowedExtension(file.originalname)) {
        return res.status(400).json({
          message: `Ruxsat etilmagan fayl kengaytmasi: ${ext}. Ruxsat etilganlar: ${FILE_LIMITS.ALLOWED_EXTENSIONS.join(", ")}`,
        });
      }

      const uniqueName = `${Date.now()}${ext}`;
      const destPath = `${folderPath}uploads/photo/${folderName}/${uniqueName}`;

      fs.writeFileSync(destPath, file.buffer);
      if(folderName == "countries"){
        req.body.flag = buildFileUrl(req, `photo/${folderName}/${uniqueName}`);
      }

      req.body.photo = buildFileUrl(req, `photo/${folderName}/${uniqueName}`);
    }

    if (req.files["file"]) {
      const file = req.files["file"][0];

      if (!isAllowedExtension(file.originalname)) {
        const ext = path.extname(file.originalname).toLowerCase();
        return res.status(400).json({
          message: `Ruxsat etilmagan fayl kengaytmasi: ${ext}. Ruxsat etilganlar: ${FILE_LIMITS.ALLOWED_EXTENSIONS.join(", ")}`,
        });
      }

      const formattedSize = formatFileSize(file.size);

      req.fileDetails = {
        name: file.originalname,
        size: formattedSize.value,
        unit: formattedSize.unit,
      };

      const safeName = file.originalname
        .toLowerCase()
        .trim()
        .replace(/['"]+/g, "")
        .replace(/\s+/g, "-");
      const ext = path.extname(safeName) || ".pdf";
      const uniqueName = `${Date.now()}${ext}`;
      const destPath = `${folderPath}uploads/file/${folderName}/${uniqueName}`;

      fs.writeFileSync(destPath, file.buffer);

      req.body.file = buildFileUrl(req, `file/${folderName}/${uniqueName}`);
    }

    if (req.files["planFile"]) {
      const file = req.files["planFile"][0];

      if (!isAllowedExtension(file.originalname)) {
        const ext = path.extname(file.originalname).toLowerCase();
        return res.status(400).json({
          message: `Ruxsat etilmagan fayl kengaytmasi: ${ext}. Ruxsat etilganlar: ${FILE_LIMITS.ALLOWED_EXTENSIONS.join(", ")}`,
        });
      }

      const safeName = file.originalname
        .toLowerCase()
        .trim()
        .replace(/['"]+/g, "")
        .replace(/\s+/g, "-");
      const ext = path.extname(safeName) || ".pdf";
      const uniqueName = `${Date.now()}${ext}`;
      const destPath = `${folderPath}uploads/file/${folderName}/${uniqueName}`;

      fs.writeFileSync(destPath, file.buffer);

      req.body.planFile = buildFileUrl(req, `file/${folderName}/${uniqueName}`);
    }

    if (req.files["content"]) {
      const file = req.files["content"][0];
      const ext = path.extname(file.originalname) || ".txt";
      const uniqueName = `${Date.now()}${ext}`;
      const destPath = `${folderPath}uploads/content/${folderName}/${uniqueName}`;

      fs.writeFileSync(destPath, file.buffer);

      req.body.biography = destPath;
    }

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
