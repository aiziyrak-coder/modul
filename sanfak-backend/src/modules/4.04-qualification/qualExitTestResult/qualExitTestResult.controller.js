const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { ErrorHandler } = require("#shared/error");
const QualExitTestResultModel = require("./qualExitTestResult.model");
const QualExitTestModel = require("#modules/4.04-qualification/_shared/qualExitTest.model");
const QualCourseModel = require("#modules/4.04-qualification/qualCourse/qualCourse.model");
const QualTopicModel = require("#modules/4.04-qualification/qualTopic/qualTopic.model");
const QualFinalTestResultModel = require("#modules/4.04-qualification/qualFinalTestResult/qualFinalTestResult.model");
const QualListenerModel = require("#modules/4.04-qualification/_shared/qualListener.model");
const QualEarnedCertificateModel = require("#modules/4.04-qualification/_shared/qualEarnedCertificate.model");
const {
  createNumberedCertificate,
} = require("#modules/4.04-qualification/_shared/qualCertificateNumber");

const QualTestConfig = require("#modules/4.04-qualification/qualTestConfig/qualTestConfig.model");
const QualPetitionModel = require("#modules/4.04-qualification/qualPetition/qualPetition.model");
const QualContractModel = require("#modules/4.04-qualification/qualContract/qualContract.model");
const QualPaymentModel = require("#modules/4.04-qualification/qualPayment/qualPayment.model");
require("#modules/4.04-qualification/qualCourseType/qualCourseType.model");
const {
  getListenerId,
  getPassport,
  listenerScope,
} = require("#modules/4.04-qualification/_shared/listenerContext");
const {
  surveyStatusBatch,
} = require("#modules/4.04-qualification/qualSurvey/qualSurvey.service");
const {
  STATUS: CERT_STATUS,
} = require("#modules/4.04-qualification/qualCertificate/qualCertificate.service");
const logger = require("#shared/winston.logger");
const {
  paymentStatus,
  LOCK_MESSAGE,
} = require("#modules/4.04-qualification/_shared/paymentGate");

