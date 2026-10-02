const { ErrorHandler } = require("#shared/error");
const QualTopicScenario = require("#modules/4.04-qualification/_shared/qualTopicScenario.model");

module.exports = {
  findAllQualTopicScenarios: async (req, res, next) => {
    try {
      const { course, topic } = req.query;
      const query = {};
      if (course) query.course = course;
      if (topic) query.topic = topic;

      const docs = await QualTopicScenario.find(query).sort({ createdAt: 1 }).exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualTopicScenarios", err.message),
      );
    }
  },

  addQualTopicScenario: async (req, res, next) => {
    try {
      const doc = await QualTopicScenario.create(req.body);
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualTopicScenario", err.message),
      );
    }
  },

  updateQualTopicScenario: async (req, res, next) => {
    try {
      const doc = await QualTopicScenario.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update qualTopicScenario", err.message),
      );
    }
  },

  deleteQualTopicScenario: async (req, res, next) => {
    try {
      const doc = await QualTopicScenario.findByIdAndDelete(req.params.id);

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualTopicScenario", err.message),
      );
    }
  },
};
