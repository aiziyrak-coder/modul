const { ErrorHandler } = require("#shared/error");
const service = require("./workDocumentType.service");
const { PAGINATION } = require("#config/constants");
const { parseBool, isTrue } = require("../_shared/queryFlags");

const wrapErr = (err, fallback) =>
  err instanceof ErrorHandler ? err : new ErrorHandler(400, fallback, err.message);

module.exports = {
  addType: async (req, res, next) => {
    try {
      const doc = await service.create(req.body);
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      if (err.code === 11000) {
        return next(
          new ErrorHandler(409, "Bu hujjat kaliti allaqachon mavjud", err.message),
        );
      }
      return next(wrapErr(err, "Hujjat toifasini qo'shishda xatolik"));
    }
  },

  findAllTypes: async (req, res, next) => {
    try {
      const filter = service.buildFilter({
        search: req.query.search,
        active: parseBool(req.query.active),
        all: isTrue(req.query.all),
      });
      const docs = await service.findAll(filter);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Hujjat toifalarini olishda xatolik"));
    }
  },

  paginateTypes: async (req, res, next) => {
    try {
      const filter = service.buildFilter({
        search: req.query.search,
        active: parseBool(req.query.active),
        all: isTrue(req.query.all),
      });
      const docs = await service.paginate(filter, {
        page: req.query.page || PAGINATION.DEFAULT_PAGE,
        limit: req.query.limit || PAGINATION.DEFAULT_LIMIT,
      });
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Hujjat toifalarini olishda xatolik"));
    }
  },

  findOneType: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return next(new ErrorHandler(404, "Hujjat toifasi topilmadi"));
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Hujjat toifasini olishda xatolik"));
    }
  },

  updateType: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      if (!doc) return next(new ErrorHandler(404, "Hujjat toifasi topilmadi"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      if (err.code === 11000) {
        return next(
          new ErrorHandler(409, "Bu hujjat kaliti allaqachon mavjud", err.message),
        );
      }
      return next(wrapErr(err, "Hujjat toifasini yangilashda xatolik"));
    }
  },

  deleteType: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc) return next(new ErrorHandler(404, "Hujjat toifasi topilmadi"));
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(wrapErr(err, "Hujjat toifasini o'chirishda xatolik"));
    }
  },
};
