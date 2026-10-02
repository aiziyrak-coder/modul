const { ErrorHandler } = require("#shared/error");
const service = require("./medicalOrganization.service");

const dupError = (err) =>
  err && err.code === 11000
    ? new ErrorHandler(409, "Bu STIR allaqachon ro'yxatga olingan", err.message)
    : null;

module.exports = {
  addOrganization: async (req, res, next) => {
    try {
      const body = service.pick(req.body);
      body.createdBy = req.user._id;
      const doc = await service.create(body);
      if (!doc) return res.status(400).json({ message: "Failed to save" });
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(
        dupError(err) ||
          new ErrorHandler(400, "Failed to add medical organization", err.message),
      );
    }
  },

  findAllOrganizations: async (req, res, next) => {
    try {
      const filter = service.buildFilter(req.query);
      const docs = await service.findAll(filter);
      return res.status(200).json(docs || []);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find medical organizations", err.message),
      );
    }
  },

  paginateOrganizations: async (req, res, next) => {
    try {
      const filter = service.buildFilter(req.query);
      const doc = await service.paginate(filter, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to paginate medical organizations",
          err.message,
        ),
      );
    }
  },

  findOneOrganization: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find medical organization", err.message),
      );
    }
  },

  updateOrganization: async (req, res, next) => {
    try {
      const body = service.pick(req.body);
      const doc = await service.update(req.params.id, body);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        dupError(err) ||
          new ErrorHandler(400, "Failed to update medical organization", err.message),
      );
    }
  },

  deleteOrganization: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete medical organization", err.message),
      );
    }
  },
};
