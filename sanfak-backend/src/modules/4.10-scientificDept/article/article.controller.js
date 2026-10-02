const { ErrorHandler } = require("#shared/error");
const service = require("./article.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const extractPayload = (body) => {
  const { media, ...rest } = body;
  const uploaded = Array.isArray(media) ? media[0]?.image : undefined;
  if (!rest.fileUrl && uploaded) rest.fileUrl = uploaded;
  return rest;
};

module.exports = {
  addArticle: async (req, res, next) => {
    try {
      const doc = await service.create(req.user, extractPayload(req.body));
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Maqola yuborilmadi"));
    }
  },

  findAllArticles: async (req, res, next) => {
    try {
      const docs = await service.list(req.query, req.scope);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Maqolalar ro'yxati olinmadi"));
    }
  },

  paginateArticles: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query, req.scope);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Maqolalar sahifasi olinmadi"));
    }
  },

  findOneArticle: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id, req.scope);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Maqola topilmadi"));
    }
  },

  updateArticle: async (req, res, next) => {
    try {
      const doc = await service.update(
        req.user,
        req.params.id,
        extractPayload(req.body),
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Maqola yangilanmadi"));
    }
  },

  deleteArticle: async (req, res, next) => {
    try {
      await service.softDelete(req.params.id);
      return res.status(200).json({ message: "Maqola o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Maqola o'chirilmadi"));
    }
  },

  approveArticle: async (req, res, next) => {
    try {
      const doc = await service.approve(req.user, req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Maqola tasdiqlanmadi"));
    }
  },

  rejectArticle: async (req, res, next) => {
    try {
      const doc = await service.reject(req.user, req.params.id, req.body.reason);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Maqola rad etilmadi"));
    }
  },
};
