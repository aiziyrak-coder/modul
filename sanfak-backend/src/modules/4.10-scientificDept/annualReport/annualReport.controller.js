const { ErrorHandler } = require("#shared/error");
const service = require("./annualReport.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const extractPayload = (body) => {
  const { media, ...rest } = body;
  const uploaded = Array.isArray(media) ? media[0]?.image : undefined;
  if (!rest.fileUrl && uploaded) rest.fileUrl = uploaded;
  return rest;
};

module.exports = {
  addAnnualReport: async (req, res, next) => {
    try {
      const doc = await service.create(req.user, extractPayload(req.body));
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Yillik hisobot yuklanmadi"));
    }
  },

  findAllAnnualReports: async (req, res, next) => {
    try {
      const docs = await service.list(req.query, req.scope);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Yillik hisobotlar ro'yxati olinmadi"));
    }
  },

  paginateAnnualReports: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query, req.scope);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Yillik hisobotlar sahifasi olinmadi"));
    }
  },

  findOneAnnualReport: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id, req.scope);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Yillik hisobot topilmadi"));
    }
  },

  updateAnnualReport: async (req, res, next) => {
    try {
      const doc = await service.update(
        req.user,
        req.params.id,
        extractPayload(req.body),
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Yillik hisobot yangilanmadi"));
    }
  },

  approveAnnualReport: async (req, res, next) => {
    try {
      const doc = await service.approve(req.user, req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Yillik hisobot tasdiqlanmadi"));
    }
  },

  rejectAnnualReport: async (req, res, next) => {
    try {
      const doc = await service.reject(req.user, req.params.id, req.body.reason);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Yillik hisobot rad etilmadi"));
    }
  },
};
