const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { ErrorHandler } = require("#shared/error");
const QualCourseSubscription = require("./qualCourseSubscription.model");
const QualListener = require("#modules/4.04-qualification/_shared/qualListener.model");
const QualPetition = require("#modules/4.04-qualification/qualPetition/qualPetition.model");
const QualAccessTestResult = require("#modules/4.04-qualification/qualAccessTestResult/qualAccessTestResult.model");
const QualContract = require("#modules/4.04-qualification/qualContract/qualContract.model");
const QualPayment = require("#modules/4.04-qualification/qualPayment/qualPayment.model");
require("#modules/4.04-qualification/qualCourse/qualCourse.model");
const QualTopic = require("#modules/4.04-qualification/qualTopic/qualTopic.model");
const QualFinalTestResult = require("#modules/4.04-qualification/qualFinalTestResult/qualFinalTestResult.model");
const QualExitTestResult = require("#modules/4.04-qualification/qualExitTestResult/qualExitTestResult.model");
const QualTopicCompletion = require("#modules/4.04-qualification/qualTopicCompletion/qualTopicCompletion.model");
const QualTopicScenario = require("#modules/4.04-qualification/_shared/qualTopicScenario.model");
const {
  getPassport,
  listenerScope,
} = require("#modules/4.04-qualification/_shared/listenerContext");
require("#references/province/province.model");
require("#references/region/region.model");