const EXIT_WINDOW_DAYS = 7;
function computeExitWindow(endDate, now = new Date()) {
  if (!endDate) return { phase: "not_open", openDate: null, closeDate: null };
  const openDate = new Date(endDate);
  const closeDate = new Date(
    openDate.getTime() + EXIT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  let phase = "open";
  if (now < openDate) phase = "not_open";
  else if (now > closeDate) phase = "closed";
  return { phase, openDate, closeDate };
}

async function computePaymentOkMap(listenerId, courseIds) {
  const map = new Map();
  if (!listenerId || !courseIds.length) return map;
  const contracts = await QualContractModel.find({
    course: { $in: courseIds },
    listener: listenerId,
  })
    .select("course totalPrice")
    .lean();
  if (!contracts.length) return map;
  const payAgg = await QualPaymentModel.aggregate([
    {
      $match: {
        contract: { $in: contracts.map((c) => c._id) },
        status: 2,
      },
    },
    { $group: { _id: "$contract", paid: { $sum: "$price" } } },
  ]);
  const paidByContract = new Map(payAgg.map((a) => [String(a._id), a.paid]));
  contracts.forEach((ct) => {
    const total = ct.totalPrice || 0;
    if (total <= 0) {
      map.set(String(ct.course), true);
      return;
    }
    const paidAmt = paidByContract.get(String(ct._id)) || 0;
    map.set(String(ct.course), paidAmt >= total);
  });
  return map;
}

module.exports = {
  qualExitTestResultStart: async (req, res, next) => {
    try {
      const { course } = req.body;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(403).json({ message: "Tinglovchi topilmadi!" });
      }

      const gate = await paymentStatus(listenerId, course);
      if (gate.locked) {
        return res.status(402).json({ message: LOCK_MESSAGE, dueAt: gate.dueAt });
      }

      const oldDoc = await QualExitTestResultModel.findOne({
        course: course,
        listener: listenerId,
      });
      if (oldDoc) {
        return res
          .status(400)
          .json({ message: "Chiqish testi oldin ishlangan!" });
      }

      const courseDoc = await QualCourseModel.findById(course);
      if (!courseDoc) {
        return res.status(404).json({ message: "Kurs topilmadi!" });
      }
      const { phase } = computeExitWindow(courseDoc.endDate);
      if (phase === "not_open") {
        return res
          .status(400)
          .json({ message: "Chiqish testi hali ochilmagan (kurs tugamagan)!" });
      }
      if (phase === "closed") {
        return res
          .status(400)
          .json({ message: "Chiqish testi muddati tugagan!" });
      }
      const payMap = await computePaymentOkMap(listenerId, [courseDoc._id]);
      const paymentOk = payMap.has(String(courseDoc._id))
        ? payMap.get(String(courseDoc._id))
        : true;
      if (!paymentOk) {
        return res
          .status(400)
          .json({ message: "Kurs to'lovi to'liq amalga oshirilmagan!" });
      }
      if (courseDoc.form === 1) {
        const totalTopics = await QualTopicModel.countDocuments({
          course: course,
        });
        const passedTopics = await QualFinalTestResultModel.distinct("topic", {
          course: course,
          listener: listenerId,
          isPassed: true,
        });
        if (totalTopics === 0 || passedTopics.length < totalTopics) {
          return res
            .status(400)
            .json({ message: "Hamma mavzularni tugatmadingiz!" });
        }
      }

      const cfg = await QualTestConfig.findOne({
        course: courseDoc._id,
        kind: 2,
        topic: null,
      }).lean();
      const exitTest = courseDoc.exitTest || {};
      const randomCount = cfg ? cfg.randomCount : exitTest.randomQuestions ?? 0;
      const durationMin = cfg ? cfg.timeLimit : exitTest.duration ?? 10;
      const passPercentage = cfg
        ? cfg.passPercentage
        : exitTest.passPercentage ?? 60;

      const questions =
        randomCount > 0
          ? await QualExitTestModel.aggregate([
              { $match: { course: courseDoc._id } },
              { $sample: { size: randomCount } },
            ])
          : await QualExitTestModel.find({ course: courseDoc._id }).lean();

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
          .json({ message: "Chiqish testi savollari kiritilmagan!" });
      }

      const startDate = new Date();
      const effMinutes = durationMin > 0 ? durationMin : 24 * 60;
      const endDate = new Date(startDate.getTime() + effMinutes * 60000);

      const newDoc = await QualExitTestResultModel.create({
        course: course,
        listener: listenerId,
        passPercentage: passPercentage,
        percentage: 0,
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
        new ErrorHandler(400, "Failed to qualExitTestResultStart", err.message),
      );
    }
  },

  qualExitTestResultGetMy: async (req, res, next) => {
    try {
      const { course } = req.params;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(200).json({ data: null, remainingTime: 0 });
      }

      const doc = await QualExitTestResultModel.findOne({
        course: course,
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
          "Failed to get qualExitTestResultGetMy",
          err.message,
        ),
      );
    }
  },

  getMyActiveExitTest: async (req, res, next) => {
    try {
      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res
          .status(200)
          .json({ data: null, remainingTime: 0, course: null, courseName: null });
      }
      const doc = await QualExitTestResultModel.findOne({
        listener: listenerId,
        status: 1,
      })
        .populate({ path: "course", select: "title" })
        .sort({ createdAt: -1 });
      if (!doc || new Date() > new Date(doc.endDate)) {
        return res
          .status(200)
          .json({ data: null, remainingTime: 0, course: null, courseName: null });
      }
      const courseId =
        doc.course && doc.course._id
          ? String(doc.course._id)
          : String(doc.course);
      const courseName =
        doc.course && doc.course.title ? doc.course.title : "";
      const safeDoc = doc.toObject();
      safeDoc.questions = safeDoc.questions.map((q) => ({
        ...q,
        options: q.options.map(({ isCorrect, ...opt }) => opt),
      }));
      const remainingTime = Math.max(
        0,
        Math.floor((new Date(doc.endDate).getTime() - Date.now()) / 1000),
      );
      return res
        .status(200)
        .json({ data: safeDoc, remainingTime, course: courseId, courseName });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get active exit test", err.message),
      );
    }
  },

  qualExitTestResultSelectOption: async (req, res, next) => {
    try {
      const { resultId, questionId, optionId } = req.body;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(403).json({ message: "Tinglovchi topilmadi!" });
      }

      const doc = await QualExitTestResultModel.findById(resultId);
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
          "Failed to qualExitTestResultSelectOption",
          err.message,
        ),
      );
    }
  },

  qualExitTestResultFinish: async (req, res, next) => {
    try {
      const { course } = req.body;

      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(404).json({ message: "Aktiv test topilmadi!" });
      }

      const doc = await QualExitTestResultModel.findOne({
        course: course,
        listener: listenerId,
        status: 1,
      });
      if (!doc) {
        return res.status(404).json({ message: "Aktiv test topilmadi!" });
      }

      const totalCorrects = doc.questions.filter(
        (q) => q.isSelectedCorrect === true,
      ).length;

      const percentage = Math.round((totalCorrects / doc.totalQuestions) * 100);
      const isPassed = percentage >= doc.passPercentage;

      doc.totalCorrects = totalCorrects;
      doc.percentage = percentage;
      doc.isPassed = isPassed;
      doc.status = 2;
      doc.finishedDate = new Date();
      await doc.save();

      try {
        const courseWithType = await QualCourseModel.findById(course)
          .select("courseType")
          .populate({ path: "courseType", select: "kind template" })
          .lean();
        const courseType =
          (courseWithType && courseWithType.courseType) || null;
        const courseTypeKind = (courseType && courseType.kind) || 1;
        const kind = courseTypeKind === 1 && isPassed ? 1 : 2;
        let cert = await QualEarnedCertificateModel.findOne({
          course,
          listener: listenerId,
          kind,
        });
        if (!cert) {
          cert = await createNumberedCertificate({
            course,
            listener: listenerId,
            kind,
            template: (courseType && courseType.template) || 1,
          });
        }
      } catch (certErr) {
        logger.error(
          `[exit-finish] hujjat generatsiya xatosi: ${certErr.message}`,
        );
      }

      const earnedDoc = await QualEarnedCertificateModel.findOne({
        course,
        listener: listenerId,
      })
        .select("file status")
        .lean();
      const earnedFile =
        earnedDoc && earnedDoc.status === CERT_STATUS.APPROVED
          ? earnedDoc.file
          : null;

      return res.status(200).json({
        data: {
          totalQuestions: doc.totalQuestions,
          totalCorrects: doc.totalCorrects,
          percentage: doc.percentage,
          passPercentage: doc.passPercentage,
          isPassed: doc.isPassed,
          file: earnedFile,
        },
      });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to qualExitTestResultFinish",
          err.message,
        ),
      );
    }
  },

  getMyExitCourses: async (req, res, next) => {
    try {
      const passport = await getPassport(req);
      const listenerId = await getListenerId(req);

      const petitions = await QualPetitionModel.find({ passport, status: 2 })
        .populate({
          path: "course",
          select: "title creditHours form startDate endDate",
        })
        .sort({ createdAt: -1 })
        .lean();

      const seen = new Set();
      const courseList = [];
      for (const p of petitions) {
        if (!p.course) continue;
        const id = String(p.course._id);
        if (seen.has(id)) continue;
        seen.add(id);
        courseList.push(p.course);
      }

      const paymentOkMap = await computePaymentOkMap(
        listenerId,
        courseList.map((c) => c._id),
      );

      const out = [];
      for (const c of courseList) {
        const totalTopics = await QualTopicModel.countDocuments({
          course: c._id,
        });
        let passedCount = 0;
        let alreadySubmitted = false;
        let result = null;
        if (listenerId) {
          const passed = await QualFinalTestResultModel.distinct("topic", {
            course: c._id,
            listener: listenerId,
            isPassed: true,
          });
          passedCount = passed.length;
          const submitted = await QualExitTestResultModel.findOne({
            course: c._id,
            listener: listenerId,
            status: 2,
          })
            .select("percentage isPassed")
            .lean();
          if (submitted) {
            alreadySubmitted = true;
            result = {
              percentage: submitted.percentage,
              isPassed: submitted.isPassed,
            };
          }
        }
        const { phase, openDate, closeDate } = computeExitWindow(c.endDate);
        const isOnline = c.form === 1;
        const topicsOk = totalTopics > 0 && passedCount >= totalTopics;
        const paymentOk = paymentOkMap.has(String(c._id))
          ? paymentOkMap.get(String(c._id))
          : true;
        const eligible =
          phase === "open" &&
          paymentOk &&
          !alreadySubmitted &&
          (isOnline ? topicsOk : true);
        let reason = null;
        if (!eligible && !alreadySubmitted) {
          if (phase === "not_open") reason = "not_open";
          else if (phase === "closed") reason = "closed";
          else if (!paymentOk) reason = "payment";
          else if (isOnline && !topicsOk) reason = "incomplete";
        }

        out.push({
          courseId: String(c._id),
          courseName: c.title,
          form: c.form,
          creditHours: c.creditHours,
          startDate: c.startDate,
          endDate: c.endDate,
          openDate,
          closeDate,
          eligible,
          alreadySubmitted,
          reason,
          result,
        });
      }

      return res.status(200).json({ data: out });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get my exit courses", err.message),
      );
    }
  },

  getMyCertificates: async (req, res, next) => {
    try {
      const listenerId = await getListenerId(req);
      if (!listenerId) return res.status(200).json({ data: [] });

      const results = await QualExitTestResultModel.find({
        listener: listenerId,
        status: 2,
      })
        .populate({
          path: "course",
          select: "title creditHours form startDate endDate courseType",
          populate: { path: "courseType", select: "title" },
        })
        .sort({ finishedDate: -1 })
        .lean();

      const earned = await QualEarnedCertificateModel.find({
        listener: listenerId,
      }).lean();
      const earnedByCourse = new Map(
        earned.map((e) => [String(e.course), e]),
      );

      const lockedCourses = new Set();
      await Promise.all(
        [...new Set(results.filter((r) => r.course).map((r) => String(r.course._id)))].map(
          async (courseId) => {
            const gate = await paymentStatus(listenerId, courseId);
            if (gate.locked) lockedCourses.add(courseId);
          },
        ),
      );

      const visible = results.filter(
        (r) => r.course && !lockedCourses.has(String(r.course._id)),
      );
      const surveyState = await surveyStatusBatch(
        visible.map((r) => ({ course: r.course._id, listener: listenerId })),
      );

      const data = visible
        .map((r) => {
          const doc = earnedByCourse.get(String(r.course._id));
          const survey = surveyState.get(
            String(r.course._id) + "|" + String(listenerId),
          ) || { required: false, done: true };
          const approved = doc ? doc.status === CERT_STATUS.APPROVED : false;
          return {
            id: String(r._id),
            courseId: String(r.course._id),
            courseName: r.course.title,
            courseType: r.course.courseType ? r.course.courseType.title : "",
            form: r.course.form,
            creditHours: r.course.creditHours,
            startDate: r.course.startDate,
            endDate: r.course.endDate,
            kind: doc ? doc.kind : r.isPassed ? 1 : 2,
            percentage: r.percentage,
            file: survey.done && approved && doc ? doc.file : null,
            surveyRequired: survey.required,
            surveyDone: survey.done,
            certStatus: doc ? doc.status : CERT_STATUS.PENDING,
            rejectReason: doc && doc.status === CERT_STATUS.REJECTED
              ? doc.rejectReason || ""
              : "",
            issuedDate: r.finishedDate,
          };
        });

      return res.status(200).json({ data });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get my certificates", err.message),
      );
    }
  },

  findAllQualExitTestResults: async (req, res, next) => {
    try {
      const { course, form } = req.query;

      const matchStage = { ...(await listenerScope(req, "listener")) };
      if (course) matchStage.course = new ObjectId(course);

      const pipeline = [
        { $match: matchStage },

        {
          $lookup: {
            from: QualEarnedCertificateModel.collection.name,
            let: { courseId: "$course", listenerId: "$listener" },
            as: "earnedDocument",
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$course", "$$courseId"] },
                      { $eq: ["$listener", "$$listenerId"] },
                    ],
                  },
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: "$earnedDocument",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: QualCourseModel.collection.name,
            localField: "course",
            foreignField: "_id",
            as: "course",
          },
        },
        {
          $unwind: {
            path: "$course",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: QualListenerModel.collection.name,
            localField: "listener",
            foreignField: "_id",
            as: "listener",
          },
        },
        {
          $unwind: {
            path: "$listener",
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      if (form) {
        pipeline.push({ $match: { "course.form": form } });
      }

      const docs = await QualExitTestResultModel.aggregate(pipeline);

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to find qualExitTestResults",
          err.message,
        ),
      );
    }
  },

  paginateQualExitTestResults: async (req, res, next) => {
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
            from: QualEarnedCertificateModel.collection.name,
            let: { courseId: "$course", listenerId: "$listener" },
            as: "earnedDocument",
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$course", "$$courseId"] },
                      { $eq: ["$listener", "$$listenerId"] },
                    ],
                  },
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: "$earnedDocument",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: QualCourseModel.collection.name,
            localField: "course",
            foreignField: "_id",
            as: "course",
          },
        },
        {
          $unwind: {
            path: "$course",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: QualListenerModel.collection.name,
            localField: "listener",
            foreignField: "_id",
            as: "listener",
          },
        },
        {
          $unwind: {
            path: "$listener",
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      if (form) {
        pipeline.push({ $match: { "course.form": form } });
      }

      const aggregate = QualExitTestResultModel.aggregate(pipeline);

      const options = { useFacet: false, page: parseInt(page), limit: parseInt(limit) };

      const docs = await QualExitTestResultModel.aggregatePaginate(
        aggregate,
        options,
      );

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to paginate qualExitTestResults",
          err.message,
        ),
      );
    }
  },

  findOneQualExitTestResult: async (req, res, next) => {
    try {
      const scope = await listenerScope(req, "listener");
      const doc = await QualExitTestResultModel.findOne({
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
        new ErrorHandler(400, "Failed to find qualExitTestResult", err.message),
      );
    }
  },
};
