const { ErrorHandler } = require("#shared/error");
const service = require("./methodicalRecommendation.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const buildEri = (req) => {
  if (req.eri) {
    return {
      signedAt: req.eri.signedAt || new Date(),
      serialNumber: req.eri.serialNumber,
      signature: req.eri.signature,
    };
  }
  return {
    signedAt: new Date(),
    serialNumber: req.body.eriKey || null,
    signature: req.body.eriSignature || null,
  };
};

module.exports = {
  addMethodical: async (req, res, next) => {
    try {
      const doc = await service.create(req.user, req.body);
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Uslubiy tavsiyanoma yuborilmadi"));
    }
  },

  findAllMethodicals: async (req, res, next) => {
    try {
      const docs = await service.list(req.query, req.scope, req.user);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Tavsiyanomalar ro'yxati olinmadi"));
    }
  },

  paginateMethodicals: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query, req.scope, req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Tavsiyanomalar sahifasi olinmadi"));
    }
  },

  findOneMethodical: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id, req.scope, req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Tavsiyanoma topilmadi"));
    }
  },

  updateMethodical: async (req, res, next) => {
    try {
      const doc = await service.update(req.user, req.params.id, req.body);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Tavsiyanoma yangilanmadi"));
    }
  },

  approveMethodical: async (req, res, next) => {
    try {
      const doc = await service.ilmiyApprove(req.user, req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Tavsiyanoma tasdiqlanmadi"));
    }
  },

  signMethodical: async (req, res, next) => {
    try {
      const doc = await service.sign(
        req.user,
        req.params.id,
        req.body,
        buildEri(req),
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "E-imzo bajarilmadi"));
    }
  },

  rejectMethodical: async (req, res, next) => {
    try {
      const doc = await service.reject(req.user, req.params.id, req.body.reason);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Tavsiyanoma rad etilmadi"));
    }
  },

  deleteMethodical: async (req, res, next) => {
    try {
      await service.softDelete(req.params.id);
      return res.status(200).json({ message: "Tavsiyanoma o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Tavsiyanoma o'chirilmadi"));
    }
  },
};
