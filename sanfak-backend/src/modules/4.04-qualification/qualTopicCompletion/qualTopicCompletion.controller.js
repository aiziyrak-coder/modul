const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { ErrorHandler } = require("#shared/error");
const QualTopicCompletionModel = require("./qualTopicCompletion.model");
const QualTopicModel = require("#modules/4.04-qualification/qualTopic/qualTopic.model");
const QualListenerModel = require("#modules/4.04-qualification/_shared/qualListener.model");
const QualFinalTestResultModel = require("#modules/4.04-qualification/qualFinalTestResult/qualFinalTestResult.model");
const QualAccessTestResultModel = require("#modules/4.04-qualification/qualAccessTestResult/qualAccessTestResult.model");
const QualTestConfig = require("#modules/4.04-qualification/qualTestConfig/qualTestConfig.model");
const {
  getListenerId,
  listenerScope,
} = require("#modules/4.04-qualification/_shared/listenerContext");
const {
  paymentStatus,
  LOCK_MESSAGE,
} = require("#modules/4.04-qualification/_shared/paymentGate");

module.exports = {
  submitScenario: async (req, res, next) => {
    try {
      const { course, topic, answer, file } = req.body;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(403).json({ message: "Tinglovchi topilmadi!" });
      }

      const topicDoc = await QualTopicModel.findOne({ _id: topic, course })
        .select("_id")
        .lean();
      if (!topicDoc) {
        return res.status(404).json({ message: "Mavzu topilmadi!" });
      }

      const set = {};
      if (answer !== undefined) set.scenarioAnswer = answer;
      if (file !== undefined) set.scenarioImage = file;

      const doc = await QualTopicCompletionModel.findOneAndUpdate(
        { course, topic, listener: listenerId },
        { $set: set, $setOnInsert: { startedAt: new Date(), status: 4 } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      return res.status(200).json({
        scenarioAnswer: doc.scenarioAnswer || null,
        scenarioImage: doc.scenarioImage || null,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to submit scenario", err.message));
    }
  },

  findAllMasteries: async (req, res, next) => {
    try {
      const { course } = req.query;
      const matchStage = { ...(await listenerScope(req, "listener")) };

      if (course) matchStage.course = new ObjectId(course);

      const pipeline = [
        { $match: matchStage },

        {
          $lookup: {
            from: QualTopicModel.collection.name,
            localField: "topic",
            foreignField: "_id",
            as: "topic",
          },
        },
        { $unwind: { path: "$topic", preserveNullAndEmptyArrays: true } },

        { $sort: { "topic.orderNumber": 1 } },

        {
          $project: {
            listener: 1,
            topicData: {
              title: "$topic.title",
              duration: "$topic.duration",
              status: "$status",
              isLocked: "$isLocked",
            },
          },
        },

        {
          $group: {
            _id: "$listener",
            topics: { $push: "$topicData" },
          },
        },

        {
          $lookup: {
            from: QualListenerModel.collection.name,
            localField: "_id",
            foreignField: "_id",
            as: "listener",
          },
        },
        { $unwind: { path: "$listener", preserveNullAndEmptyArrays: true } },

        { $project: { listener: 1, topics: 1 } },
      ];

      const docs = await QualTopicCompletionModel.aggregate(pipeline);

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to find qualTopicCompletions",
          err.message,
        ),
      );
    }
  },

  paginateMasteries: async (req, res, next) => {
    try {
      const { course, page, limit } = req.query;
      const matchStage = { ...(await listenerScope(req, "listener")) };

      if (course) {
        matchStage.course = new ObjectId(course);
      }

      const pipeline = [
        { $match: matchStage },

        {
          $lookup: {
            from: QualTopicModel.collection.name,
            localField: "topic",
            foreignField: "_id",
            as: "topic",
          },
        },
        { $unwind: { path: "$topic", preserveNullAndEmptyArrays: true } },

        { $sort: { "topic.orderNumber": 1 } },

        {
          $project: {
            listener: 1,
            topicData: {
              title: "$topic.title",
              duration: "$topic.duration",
              status: "$status",
              isLocked: "$isLocked",
            },
          },
        },

        {
          $group: {
            _id: "$listener",
            topics: { $push: "$topicData" },
          },
        },

        {
          $lookup: {
            from: QualListenerModel.collection.name,
            localField: "_id",
            foreignField: "_id",
            as: "listener",
          },
        },
        { $unwind: { path: "$listener", preserveNullAndEmptyArrays: true } },

        { $project: { listener: 1, topics: 1 } },
      ];

      const aggregate = QualTopicCompletionModel.aggregate(pipeline);

      const options = {
        useFacet: false,
        page: parseInt(page),
        limit: parseInt(limit),
      };

      const docs = await QualTopicCompletionModel.aggregatePaginate(
        aggregate,
        options,
      );

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to paginate qualTopicCompletions",
          err.message,
        ),
      );
    }
  },

  masteryGrid: async (req, res, next) => {
    try {
      const { course, page, limit } = req.query;
      const courseId = new ObjectId(course);

      const topics = await QualTopicModel.find({ course: courseId })
        .select("title orderNumber duration")
        .sort({ orderNumber: 1 })
        .lean();
      const totalTopics = topics.length;
      const topicIdSet = new Set(topics.map((tp) => String(tp._id)));

      const scope = await listenerScope(req, "listener");
      const pipeline = [
        { $match: { course: courseId, ...scope } },
        {
          $group: {
            _id: { listener: "$listener", topic: "$topic" },
            passed: { $max: { $cond: ["$isPassed", 1, 0] } },
          },
        },
        {
          $group: {
            _id: "$_id.listener",
            topics: { $push: { topic: "$_id.topic", passed: "$passed" } },
          },
        },
        {
          $lookup: {
            from: QualListenerModel.collection.name,
            localField: "_id",
            foreignField: "_id",
            as: "listener",
          },
        },
        { $unwind: { path: "$listener", preserveNullAndEmptyArrays: true } },
        { $project: { listenerName: "$listener.fullName", topics: 1 } },
        { $sort: { listenerName: 1 } },
      ];

      const aggregate = QualFinalTestResultModel.aggregate(pipeline);
      const result = await QualFinalTestResultModel.aggregatePaginate(aggregate, {
        useFacet: false,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      });

      const rows = result.docs.map((d) => {
        const passedTopicIds = (d.topics || [])
          .filter((x) => x.passed && topicIdSet.has(String(x.topic)))
          .map((x) => String(x.topic));
        return {
          listener: d._id,
          listenerName: d.listenerName || "—",
          passedTopicIds,
          percent:
            totalTopics > 0
              ? Math.round((passedTopicIds.length / totalTopics) * 100)
              : 0,
        };
      });

      return res.status(200).json({
        topics,
        docs: rows,
        page: result.page,
        limit: result.limit,
        totalDocs: result.totalDocs,
        totalPages: result.totalPages,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to build mastery grid", err.message),
      );
    }
  },

  getMyProgress: async (req, res, next) => {
    try {
      const { course } = req.query;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(200).json({ entranceDone: false, topics: [] });
      }

      const topics = await QualTopicModel.find({ course })
        .select("title orderNumber duration finalTest")
        .sort({ orderNumber: 1 })
        .lean();

      const completions = await QualTopicCompletionModel.find({
        course,
        listener: listenerId,
      }).lean();
      const compByTopic = new Map(
        completions.map((c) => [String(c.topic), c]),
      );

      const passed = await QualFinalTestResultModel.find({
        course,
        listener: listenerId,
        isPassed: true,
      })
        .select("topic")
        .lean();
      const passedSet = new Set(passed.map((p) => String(p.topic)));

      const entrance = await QualAccessTestResultModel.findOne({
        course,
        listener: listenerId,
        status: 2,
      })
        .select("_id")
        .lean();
      const entranceDone = !!entrance;

      const finalCfgs = await QualTestConfig.find({ course, kind: 3 })
        .select("topic passPercentage")
        .lean();
      const passByTopic = new Map(
        finalCfgs
          .filter((c) => c.topic)
          .map((c) => [String(c.topic), c.passPercentage]),
      );

      let prevCompleted = entranceDone;
      const out = topics.map((tp) => {
        const comp = compByTopic.get(String(tp._id)) || null;
        const isCompleted = passedSet.has(String(tp._id));
        const unlocked = prevCompleted;
        const status = comp ? comp.status : 0;
        const startedAt = comp ? comp.startedAt : null;
        const durationMs = (tp.duration || 0) * 60 * 60 * 1000;
        const finalTestAvailableAt = startedAt
          ? new Date(new Date(startedAt).getTime() + durationMs)
          : null;
        const progressPercent = isCompleted
          ? 100
          : status > 0
            ? Math.round(((status - 1) / 5) * 100)
            : 0;
        prevCompleted = isCompleted;
        return {
          id: String(tp._id),
          title: tp.title,
          orderNumber: tp.orderNumber,
          duration: tp.duration,
          status,
          isLocked: !unlocked,
          isCompleted,
          progressPercent,
          startedAt,
          finalTestAvailableAt,
          passPercentage: passByTopic.has(String(tp._id))
            ? passByTopic.get(String(tp._id))
            : (tp.finalTest && tp.finalTest.passPercentage) || 50,
        };
      });

      return res.status(200).json({ entranceDone, topics: out });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get my topic progress", err.message),
      );
    }
  },

  startTopic: async (req, res, next) => {
    try {
      const { course, topic } = req.body;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(403).json({ message: "Tinglovchi topilmadi!" });
      }

      const gate = await paymentStatus(listenerId, course);
      if (gate.locked) {
        return res.status(402).json({ message: LOCK_MESSAGE, dueAt: gate.dueAt });
      }

      const topicDoc = await QualTopicModel.findOne({ _id: topic, course })
        .select("orderNumber")
        .lean();
      if (!topicDoc) {
        return res.status(404).json({ message: "Mavzu topilmadi!" });
      }

      const entrance = await QualAccessTestResultModel.findOne({
        course,
        listener: listenerId,
        status: 2,
      })
        .select("_id")
        .lean();
      if (!entrance) {
        return res.status(400).json({ message: "Avval kirish testini yakunlang!" });
      }

      if (topicDoc.orderNumber > 1) {
        const prevTopic = await QualTopicModel.findOne({
          course,
          orderNumber: { $lt: topicDoc.orderNumber },
        })
          .sort({ orderNumber: -1 })
          .select("_id")
          .lean();
        if (prevTopic) {
          const prevPassed = await QualFinalTestResultModel.findOne({
            course,
            topic: prevTopic._id,
            listener: listenerId,
            isPassed: true,
          })
            .select("_id")
            .lean();
          if (!prevPassed) {
            return res
              .status(400)
              .json({ message: "Oldingi mavzuni yakunlang!" });
          }
        }
      }

      let comp = await QualTopicCompletionModel.findOne({
        course,
        topic,
        listener: listenerId,
      });
      if (!comp) {
        comp = await QualTopicCompletionModel.create({
          course,
          topic,
          listener: listenerId,
          startedAt: new Date(),
          status: 1,
          isLocked: false,
        });
      }

      return res.status(200).json({ data: comp });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to start topic", err.message),
      );
    }
  },

  advanceTopic: async (req, res, next) => {
    try {
      const { course, topic } = req.body;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(403).json({ message: "Tinglovchi topilmadi!" });
      }

      const comp = await QualTopicCompletionModel.findOne({
        course,
        topic,
        listener: listenerId,
      });
      if (!comp) {
        return res.status(404).json({ message: "Mavzu boshlanmagan!" });
      }

      if (comp.status < 5) {
        comp.status = comp.status + 1;
        await comp.save();
      }

      return res.status(200).json({ data: comp });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to advance topic", err.message),
      );
    }
  },
};
