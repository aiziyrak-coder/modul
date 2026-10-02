const { ErrorHandler } = require("#shared/error");
const QualFinalTestResultModel = require("./qualFinalTestResult.model");
const QualTopicCompletionModel = require("#modules/4.04-qualification/qualTopicCompletion/qualTopicCompletion.model");
const QualTopicModel = require("#modules/4.04-qualification/qualTopic/qualTopic.model");
const QualTopicFinalTestModel = require("#modules/4.04-qualification/_shared/qualTopicFinalTest.model");
const QualTestConfig = require("#modules/4.04-qualification/qualTestConfig/qualTestConfig.model");
const {
  getListenerId,
} = require("#modules/4.04-qualification/_shared/listenerContext");
const {
  paymentStatus,
  LOCK_MESSAGE,
} = require("#modules/4.04-qualification/_shared/paymentGate");

module.exports = {
  qualFinalTestResultStart: async (req, res, next) => {
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

      const completionDoc = await QualTopicCompletionModel.findOne({
        course: course,
        topic: topic,
        listener: listenerId,
      });

      if (!completionDoc || completionDoc.status !== 5) {
        return res
          .status(400)
          .json({ message: "Siz hali test bosqichiga yetmadingiz!" });
      }

      const activeTest = await QualFinalTestResultModel.findOne({
        course: course,
        topic: topic,
        listener: listenerId,
        status: 1,
      });
      if (activeTest) {
        return res
          .status(400)
          .json({ message: "Sizda hali yakunlanmagan test mavjud!" });
      }

      const topicDoc = await QualTopicModel.findById(topic);
      if (!topicDoc) {
        return res.status(404).json({ message: "Mavzu topilmadi!" });
      }
      const cfg = await QualTestConfig.findOne({
        course: completionDoc.course,
        kind: 3,
        topic: completionDoc.topic,
      }).lean();
      const finalCfg = topicDoc.finalTest || {};
      const randomCount = cfg ? cfg.randomCount : finalCfg.totalQuestions ?? 0;
      const durationMin = cfg ? cfg.timeLimit : finalCfg.duration ?? 10;
      const passPercentage = cfg
        ? cfg.passPercentage
        : finalCfg.passPercentage ?? 60;

      const unlockAt =
        new Date(completionDoc.startedAt).getTime() +
        (topicDoc.duration || 0) * 60 * 60 * 1000;
      if (Date.now() < unlockAt) {
        return res
          .status(400)
          .json({ message: "Mavzu muddati hali tugamagan!" });
      }

      const questions =
        randomCount > 0
          ? await QualTopicFinalTestModel.aggregate([
              {
                $match: {
                  course: completionDoc.course,
                  topic: completionDoc.topic,
                },
              },
              { $sample: { size: randomCount } },
            ])
          : await QualTopicFinalTestModel.find({
              course: completionDoc.course,
              topic: completionDoc.topic,
            })
              .sort({ order: 1 })
              .lean();

      const formattedQuestions = questions.map((q) => ({
        isSelectedCorrect: false,
        testType: q.testType,
        question: q.question,
        options: q.options.map((opt) => ({
          text: opt.text,
          isCorrect: opt.isCorrect,
          isSelected: false,
        })),
      }));

      if (formattedQuestions.length === 0) {
        return res
          .status(400)
          .json({ message: "Yakuniy test savollari kiritilmagan!" });
      }

      const startDate = new Date();
      const effMinutes = durationMin > 0 ? durationMin : 24 * 60;
      const endDate = new Date(startDate.getTime() + effMinutes * 60000);

      const newDoc = await QualFinalTestResultModel.create({
        course: course,
        topic: topic,
        listener: listenerId,
        passPercentage: passPercentage,
        totalQuestions: formattedQuestions.length,
        totalCorrects: 0,
        isPassed: false,
        questions: formattedQuestions,
        startDate,
        endDate,
        status: 1,
      });

      return res.status(201).json({ data: newDoc });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to qualFinalTestResultStart",
          err.message,
        ),
      );
    }
  },

  qualFinalTestResultGetMy: async (req, res, next) => {
    try {
      const { course, topic } = req.params;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(200).json({ data: null, remainingTime: 0 });
      }

      const doc = await QualFinalTestResultModel.findOne({
        course: course,
        topic: topic,
        listener: listenerId,
        status: 1,
      });

      if (!doc || new Date() > new Date(doc.endDate)) {
        return res.status(200).json({ data: null, remainingTime: 0 });
      }

      const safeDoc = doc.toObject();
      safeDoc.questions = safeDoc.questions.map((q) => ({
        ...q,
        options: q.options.map(({ isCorrect, ...opt }) => opt),
      }));

      const remainingTime = Math.max(
        0,
        Math.floor((new Date(doc.endDate).getTime() - Date.now()) / 1000),
      );

      return res.status(200).json({ data: safeDoc, remainingTime });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to get qualFinalTestResultGetMy",
          err.message,
        ),
      );
    }
  },

  qualFinalTestResultSelectOption: async (req, res, next) => {
    try {
      const { resultId, questionId, optionId } = req.body;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(403).json({ message: "Tinglovchi topilmadi!" });
      }

      const doc = await QualFinalTestResultModel.findById(resultId);
      if (!doc) {
        return res.status(404).json({ message: "Test topilmadi!" });
      }

      if (doc.listener.toString() !== listenerId.toString()) {
        return res
          .status(403)
          .json({ message: "Bu test sizga tegishli emas!" });
      }

      if (doc.status !== 1) {
        return res
          .status(400)
          .json({ message: "Test allaqachon yakunlangan!" });
      }

      if (new Date() > new Date(doc.endDate)) {
        return res.status(400).json({ message: "Test vaqti tugagan!" });
      }

      const question = doc.questions.id(questionId);
      if (!question) {
        return res.status(404).json({ message: "Savol topilmadi!" });
      }

      const option = question.options.id(optionId);
      if (!option) {
        return res.status(404).json({ message: "Variant topilmadi!" });
      }

      if (question.testType === 1) {
        question.options.forEach((opt) => {
          opt.isSelected = false;
        });
        option.isSelected = true;
      } else {
        option.isSelected = !option.isSelected;
      }

      const allCorrectSelected = question.options.every(
        (opt) => opt.isCorrect === opt.isSelected,
      );
      question.isSelectedCorrect = allCorrectSelected;

      await doc.save();

      return res.status(200).json({ message: "Variant belgilandi!" });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to qualFinalTestResultSelectOption",
          err.message,
        ),
      );
    }
  },

  qualFinalTestResultFinish: async (req, res, next) => {
    try {
      const { course, topic } = req.body;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(404).json({ message: "Aktiv test topilmadi!" });
      }

      const doc = await QualFinalTestResultModel.findOne({
        course: course,
        topic: topic,
        listener: listenerId,
        status: 1,
      });
      if (!doc) {
        return res.status(404).json({ message: "Aktiv test topilmadi!" });
      }

      const totalCorrects = doc.questions.filter(
        (q) => q.isSelectedCorrect === true,
      ).length;

      const isPassed =
        (totalCorrects / doc.totalQuestions) * 100 >= doc.passPercentage;

      doc.totalCorrects = totalCorrects;
      doc.isPassed = isPassed;
      doc.status = 2;
      doc.finishedDate = new Date();
      await doc.save();

      let nextTopicUnlocked = false;

      if (!isPassed) {
        await QualTopicCompletionModel.findOneAndUpdate(
          { course: course, topic: topic, listener: listenerId },
          { status: 1 },
        );
      } else {
        const currentTopic = await QualTopicModel.findById(topic);
        const nextTopic = await QualTopicModel.findOne({
          course: course,
          orderNumber: { $gt: currentTopic.orderNumber },
        }).sort({ orderNumber: 1 });

        if (nextTopic) {
          await QualTopicCompletionModel.findOneAndUpdate(
            { course: course, topic: nextTopic._id, listener: listenerId },
            { isLocked: false },
          );
          nextTopicUnlocked = true;
        }
      }

      return res.status(200).json({
        data: {
          totalQuestions: doc.totalQuestions,
          totalCorrects: doc.totalCorrects,
          isPassed: doc.isPassed,
          passPercentage: doc.passPercentage,
          nextTopicUnlocked,
        },
      });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to qualFinalTestResultFinish",
          err.message,
        ),
      );
    }
  },
};
