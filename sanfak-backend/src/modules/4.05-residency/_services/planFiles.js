exports.mapProofFile = (req, res, next) => {
  if (typeof req.body.file === "string" && req.body.file) {
    req.body.fileUrl = req.body.file;
    delete req.body.file;
  }
  return next();
};
