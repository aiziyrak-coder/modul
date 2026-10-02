const { ErrorHandler } = require("#shared/error");
const QualTopicPractical = require("#modules/4.04-qualification/_shared/qualTopicPractical.model");

module.exports = {
  findAllQualTopicPracticals: async (req, res, next) => {
    try {
      const { course, topic } = req.query;
      const query = {};
      if (course) query.course = course;
      if (topic) query.topic = topic;

      const docs = await QualTopicPractical.find(query).sort({ createdAt: 1 }).exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualTopicPracticals", err.message),
      );
    }
  },

  addQualTopicPractical: async (req, res, next) => {
    try {
      const payload = { ...req.body };
      if (req.fileDetails?.name) payload.fileName = req.fileDetails.name;
      const doc = await QualTopicPractical.create(payload);
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualTopicPractical", err.message),
      );
    }
  },

  updateQualTopicPractical: async (req, res, next) => {
    try {
      const update = { ...req.body };
      if (req.fileDetails?.name) update.fileName = req.fileDetails.name;
      const doc = await QualTopicPractical.findByIdAndUpdate(req.params.id, update, {
        new: true,
      });

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update qualTopicPractical", err.message),
      );
    }
  },

  deleteQualTopicPractical: async (req, res, next) => {
    try {
      const doc = await QualTopicPractical.findByIdAndDelete(req.params.id);

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualTopicPractical", err.message),
      );
    }
  },
};
