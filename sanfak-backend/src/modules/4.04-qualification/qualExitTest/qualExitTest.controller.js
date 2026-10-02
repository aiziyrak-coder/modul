const { ErrorHandler } = require("#shared/error");
const QualExitTest = require("#modules/4.04-qualification/_shared/qualExitTest.model");

module.exports = {
  findAllQualExitTests: async (req, res, next) => {
    try {
      const { course } = req.query;
      const query = {};
      if (course) query.course = course;

      const docs = await QualExitTest.find(query)
        .sort({ order: 1, createdAt: 1 })
        .exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualExitTests", err.message),
      );
    }
  },

  paginateQualExitTests: async (req, res, next) => {
    try {
      const { page, limit, course } = req.query;
      const query = {};
      if (course) query.course = course;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        sort: { order: 1, createdAt: 1 },
      };
      const docs = await QualExitTest.paginate(query, options);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate qualExitTests", err.message),
      );
    }
  },

  reorderQualExitTests: async (req, res, next) => {
    try {
      const { items } = req.body;
      const ops = items.map((it) => ({
        updateOne: {
          filter: { _id: it.id },
          update: { $set: { order: it.order } },
        },
      }));
      if (ops.length) await QualExitTest.bulkWrite(ops);
      return res.status(200).json({ updated: ops.length });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to reorder qualExitTests", err.message),
      );
    }
  },

  addQualExitTest: async (req, res, next) => {
    try {
      const order = await QualExitTest.countDocuments({
        course: req.body.course,
      });
      const doc = await QualExitTest.create({ ...req.body, order });
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualExitTest", err.message),
      );
    }
  },

  bulkAddQualExitTests: async (req, res, next) => {
    try {
      const { course, items } = req.body;
      const baseOrder = await QualExitTest.countDocuments({ course });
      const docs = items.map((it, i) => ({
        course,
        testType: it.testType,
        question: it.question,
        options: it.options,
        order: baseOrder + i,
      }));
      const created = await QualExitTest.insertMany(docs);
      return res.status(201).json({ created: created.length, docs: created });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to bulk-add qualExitTests", err.message),
      );
    }
  },

  updateQualExitTest: async (req, res, next) => {
    try {
      const doc = await QualExitTest.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update qualExitTest", err.message),
      );
    }
  },

  deleteQualExitTest: async (req, res, next) => {
    try {
      const doc = await QualExitTest.findByIdAndDelete(req.params.id);

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualExitTest", err.message),
      );
    }
  },
};
