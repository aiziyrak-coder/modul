const { ErrorHandler } = require("#shared/error");
const service = require("./orgType.service");

module.exports = {
  create: async (req, res, next) => {
    try {
      const doc = await service.create(req.body);
      if (!doc) return res.status(400).json({ message: "Failed to save" });
      return res.status(201).json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to add org type", err.message));
    }
  },

  findAll: async (req, res, next) => {
    try {
      const filter = service.buildFilter(req.query);
      const docs = await service.findAll(filter);
      return res.status(200).json(docs || []);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find org types", err.message));
    }
  },

  paginate: async (req, res, next) => {
    try {
      const filter = service.buildFilter(req.query);
      const doc = await service.paginate(filter, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to paginate org types", err.message));
    }
  },

  findOne: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find org type", err.message));
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to update org type", err.message));
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to delete org type", err.message));
    }
  },
};
