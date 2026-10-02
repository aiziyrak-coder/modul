const { ErrorHandler } = require("#shared/error");
const service = require("./conference.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  addConference: async (req, res, next) => {
    try {
      const doc = await service.create(req.user, req.body);
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Konferensiya yaratilmadi"));
    }
  },

  findAllConferences: async (req, res, next) => {
    try {
      const docs = await service.list(req.query, req.scope, req.user);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Konferensiyalar ro'yxati olinmadi"));
    }
  },

  paginateConferences: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query, req.scope, req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Konferensiyalar sahifasi olinmadi"));
    }
  },

  findOneConference: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id, req.scope, req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Konferensiya topilmadi"));
    }
  },

  updateConference: async (req, res, next) => {
    try {
      const doc = await service.update(req.user, req.params.id, req.body);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Konferensiya yangilanmadi"));
    }
  },

  acceptConference: async (req, res, next) => {
    try {
      const doc = await service.accept(req.user, req.params.id, req.body);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Konferensiya qabul qilinmadi"));
    }
  },

  deleteConference: async (req, res, next) => {
    try {
      await service.softDelete(req.user, req.params.id);
      return res.status(200).json({ message: "Konferensiya o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Konferensiya o'chirilmadi"));
    }
  },
};
