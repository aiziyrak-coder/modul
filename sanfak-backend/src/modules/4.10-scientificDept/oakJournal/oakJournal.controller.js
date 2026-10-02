const { ErrorHandler } = require("#shared/error");
const service = require("./oakJournal.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  addJournal: async (req, res, next) => {
    try {
      const doc = await service.create(req.body);
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Jurnal qo'shilmadi"));
    }
  },

  findAllJournals: async (req, res, next) => {
    try {
      const docs = await service.list(req.query);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Jurnallar ro'yxati olinmadi"));
    }
  },

  paginateJournals: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Jurnallar sahifasi olinmadi"));
    }
  },

  findOneJournal: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Jurnal topilmadi"));
    }
  },

  updateJournal: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Jurnal yangilanmadi"));
    }
  },

  deleteJournal: async (req, res, next) => {
    try {
      await service.softDelete(req.params.id);
      return res.status(200).json({ message: "Jurnal o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Jurnal o'chirilmadi"));
    }
  },
};
