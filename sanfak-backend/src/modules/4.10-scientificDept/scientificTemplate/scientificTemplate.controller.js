const { ErrorHandler } = require("#shared/error");
const service = require("./scientificTemplate.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const extractPayload = (req) => {
  const { file, ...rest } = req.body;
  const payload = { ...rest };
  if (file) {
    payload.fileUrl = file;
    if (req.fileDetails) {
      payload.fileName = req.fileDetails.name;
      payload.fileSize = `${req.fileDetails.size} ${req.fileDetails.unit}`;
    }
  }
  return payload;
};

module.exports = {
  addTemplate: async (req, res, next) => {
    try {
      const doc = await service.create(req.user, extractPayload(req));
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Namuna qo'shilmadi"));
    }
  },

  findAllTemplates: async (req, res, next) => {
    try {
      const docs = await service.list(req.query);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Namunalar ro'yxati olinmadi"));
    }
  },

  paginateTemplates: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Namunalar sahifasi olinmadi"));
    }
  },

  findOneTemplate: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Namuna topilmadi"));
    }
  },

  updateTemplate: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, extractPayload(req));
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Namuna yangilanmadi"));
    }
  },

  deleteTemplate: async (req, res, next) => {
    try {
      await service.softDelete(req.params.id);
      return res.status(200).json({ message: "Namuna o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Namuna o'chirilmadi"));
    }
  },
};
