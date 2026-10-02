const { ErrorHandler } = require("#shared/error");
const service = require("./internationalAdmission.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  addApplicant: async (req, res, next) => {
    try {
      const doc = await service.create(req.body);
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ariza qo'shilmadi"));
    }
  },

  findAllApplicants: async (req, res, next) => {
    try {
      const docs = await service.list(req.query);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Arizalar ro'yxati olinmadi"));
    }
  },

  paginateApplicants: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Arizalar sahifasi olinmadi"));
    }
  },

  applicantStats: async (req, res, next) => {
    try {
      const doc = await service.stats(req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Statistika olinmadi"));
    }
  },

  applicantCountries: async (req, res, next) => {
    try {
      const docs = await service.distinctCountries();
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Davlatlar ro'yxati olinmadi"));
    }
  },

  findOneApplicant: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ariza topilmadi"));
    }
  },

  updateApplicant: async (req, res, next) => {
    try {
      await service.update(req.params.id, req.body);
      return res.status(200).json({ message: "Ariza yangilandi" });
    } catch (err) {
      return next(wrapErr(err, "Ariza yangilanmadi"));
    }
  },

  approveApplicant: async (req, res, next) => {
    try {
      await service.approve(req.user, req.params.id);
      return res.status(200).json({ message: "Ariza tasdiqlandi" });
    } catch (err) {
      return next(wrapErr(err, "Ariza tasdiqlanmadi"));
    }
  },

  rejectApplicant: async (req, res, next) => {
    try {
      await service.reject(req.user, req.params.id, req.body.reason);
      return res.status(200).json({ message: "Ariza qaytarildi" });
    } catch (err) {
      return next(wrapErr(err, "Ariza qaytarilmadi"));
    }
  },

  deleteApplicant: async (req, res, next) => {
    try {
      await service.softDelete(req.params.id);
      return res.status(200).json({ message: "Ariza o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Ariza o'chirilmadi"));
    }
  },
};
