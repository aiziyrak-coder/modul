const { ErrorHandler } = require("#shared/error");
const service = require("./councilSpecialty.service");
const CouncilNumber = require("../councilNumber/councilNumber.model");
const numberService = require("../councilNumber/councilNumber.service");
const { PAGINATION } = require("#config/constants");
const { parseBool, isTrue } = require("../_shared/queryFlags");

const wrapErr = (err, fallback) =>
  err instanceof ErrorHandler ? err : new ErrorHandler(400, fallback, err.message);


module.exports = {
  addSpecialty: async (req, res, next) => {
    try {
      const doc = await service.create(req.body);
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      if (err.code === 11000) {
        return next(
          new ErrorHandler(409, "Bu ixtisoslik shifri allaqachon mavjud", err.message),
        );
      }
      return next(wrapErr(err, "Ixtisoslik qo'shishda xatolik"));
    }
  },

  findAllSpecialties: async (req, res, next) => {
    try {
      const filter = service.buildFilter({
        search: req.query.search,
        active: parseBool(req.query.active),
        all: isTrue(req.query.all),
      });
      if (isTrue(req.query.free)) {
        const taken = await numberService.takenSpecialtyIds(req.query.exceptNumber);
        filter._id = { $nin: taken };
      }
      const docs = await service.findAll(filter);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Ixtisosliklarni olishda xatolik"));
    }
  },

  paginateSpecialties: async (req, res, next) => {
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
      return next(wrapErr(err, "Ixtisosliklarni olishda xatolik"));
    }
  },

  findOneSpecialty: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return next(new ErrorHandler(404, "Ixtisoslik topilmadi"));
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ixtisoslikni olishda xatolik"));
    }
  },

  updateSpecialty: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      if (!doc) return next(new ErrorHandler(404, "Ixtisoslik topilmadi"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      if (err.code === 11000) {
        return next(
          new ErrorHandler(409, "Bu ixtisoslik shifri allaqachon mavjud", err.message),
        );
      }
      return next(wrapErr(err, "Ixtisoslikni yangilashda xatolik"));
    }
  },

  deleteSpecialty: async (req, res, next) => {
    try {
      const used = await CouncilNumber.countDocuments({
        specialties: req.params.id,
      });
      if (used > 0) {
        return next(
          new ErrorHandler(
            409,
            `Bu ixtisoslik ${used} ta ilmiy kengash raqamiga biriktirilgan — avval biriktirishni bekor qiling`,
          ),
        );
      }
      const doc = await service.remove(req.params.id);
      if (!doc) return next(new ErrorHandler(404, "Ixtisoslik topilmadi"));
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(wrapErr(err, "Ixtisoslikni o'chirishda xatolik"));
    }
  },
};
