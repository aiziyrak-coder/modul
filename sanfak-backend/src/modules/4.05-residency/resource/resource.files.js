const path = require("path");

exports.mapResourceFile = (req, res, next) => {
  if (typeof req.body.file === "string" && req.body.file) {
    const f = req.files?.file?.[0];
    req.body.fileUrl = req.body.file;
    req.body.fileName = f?.originalname || null;
    req.body.fileSize = f?.size ?? null;
    req.body.format = f?.originalname
      ? path.extname(f.originalname).replace(".", "").toUpperCase()
      : null;
    delete req.body.file;
  }
  return next();
};
