const { ErrorHandler } = require("#shared/error");
const service = require("./examSpecialty.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  addSpecialty: async (req, res, next) => {
    try {
      const doc = await service.create(req.body, req.user);
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Mutaxassislik qo'shilmadi"));
    }
  },

  findAllSpecialties: async (req, res, next) => {
    try {
      const docs = await service.list(req.query);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Mutaxassisliklar ro'yxati olinmadi"));
    }
  },

  paginateSpecialties: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Mutaxassisliklar sahifasi olinmadi"));
    }
  },

  findOneSpecialty: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Mutaxassislik topilmadi"));
    }
  },

  updateSpecialty: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Mutaxassislik yangilanmadi"));
    }
  },

  deleteSpecialty: async (req, res, next) => {
    try {
      await service.softDelete(req.params.id);
      return res.status(200).json({ message: "Mutaxassislik o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Mutaxassislik o'chirilmadi"));
    }
  },
};
