const { ErrorHandler } = require("#shared/error");
const QualTopicLecture = require("#modules/4.04-qualification/_shared/qualTopicLecture.model");

module.exports = {
  findAllQualTopicLectures: async (req, res, next) => {
    try {
      const { course, topic } = req.query;
      const query = {};
      if (course) query.course = course;
      if (topic) query.topic = topic;

      const docs = await QualTopicLecture.find(query).sort({ createdAt: 1 }).exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualTopicLectures", err.message),
      );
    }
  },

  addQualTopicLecture: async (req, res, next) => {
    try {
      const payload = { ...req.body };
      if (req.fileDetails?.name) payload.fileName = req.fileDetails.name;
      const doc = await QualTopicLecture.create(payload);
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualTopicLecture", err.message),
      );
    }
  },

  updateQualTopicLecture: async (req, res, next) => {
    try {
      const update = { ...req.body };
      if (req.fileDetails?.name) update.fileName = req.fileDetails.name;
      const doc = await QualTopicLecture.findByIdAndUpdate(req.params.id, update, {
        new: true,
      });

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update qualTopicLecture", err.message),
      );
    }
  },

  deleteQualTopicLecture: async (req, res, next) => {
    try {
      const doc = await QualTopicLecture.findByIdAndDelete(req.params.id);

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualTopicLecture", err.message),
      );
    }
  },
};
