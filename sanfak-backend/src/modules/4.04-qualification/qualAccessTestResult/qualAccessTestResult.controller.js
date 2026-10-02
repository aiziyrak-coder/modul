const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { ErrorHandler } = require("#shared/error");
const QualAccessTestResultModel = require("./qualAccessTestResult.model");
const QualListenerModel = require("#modules/4.04-qualification/_shared/qualListener.model");
const QualCourseModel = require("#modules/4.04-qualification/qualCourse/qualCourse.model");
const QualAccessTestModel = require("#modules/4.04-qualification/_shared/qualAccessTest.model");
const QualTestConfig = require("#modules/4.04-qualification/qualTestConfig/qualTestConfig.model");
const {
  getListenerId,
  getOrCreateListenerId,
  isApprovedForCourse,
  listenerScope,
} = require("#modules/4.04-qualification/_shared/listenerContext");

module.exports = {
  qualAccessTestResultStart: async (req, res, next) => {
    try {
      const { course } = req.body;

      const listenerId = await getOrCreateListenerId(req);
      if (!listenerId) {
        return res.status(403).json({ message: "Tinglovchi topilmadi!" });
      }

      const approved = await isApprovedForCourse(req, course);
      if (!approved) {
        return res.status(400).json({ message: "Kursga qabul qilinmagansiz!" });
      }

      const oldDoc = await QualAccessTestResultModel.findOne({
        course: course,
        listener: listenerId,
      });
      if (oldDoc) {
        return res
          .status(400)
          .json({ message: "Kirish testi oldin ishlangan" });
      }

      const courseDoc = await QualCourseModel.findById(course).lean();
      if (!courseDoc) {
        return res.status(404).json({ message: "Kurs topilmadi!" });
      }
      const startDay = new Date(courseDoc.startDate);
      startDay.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (startDay > today) {
        return res.status(400).json({ message: "Kurs hali boshlanmagan!" });
      }

      const cfg = await QualTestConfig.findOne({
        course: courseDoc._id,
        kind: 1,
        topic: null,
      }).lean();
      const accessTest = courseDoc.accessTest || {};
      const randomCount = cfg ? cfg.randomCount : accessTest.randomQuestions ?? 0;
      const durationMin = cfg ? cfg.timeLimit : accessTest.duration ?? 10;

      const questions =
        randomCount > 0
          ? await QualAccessTestModel.aggregate([
              { $match: { course: courseDoc._id } },
              { $sample: { size: randomCount } },
            ])
          : await QualAccessTestModel.find({ course: courseDoc._id })
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
          .json({ message: "Kirish testi savollari kiritilmagan!" });
      }

      const startDate = new Date();
      const effMinutes = durationMin > 0 ? durationMin : 24 * 60;
      const endDate = new Date(startDate.getTime() + effMinutes * 60000);

      const newDoc = await QualAccessTestResultModel.create({
        course: course,
        listener: listenerId,
        totalQuestions: formattedQuestions.length,
        totalCorrects: 0,
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
          "Failed to add qualAccessTestResultStart",
          err.message,
        ),
      );
    }
  },

  qualAccessTestResultGetMy: async (req, res, next) => {
    try {
      const { course } = req.params;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(200).json({ data: null, remainingTime: 0 });
      }

      const doc = await QualAccessTestResultModel.findOne({
        course: course,
        listener: listenerId,
      });

      if (!doc || doc.status !== 1 || new Date() > new Date(doc.endDate)) {
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
          "Failed to get qualAccessTestResultGetMy",
          err.message,
        ),
      );
    }
  },

  qualAccessTestResultSelectOption: async (req, res, next) => {
    try {
      const { resultId, questionId, optionId } = req.body;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(403).json({ message: "Tinglovchi topilmadi!" });
      }

      const doc = await QualAccessTestResultModel.findById(resultId);
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
          "Failed to qualAccessTestResultSelectOption",
          err.message,
        ),
      );
    }
  },

  qualAccessTestResultFinish: async (req, res, next) => {
    try {
      const { course } = req.body;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(404).json({ message: "Test topilmadi!" });
      }

      const doc = await QualAccessTestResultModel.findOne({
        course: course,
        listener: listenerId,
      });
      if (!doc) {
        return res.status(404).json({ message: "Test topilmadi!" });
      }

      if (doc.status !== 1) {
        return res
          .status(400)
          .json({ message: "Test allaqachon yakunlangan!" });
      }

      const totalCorrects = doc.questions.filter(
        (q) => q.isSelectedCorrect === true,
      ).length;

      doc.totalCorrects = totalCorrects;
      doc.status = 2;
      doc.finishedDate = new Date();

      await doc.save();

      return res.status(200).json({
        data: {
          totalQuestions: doc.totalQuestions,
          totalCorrects: doc.totalCorrects,
        },
      });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to qualAccessTestResultFinish",
          err.message,
        ),
      );
    }
  },

  findAllQualAccessTestResults: async (req, res, next) => {
    try {
      const { course, form } = req.query;

      const matchStage = { ...(await listenerScope(req, "listener")) };
      if (course) matchStage.course = new ObjectId(course);

      const pipeline = [
        { $match: matchStage },

        {
          $lookup: {
            from: QualCourseModel.collection.name,
            localField: "course",
            foreignField: "_id",
            as: "course",
          },
        },
        { $unwind: "$course" },
        {
          $lookup: {
            from: QualListenerModel.collection.name,
            localField: "listener",
            foreignField: "_id",
            as: "listener",
          },
        },
        { $unwind: "$listener" },
      ];

      if (form) {
        pipeline.push({ $match: { "course.form": form } });
      }

      const docs = await QualAccessTestResultModel.aggregate(pipeline);

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to find qualAccessTestResults",
          err.message,
        ),
      );
    }
  },

  paginateQualAccessTestResults: async (req, res, next) => {
    try {
      const { course, form, page, limit } = req.query;
      const matchStage = { ...(await listenerScope(req, "listener")) };

      if (course) {
        matchStage.course = new ObjectId(course);
      }

      const pipeline = [
        { $match: matchStage },

        {
          $lookup: {
            from: QualCourseModel.collection.name,
            localField: "course",
            foreignField: "_id",
            as: "course",
          },
        },
        { $unwind: "$course" },
        {
          $lookup: {
            from: QualListenerModel.collection.name,
            localField: "listener",
            foreignField: "_id",
            as: "listener",
          },
        },
        { $unwind: "$listener" },
      ];

      if (form) {
        pipeline.push({
          $match: {
            "course.form": form,
          },
        });
      }

      const aggregate = QualAccessTestResultModel.aggregate(pipeline);

      const options = { useFacet: false, page: parseInt(page), limit: parseInt(limit) };

      const docs = await QualAccessTestResultModel.aggregatePaginate(
        aggregate,
        options,
      );

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to paginate qualAccessTestResults",
          err.message,
        ),
      );
    }
  },

  findOneQualAccessTestResult: async (req, res, next) => {
    try {
      const scope = await listenerScope(req, "listener");
      const doc = await QualAccessTestResultModel.findOne({
        _id: req.params.id,
        ...scope,
      })
        .populate([
          { path: "course", select: "title form" },
          { path: "listener", select: "fullName" },
        ])
        .setOptions({ strictPopulate: false })
        .exec();

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to find qualAccessTestResult",
          err.message,
        ),
      );
    }
  },
};
