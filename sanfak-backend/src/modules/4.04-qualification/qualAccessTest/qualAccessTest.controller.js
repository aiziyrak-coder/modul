const { ErrorHandler } = require("#shared/error");
const QualAccessTest = require("#modules/4.04-qualification/_shared/qualAccessTest.model");

module.exports = {
  findAllQualAccessTests: async (req, res, next) => {
    try {
      const { course } = req.query;
      const query = {};
      if (course) query.course = course;

      const docs = await QualAccessTest.find(query)
        .sort({ order: 1, createdAt: 1 })
        .exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualAccessTests", err.message),
      );
    }
  },

  paginateQualAccessTests: async (req, res, next) => {
    try {
      const { page, limit, course } = req.query;
      const query = {};
      if (course) query.course = course;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        sort: { order: 1, createdAt: 1 },
      };
      const docs = await QualAccessTest.paginate(query, options);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate qualAccessTests", err.message),
      );
    }
  },

  reorderQualAccessTests: async (req, res, next) => {
    try {
      const { items } = req.body;
      const ops = items.map((it) => ({
        updateOne: {
          filter: { _id: it.id },
          update: { $set: { order: it.order } },
        },
      }));
      if (ops.length) await QualAccessTest.bulkWrite(ops);
      return res.status(200).json({ updated: ops.length });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to reorder qualAccessTests", err.message),
      );
    }
  },

  addQualAccessTest: async (req, res, next) => {
    try {
      const order = await QualAccessTest.countDocuments({
        course: req.body.course,
      });
      const doc = await QualAccessTest.create({ ...req.body, order });
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualAccessTest", err.message),
      );
    }
  },

  bulkAddQualAccessTests: async (req, res, next) => {
    try {
      const { course, items } = req.body;
      const baseOrder = await QualAccessTest.countDocuments({ course });
      const docs = items.map((it, i) => ({
        course,
        testType: it.testType,
        question: it.question,
        options: it.options,
        order: baseOrder + i,
      }));
      const created = await QualAccessTest.insertMany(docs);
      return res.status(201).json({ created: created.length, docs: created });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to bulk-add qualAccessTests", err.message),
      );
    }
  },

  updateQualAccessTest: async (req, res, next) => {
    try {
      const doc = await QualAccessTest.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update qualAccessTest", err.message),
      );
    }
  },

  deleteQualAccessTest: async (req, res, next) => {
    try {
      const doc = await QualAccessTest.findByIdAndDelete(req.params.id);

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualAccessTest", err.message),
      );
    }
  },
};
