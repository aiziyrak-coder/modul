const { ErrorHandler } = require("#shared/error");
const service = require("./economicContract.service");
const { streamContractArchive } = require("./economicContract.archive");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  addEconomicContract: async (req, res, next) => {
    try {
      const doc = await service.create(req.user, req.body);
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Shartnoma yaratilmadi"));
    }
  },

  findAllEconomicContracts: async (req, res, next) => {
    try {
      const docs = await service.list(req.query, req.scope);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Shartnomalar ro'yxati olinmadi"));
    }
  },

  paginateEconomicContracts: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query, req.scope);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Shartnomalar sahifasi olinmadi"));
    }
  },

  findOneEconomicContract: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id, req.scope);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Shartnoma topilmadi"));
    }
  },

  downloadContractArchive: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id, req.scope);
      return await streamContractArchive(doc, res);
    } catch (err) {
      if (res.headersSent) return undefined;
      return next(wrapErr(err, "Arxivni yuklab bo'lmadi"));
    }
  },

  updateEconomicContract: async (req, res, next) => {
    try {
      const doc = await service.update(req.user, req.params.id, req.body);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Shartnoma yangilanmadi"));
    }
  },

  approveEconomicContract: async (req, res, next) => {
    try {
      const doc = await service.approve(req.user, req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Shartnoma tasdiqlanmadi"));
    }
  },

  rejectEconomicContract: async (req, res, next) => {
    try {
      const doc = await service.reject(req.user, req.params.id, req.body.reason);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Shartnoma rad etilmadi"));
    }
  },

  deleteEconomicContract: async (req, res, next) => {
    try {
      await service.softDelete(req.user, req.params.id);
      return res.status(200).json({ message: "Shartnoma o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Shartnoma o'chirilmadi"));
    }
  },
};
