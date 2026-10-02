const { ErrorHandler } = require("#shared/error");
const QualTopicVideo = require("#modules/4.04-qualification/_shared/qualTopicVideo.model");

module.exports = {
  findAllQualTopicVideos: async (req, res, next) => {
    try {
      const { course, topic } = req.query;
      const query = {};
      if (course) query.course = course;
      if (topic) query.topic = topic;

      const docs = await QualTopicVideo.find(query).sort({ createdAt: 1 }).exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualTopicVideos", err.message),
      );
    }
  },

  addQualTopicVideo: async (req, res, next) => {
    try {
      const payload = { ...req.body };
      if (req.file?.originalname) payload.fileName = req.file.originalname;
      const doc = await QualTopicVideo.create(payload);
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualTopicVideo", err.message),
      );
    }
  },

  updateQualTopicVideo: async (req, res, next) => {
    try {
      const update = { ...req.body };
      if (req.file?.originalname) update.fileName = req.file.originalname;
      const doc = await QualTopicVideo.findByIdAndUpdate(req.params.id, update, {
        new: true,
      });

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update qualTopicVideo", err.message),
      );
    }
  },

  deleteQualTopicVideo: async (req, res, next) => {
    try {
      const doc = await QualTopicVideo.findByIdAndDelete(req.params.id);

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete qualTopicVideo", err.message),
      );
    }
  },
};
