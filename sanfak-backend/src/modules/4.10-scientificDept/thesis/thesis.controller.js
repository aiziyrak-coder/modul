const { ErrorHandler } = require("#shared/error");
const service = require("./thesis.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const extractPayload = (body) => {
  const { media, ...rest } = body;
  const uploaded = Array.isArray(media) ? media[0]?.image : undefined;
  if (!rest.fileUrl && uploaded) rest.fileUrl = uploaded;
  return rest;
};

module.exports = {
  addThesis: async (req, res, next) => {
    try {
      const doc = await service.create(req.user, extractPayload(req.body));
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Tezis yuborilmadi"));
    }
  },

  findAllTheses: async (req, res, next) => {
    try {
      const docs = await service.list(req.query, req.scope);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Tezislar ro'yxati olinmadi"));
    }
  },

  paginateTheses: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query, req.scope);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Tezislar sahifasi olinmadi"));
    }
  },

  findOneThesis: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id, req.scope);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Tezis topilmadi"));
    }
  },

  updateThesis: async (req, res, next) => {
    try {
      const doc = await service.update(
        req.user,
        req.params.id,
        extractPayload(req.body),
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Tezis yangilanmadi"));
    }
  },

  deleteThesis: async (req, res, next) => {
    try {
      await service.softDelete(req.params.id);
      return res.status(200).json({ message: "Tezis o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Tezis o'chirilmadi"));
    }
  },

  reviewThesis: async (req, res, next) => {
    try {
      const doc = await service.takeToReview(req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Tezis tekshirishga olinmadi"));
    }
  },

  approveThesis: async (req, res, next) => {
    try {
      const doc = await service.approve(req.user, req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Tezis tasdiqlanmadi"));
    }
  },

  rejectThesis: async (req, res, next) => {
    try {
      const doc = await service.reject(req.user, req.params.id, req.body.reason);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Tezis rad etilmadi"));
    }
  },
};
