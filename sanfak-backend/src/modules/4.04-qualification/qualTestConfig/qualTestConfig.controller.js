const { ErrorHandler } = require("#shared/error");
const QualTestConfig = require("./qualTestConfig.model");

module.exports = {
  findQualTestConfig: async (req, res, next) => {
    try {
      const { course, kind, topic } = req.query;
      const doc = await QualTestConfig.findOne({
        course,
        kind: Number(kind),
        topic: topic ?? null,
      }).exec();

      return res.status(200).json(
        doc ?? {
          course,
          kind: Number(kind),
          topic: topic ?? null,
          timeLimit: 10,
          randomCount: 10,
          passPercentage: 60,
        },
      );
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualTestConfig", err.message),
      );
    }
  },

  upsertQualTestConfig: async (req, res, next) => {
    try {
      const { course, kind, topic, timeLimit, randomCount, passPercentage } = req.body;
      const doc = await QualTestConfig.findOneAndUpdate(
        { course, kind: Number(kind), topic: topic ?? null },
        { timeLimit, randomCount, passPercentage },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to save qualTestConfig", err.message),
      );
    }
  },
};
