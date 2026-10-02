const meta = (req, field) => {
  const f = req.files?.[field]?.[0];
  return f ? { name: f.originalname || null, size: f.size ?? null } : {};
};

exports.mapCurriculumFiles = (req, res, next) => {
  if (typeof req.body.file === "string" && req.body.file) {
    req.body.processFile = {
      url: req.body.file,
      ...meta(req, "file"),
      uploadedAt: new Date(),
    };
    delete req.body.file;
  }

  if (typeof req.body.planFile === "string" && req.body.planFile) {
    req.body.planFile = {
      url: req.body.planFile,
      ...meta(req, "planFile"),
      uploadedAt: new Date(),
    };
  }

  return next();
};
