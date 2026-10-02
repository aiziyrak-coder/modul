const { ErrorHandler } = require("#shared/error");
const service = require("./departmentWorkPlan.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const extractPayload = (body) => {
  const { media, ...rest } = body;
  const uploaded = Array.isArray(media) ? media[0]?.image : undefined;
  if (!rest.fileUrl && uploaded) rest.fileUrl = uploaded;
  return rest;
};

module.exports = {
  addDepartmentWorkPlan: async (req, res, next) => {
    try {
      const doc = await service.create(req.user, extractPayload(req.body));
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ish reja yuklanmadi"));
    }
  },

  findAllDepartmentWorkPlans: async (req, res, next) => {
    try {
      const docs = await service.list(req.query, req.scope);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Ish rejalar ro'yxati olinmadi"));
    }
  },

  paginateDepartmentWorkPlans: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query, req.scope);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ish rejalar sahifasi olinmadi"));
    }
  },

  findOneDepartmentWorkPlan: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id, req.scope);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ish reja topilmadi"));
    }
  },

  updateDepartmentWorkPlan: async (req, res, next) => {
    try {
      const doc = await service.update(
        req.user,
        req.params.id,
        extractPayload(req.body),
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ish reja yangilanmadi"));
    }
  },

  approveDepartmentWorkPlan: async (req, res, next) => {
    try {
      const doc = await service.approve(req.user, req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ish reja tasdiqlanmadi"));
    }
  },

  rejectDepartmentWorkPlan: async (req, res, next) => {
    try {
      const doc = await service.reject(req.user, req.params.id, req.body.reason);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ish reja rad etilmadi"));
    }
  },
};
