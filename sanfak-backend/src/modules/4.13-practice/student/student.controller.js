const { ErrorHandler } = require("#shared/error");
const service = require("./student.service");

module.exports = {
  create: async (req, res, next) => {
    try {
      const body = service.pick(req.body);
      body.createdBy = req.user._id;
      const doc = await service.create(body);
      if (!doc) return res.status(400).json({ message: "Failed to save" });
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to add student", err.message));
    }
  },

  findAll: async (req, res, next) => {
    try {
      const filter = service.buildFilter(req.query);
      const docs = await service.findAll(filter);
      return res.status(200).json(docs || []);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find students", err.message));
    }
  },

  paginate: async (req, res, next) => {
    try {
      const filter = service.buildFilter(req.query);
      const doc = await service.paginate(filter, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate students", err.message),
      );
    }
  },

  findOne: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find student", err.message));
    }
  },

  update: async (req, res, next) => {
    try {
      const body = service.pick(req.body);
      const doc = await service.update(req.params.id, body);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to update student", err.message));
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to delete student", err.message));
    }
  },

  bulkCourseTransfer: async (req, res, next) => {
    try {
      const { studentIds, toCourse } = req.body;
      const result = await service.bulkCourseTransfer(studentIds, toCourse);
      return res.status(200).json({
        message: "successfully transferred",
        modifiedCount: result.modifiedCount,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to transfer students", err.message),
      );
    }
  },
};