module.exports = {
  studentMonitoringDetail: async (req, res, next) => {
    try {
      const petition = await QualPetition.findById(req.params.id)
        .populate({ path: "course", select: "title form" })
        .lean();
      if (!petition || !petition.course) {
        return res.status(404).json({ message: "not found" });
      }
      const courseId = petition.course._id;
      const pct = (c, tot) => (tot > 0 ? Math.round((c / tot) * 100) : 0);

      const listener = await QualListener.findOne({ passport: petition.passport })
        .select("_id fullName passport")
        .lean();

      const topics = await QualTopic.find({ course: courseId })
        .select("title orderNumber duration")
        .sort({ orderNumber: 1 })
        .lean();

      let educationType = 2;
      let entranceTest = null;
      let exitTest = null;
      let finals = [];
      let completions = [];

      if (listener) {
        const sub = await QualCourseSubscription.findOne({
          course: courseId,
          listener: listener._id,
        })
          .select("educationType")
          .lean();
        if (sub && sub.educationType) educationType = sub.educationType;

        const entrance = await QualAccessTestResult.findOne({
          course: courseId,
          listener: listener._id,
        })
          .select("totalQuestions totalCorrects startDate createdAt")
          .lean();
        if (entrance) {
          entranceTest = {
            date: entrance.startDate || entrance.createdAt || null,
            correct: entrance.totalCorrects || 0,
            total: entrance.totalQuestions || 0,
            percent: pct(entrance.totalCorrects || 0, entrance.totalQuestions || 0),
          };
        }

        finals = await QualFinalTestResult.find({
          course: courseId,
          listener: listener._id,
        })
          .select("topic totalQuestions totalCorrects isPassed questions createdAt")
          .lean();
        completions = await QualTopicCompletion.find({
          course: courseId,
          listener: listener._id,
        })
          .select("topic status scenarioAnswer scenarioImage")
          .lean();

        const exit = await QualExitTestResult.findOne({
          course: courseId,
          listener: listener._id,
        })
          .select("percentage totalQuestions totalCorrects isPassed createdAt")
          .lean();
        if (exit) {
          exitTest = {
            date: exit.createdAt || null,
            correct: exit.totalCorrects || 0,
            total: exit.totalQuestions || 0,
            percent:
              exit.percentage != null
                ? exit.percentage
                : pct(exit.totalCorrects || 0, exit.totalQuestions || 0),
            isPassed: !!exit.isPassed,
          };
        }
      }

      const scenarios = await QualTopicScenario.find({ course: courseId })
        .select("topic title text")
        .lean();
      const scenarioByTopic = new Map(scenarios.map((s) => [String(s.topic), s]));

      const finalByTopic = new Map();
      for (const f of finals) {
        const key = String(f.topic);
        const prev = finalByTopic.get(key);
        if (
          !prev ||
          (f.isPassed && !prev.isPassed) ||
          (!!f.isPassed === !!prev.isPassed &&
            new Date(f.createdAt || 0) > new Date(prev.createdAt || 0))
        ) {
          finalByTopic.set(key, f);
        }
      }
      const complByTopic = new Map(completions.map((c) => [String(c.topic), c]));

      let passedCount = 0;
      const topicRows = topics.map((tp) => {
        const f = finalByTopic.get(String(tp._id));
        const c = complByTopic.get(String(tp._id));
        const scen = scenarioByTopic.get(String(tp._id));
        const isPassed = !!(f && f.isPassed);
        if (isPassed) passedCount += 1;
        let status = "not_started";
        if (isPassed) status = "completed";
        else if ((f && (f.totalCorrects || f.totalQuestions)) || (c && c.status > 0))
          status = "in_progress";
        const testAnswers =
          f && Array.isArray(f.questions)
            ? f.questions.map((q) => ({
                question: q.question || "",
                isCorrect: !!q.isSelectedCorrect,
                options: (q.options || []).map((o) => ({
                  text: o.text || "",
                  isCorrect: !!o.isCorrect,
                  isSelected: !!o.isSelected,
                })),
              }))
            : [];
        return {
          topicId: String(tp._id),
          orderNumber: tp.orderNumber,
          title: tp.title,
          scenarioQuestion: scen ? scen.text || scen.title || null : null,
          scenarioAnswer: c ? c.scenarioAnswer || null : null,
          scenarioImage: c ? c.scenarioImage || null : null,
          correct: f ? f.totalCorrects || 0 : null,
          total: f ? f.totalQuestions || 0 : null,
          percent: f ? pct(f.totalCorrects || 0, f.totalQuestions || 0) : null,
          submittedAt: f && f.createdAt ? f.createdAt : null,
          testAnswers,
          isPassed,
          status,
        };
      });

      return res.status(200).json({
        listenerName: (listener && listener.fullName) || petition.fullName || "—",
        passport: petition.passport,
        courseName: petition.course.title,
        educationType,
        totalTopics: topics.length,
        passedTopics: passedCount,
        percent: pct(passedCount, topics.length),
        entranceTest,
        exitTest,
        topics: topicRows,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get student detail", err.message),
      );
    }
  },

  findAllQualCourseSubscriptions: async (req, res, next) => {
    try {
      const { search, educationType, course } = req.query;

      const pipeline = [];
      const matchStage = {};

      if (educationType) matchStage.educationType = educationType;
      if (course) matchStage.course = new ObjectId(course);

      if (Object.keys(matchStage).length) {
        pipeline.push({ $match: matchStage });
      }

      pipeline.push({
        $lookup: {
          from: QualListener.collection.name,
          localField: "listener",
          foreignField: "_id",
          as: "listener",
        },
      });

      pipeline.push({
        $unwind: {
          path: "$listener",
          preserveNullAndEmptyArrays: true,
        },
      });

      if (search) {
        const regex = new RegExp(search, "i");

        pipeline.push({
          $match: {
            $or: [
              { "listener.fullName": regex },
              { "listener.passport": regex },
            ],
          },
        });
      }

      pipeline.push({ $sort: { createdAt: 1 } });

      const docs = await QualCourseSubscription.aggregate(pipeline);

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to find qualCourseSubscriptions",
          err.message,
        ),
      );
    }
  },

  paginateQualCourseSubscriptions: async (req, res, next) => {
    try {
      const { page, limit, search, educationType, course } = req.query;

      const match = {};
      if (educationType) match.educationType = Number(educationType);
      if (course) match.course = new ObjectId(course);

      const subs = await QualCourseSubscription.find(match)
        .populate({ path: "listener", model: "QualListener", select: "fullName passport" })
        .sort({ createdAt: 1 })
        .lean();

      let rows = subs.filter((s) => s.listener);
      if (search) {
        const rx = new RegExp(search, "i");
        rows = rows.filter(
          (s) =>
            rx.test(s.listener.fullName || "") ||
            rx.test(s.listener.passport || ""),
        );
      }

      const out = [];
      for (const s of rows) {
        const pet = await QualPetition.findOne({
          course: s.course,
          passport: s.listener.passport,
        })
          .sort({ createdAt: -1 })
          .populate({ path: "province", select: "title" })
          .populate({ path: "region", select: "title" })
          .select("province region institution phone")
          .lean();
        out.push({
          _id: String(s._id),
          educationType: s.educationType,
          listener: {
            _id: String(s.listener._id),
            fullName: s.listener.fullName,
            passport: s.listener.passport,
            province: pet && pet.province ? pet.province.title : undefined,
            region: pet && pet.region ? pet.region.title : undefined,
            institution: pet ? pet.institution : undefined,
            phone: pet ? pet.phone : undefined,
          },
        });
      }

      const p = parseInt(page) || 1;
      const l = parseInt(limit) || 20;
      const docs = out.slice((p - 1) * l, (p - 1) * l + l);

      return res.status(200).json({
        docs,
        totalDocs: out.length,
        page: p,
        limit: l,
        totalPages: Math.ceil(out.length / l) || 1,
      });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to paginate qualCourseSubscriptions",
          err.message,
        ),
      );
    }
  },

  studentsMonitoring: async (req, res, next) => {
    try {
      const { page, limit, search, course, performance } = req.query;

      const match = { status: 2 };
      if (course) match.course = new ObjectId(course);

      const petitions = await QualPetition.find(match)
        .populate({ path: "course", select: "title form" })
        .sort({ createdAt: 1 })
        .lean();

      const seen = new Set();
      let rows = petitions.filter((p) => {
        if (!p.course) return false;
        const key = `${p.passport}|${String(p.course._id)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (search) {
        const rx = new RegExp(search, "i");
        rows = rows.filter(
          (p) => rx.test(p.fullName || "") || rx.test(p.passport || ""),
        );
      }

      const out = [];
      for (const p of rows) {
        const listener = await QualListener.findOne({ passport: p.passport })
          .select("_id")
          .lean();
        const totalTopics = await QualTopic.countDocuments({
          course: p.course._id,
        });
        let progressPercent = 0;
        let educationType = 2;
        if (listener) {
          const passed = await QualFinalTestResult.distinct("topic", {
            course: p.course._id,
            listener: listener._id,
            isPassed: true,
          });
          progressPercent =
            totalTopics > 0
              ? Math.round((passed.length / totalTopics) * 100)
              : 0;
          const sub = await QualCourseSubscription.findOne({
            course: p.course._id,
            listener: listener._id,
          })
            .select("educationType")
            .lean();
          if (sub && sub.educationType) educationType = sub.educationType;
        }
        out.push({
          id: String(p._id),
          listenerId: listener ? String(listener._id) : null,
          fullName: p.fullName,
          passport: p.passport,
          courseId: String(p.course._id),
          courseName: p.course.title,
          form: p.course.form,
          educationType,
          progressPercent,
        });
      }

      let filtered = out;
      if (performance === "high") {
        filtered = out.filter((r) => r.progressPercent >= 80);
      } else if (performance === "medium") {
        filtered = out.filter(
          (r) => r.progressPercent >= 60 && r.progressPercent < 80,
        );
      } else if (performance === "low") {
        filtered = out.filter((r) => r.progressPercent < 60);
      }

      const p = parseInt(page) || 1;
      const l = parseInt(limit) || 20;
      const docs = filtered.slice((p - 1) * l, (p - 1) * l + l);

      return res.status(200).json({
        docs,
        totalDocs: filtered.length,
        page: p,
        limit: l,
        totalPages: Math.ceil(filtered.length / l) || 1,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to build students monitoring", err.message),
      );
    }
  },

  progressReport: async (req, res, next) => {
    try {
      const { course, dateFrom, dateTo } = req.query;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.max(1, parseInt(req.query.limit, 10) || 12);

      const match = {};
      if (course) match.course = new ObjectId(course);
      if (dateFrom || dateTo) {
        match.createdAt = {};
        if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          match.createdAt.$lte = to;
        }
      }

      const subs = await QualCourseSubscription.find(match)
        .populate({ path: "course", select: "title form" })
        .populate({
          path: "listener",
          model: "QualListener",
          select: "fullName passport",
        })
        .sort({ createdAt: 1 })
        .lean();

      const seen = new Set();
      const rows = subs.filter((s) => {
        if (!s.course || s.course.form !== 1 || !s.listener) return false;
        const key = `${String(s.listener._id)}|${String(s.course._id)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const totalDocs = rows.length;
      const pageRows = rows.slice((page - 1) * limit, page * limit);

      const out = [];
      for (const s of pageRows) {
        const courseId = s.course._id;
        const listenerId = s.listener._id;
        const totalTopics = await QualTopic.countDocuments({ course: courseId });
        const passed = await QualFinalTestResult.distinct("topic", {
          course: courseId,
          listener: listenerId,
          isPassed: true,
        });
        const progressPercent =
          totalTopics > 0
            ? Math.round((passed.length / totalTopics) * 100)
            : 0;
        const exit = await QualExitTestResult.findOne({
          course: courseId,
          listener: listenerId,
        })
          .select("percentage isPassed")
          .sort({ createdAt: -1 })
          .lean();
        const testScore =
          exit && typeof exit.percentage === "number" ? exit.percentage : null;
        const hasCertificate = exit ? !!exit.isPassed : false;
        const petition = await QualPetition.findOne({
          passport: s.listener.passport,
          course: courseId,
        })
          .select("_id")
          .sort({ createdAt: -1 })
          .lean();
        out.push({
          id: petition ? String(petition._id) : null,
          subId: String(s._id),
          listenerId: String(listenerId),
          fullName: s.listener.fullName,
          courseName: s.course.title,
          progressPercent,
          testScore,
          hasCertificate,
        });
      }

      return res.status(200).json({
        docs: out,
        totalDocs,
        page,
        limit,
        totalPages: Math.ceil(totalDocs / limit),
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to build progress report", err.message),
      );
    }
  },

  findMyCourses: async (req, res, next) => {
    try {
      const passport = await getPassport(req);

      const petitions = await QualPetition.find({ passport, status: 2 })
        .populate({
          path: "course",
          select: "title creditHours price form startDate endDate status address",
        })
        .sort({ createdAt: -1 })
        .lean();

      const listener = await QualListener.findOne({ passport }).select("_id").lean();
      let doneSet = new Set();
      if (listener) {
        const done = await QualAccessTestResult.find({
          listener: listener._id,
          status: 2,
        })
          .select("course")
          .lean();
        doneSet = new Set(done.map((r) => String(r.course)));
      }

      const seen = new Set();
      const courses = petitions
        .filter((p) => p.course)
        .filter((p) => {
          const id = String(p.course._id);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map((p) => ({
          subscriptionId: String(p._id),
          educationType: 2,
          ...p.course,
          entranceTestDone: doneSet.has(String(p.course._id)),
        }));

      if (listener && courses.length) {
        const contracts = await QualContract.find({
          course: { $in: courses.map((c) => c._id) },
          listener: listener._id,
        })
          .select("course totalPrice")
          .lean();
        const contractByCourse = new Map(
          contracts.map((ct) => [String(ct.course), ct]),
        );
        const payAgg = contracts.length
          ? await QualPayment.aggregate([
              {
                $match: {
                  contract: { $in: contracts.map((ct) => ct._id) },
                  status: 2,
                },
              },
              { $group: { _id: "$contract", paid: { $sum: "$price" } } },
            ])
          : [];
        const paidByContract = new Map(
          payAgg.map((a) => [String(a._id), a.paid]),
        );
        courses.forEach((c) => {
          const ct = contractByCourse.get(String(c._id));
          const total = ct ? ct.totalPrice || 0 : 0;
          const paidAmt = ct ? paidByContract.get(String(ct._id)) || 0 : 0;
          c.paid = total > 0 && paidAmt >= total;
        });
      } else {
        courses.forEach((c) => {
          c.paid = false;
        });
      }

      return res.status(200).json(courses);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to find my qual courses",
          err.message,
        ),
      );
    }
  },

  findOneQualCourseSubscription: async (req, res, next) => {
    try {
      const scope = await listenerScope(req, "listener");
      let doc = await QualCourseSubscription.findOne({
        _id: req.params.id,
        ...scope,
      })
        .populate([{ path: "listener" }])
        .setOptions({ strictPopulate: false })
        .exec();

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to find qualCourseSubscription",
          err.message,
        ),
      );
    }
  },

  updateQualCourseSubscription: async (req, res, next) => {
    try {
      const doc = await QualCourseSubscription.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to update qualCourseSubscription",
          err.message,
        ),
      );
    }
  },
};
