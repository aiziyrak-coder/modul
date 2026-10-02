const { ErrorHandler } = require("#shared/error");
const service = require("./thesisCategory.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  addCategory: async (req, res, next) => {
    try {
      const doc = await service.create(req.body);
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Toifa qo'shilmadi"));
    }
  },

  findAllCategories: async (req, res, next) => {
    try {
      const docs = await service.list(req.query);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Toifalar ro'yxati olinmadi"));
    }
  },

  paginateCategories: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Toifalar sahifasi olinmadi"));
    }
  },

  findOneCategory: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Toifa topilmadi"));
    }
  },

  updateCategory: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Toifa yangilanmadi"));
    }
  },

  deleteCategory: async (req, res, next) => {
    try {
      await service.softDelete(req.params.id);
      return res.status(200).json({ message: "Toifa o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Toifa o'chirilmadi"));
    }
  },
};
