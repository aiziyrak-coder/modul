const { ErrorHandler } = require("#shared/error");
const service = require("./scientificPost.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  addPost: async (req, res, next) => {
    try {
      const doc = await service.create(req.user, req.body);
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "E'lon yuborilmadi"));
    }
  },

  findAllPosts: async (req, res, next) => {
    try {
      const docs = await service.list(req.query, req.user);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "E'lonlar ro'yxati olinmadi"));
    }
  },

  paginatePosts: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query, req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "E'lonlar sahifasi olinmadi"));
    }
  },

  findOnePost: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id, req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "E'lon topilmadi"));
    }
  },

  deletePost: async (req, res, next) => {
    try {
      await service.softDelete(req.params.id);
      return res.status(200).json({ message: "E'lon o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "E'lon o'chirilmadi"));
    }
  },
};
