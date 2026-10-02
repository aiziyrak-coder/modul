const { ErrorHandler } = require("#shared/error");
const service = require("./qualifyingApplicant.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  addApplicant: async (req, res, next) => {
    try {
      const doc = await service.create(req.user, req.body);
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ariza qo'shilmadi"));
    }
  },

  findAllApplicants: async (req, res, next) => {
    try {
      const docs = await service.list(req.query, req.user);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Talabgorlar ro'yxati olinmadi"));
    }
  },

  paginateApplicants: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query, req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Talabgorlar sahifasi olinmadi"));
    }
  },

  findOneApplicant: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id, req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Talabgor topilmadi"));
    }
  },

  updateApplicant: async (req, res, next) => {
    try {
      const doc = await service.update(req.user, req.params.id, req.body);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ariza yangilanmadi"));
    }
  },

  approveApplicant: async (req, res, next) => {
    try {
      const doc = await service.approve(req.user, req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ariza tasdiqlanmadi"));
    }
  },

  rejectApplicant: async (req, res, next) => {
    try {
      const doc = await service.reject(req.user, req.params.id, req.body.reason);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ariza rad etilmadi"));
    }
  },

  setExamDate: async (req, res, next) => {
    try {
      const result = await service.setExamDate(
        req.user,
        req.body.ids,
        req.body.examDate,
      );
      return res.status(200).json(result);
    } catch (err) {
      return next(wrapErr(err, "Imtihon sanasi belgilanmadi"));
    }
  },

  setResult: async (req, res, next) => {
    try {
      const doc = await service.setResult(req.user, req.params.id, req.body);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Natija kiritilmadi"));
    }
  },

  resubmitApplicant: async (req, res, next) => {
    try {
      const doc = await service.resubmit(req.user, req.params.id, req.body);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ariza qayta yuborilmadi"));
    }
  },

  deleteApplicant: async (req, res, next) => {
    try {
      await service.softDelete(req.user, req.params.id);
      return res.status(200).json({ message: "Ariza o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Ariza o'chirilmadi"));
    }
  },
};
