const { ErrorHandler } = require("#shared/error");
const QualTopicFinalTest = require("#modules/4.04-qualification/_shared/qualTopicFinalTest.model");
const {
  isListenerRequest,
} = require("#modules/4.04-qualification/_shared/listenerContext");

const stripAnswerKeyForListener = (req, docs) => {
  if (!isListenerRequest(req)) return docs;
  const clean = (d) => {
    const o = d && typeof d.toObject === "function" ? d.toObject() : d;
    if (!o || !Array.isArray(o.options)) return o;
    return { ...o, options: o.options.map(({ isCorrect, ...rest }) => rest) };
  };
  return Array.isArray(docs) ? docs.map(clean) : clean(docs);
};

module.exports = {
  findAllQualTopicFinalTests: async (req, res, next) => {
    try {
      const { course, topic } = req.query;
      const query = {};
      if (course) query.course = course;
      if (topic) query.topic = topic;

      const docs = await QualTopicFinalTest.find(query)
        .sort({ order: 1, createdAt: 1 })
        .exec();
      return res.status(200).json(stripAnswerKeyForListener(req, docs));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualTopicFinalTests", err.message),
      );
    }
  },

  paginateQualTopicFinalTests: async (req, res, next) => {
    try {
      const { page, limit, course, topic } = req.query;
      const query = {};
      if (course) query.course = course;
      if (topic) query.topic = topic;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        sort: { order: 1, createdAt: 1 },
      };
      const docs = await QualTopicFinalTest.paginate(query, options);
      docs.docs = stripAnswerKeyForListener(req, docs.docs);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate qualTopicFinalTests", err.message),
      );
    }
  },

  reorderQualTopicFinalTests: async (req, res, next) => {
    try {
      const { items } = req.body;
      const ops = items.map((it) => ({
        updateOne: {
          filter: { _id: it.id },
          update: { $set: { order: it.order } },
        },
      }));
      if (ops.length) await QualTopicFinalTest.bulkWrite(ops);
      return res.status(200).json({ updated: ops.length });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to reorder qualTopicFinalTests",
          err.message,
        ),
      );
    }
  },

  addQualTopicFinalTest: async (req, res, next) => {
    try {
      const order = await QualTopicFinalTest.countDocuments({
        course: req.body.course,
        topic: req.body.topic,
      });
      const doc = await QualTopicFinalTest.create({ ...req.body, order });
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualTopicFinalTest", err.message),
      );
    }
  },

  bulkAddQualTopicFinalTests: async (req, res, next) => {
    try {
      const { course, topic, items } = req.body;
      const baseOrder = await QualTopicFinalTest.countDocuments({ course, topic });
      const docs = items.map((it, i) => ({
        course,
        topic,
        testType: it.testType,
        question: it.question,
        options: it.options,
        order: baseOrder + i,
      }));
      const created = await QualTopicFinalTest.insertMany(docs);
      return res.status(201).json({ created: created.length, docs: created });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to bulk-add qualTopicFinalTests",
          err.message,
        ),
      );
    }
  },

  updateQualTopicFinalTest: async (req, res, next) => {
    try {
      const doc = await QualTopicFinalTest.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update qualTopicFinalTest", err.message),
      );
    }
  },

  deleteQualTopicFinalTest: async (req, res, next) => {
    try {
      const doc = await QualTopicFinalTest.findByIdAndDelete(req.params.id);

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualTopicFinalTest", err.message),
      );
    }
  },
};
