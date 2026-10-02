const { ErrorHandler } = require("#shared/error");
const {
  denyStudentAccess,
  resolveOwnedGiftedStudentIds,
} = require("../_services/studentAccess");
const { validateScores } = require("../_services/scoringLimits");
const {
  checkApplyEligibility,
  ELIGIBILITY_FIELDS,
} = require("../_services/applicationEligibility");
const { applyFreshTitles } = require("../_services/freshTitles");
const { searchOr } = require("../_services/searchTerm");
const { snapshotReview } = require("../_services/reviewHistory");
const ScholarshipApplication = require("./scholarshipApplication.model");
const GiftedStudent = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");
const ScholarshipModel = require("#modules/4.11-giftedStudent/scholarship/scholarship.model");
const { notify, templates } = require("#system/notification/notification.service");
const {
  notifyStudent,
  EVENTS,
  LINKS,
} = require("#modules/4.11-giftedStudent/_services/giftedNotify");

module.exports = {
  applyForScholarship: async (req, res, next) => {
    try {
      const {
        scholarship,
        type,
        scholarshipName,
        motivation,
        documents,
        period,
        academicYear,
      } = req.body;

      const gifted = await GiftedStudent.findOne({ user: req.user._id });
      if (!gifted) {
        return res.status(404).json({
          message: "Siz iqtidorli talabalar ro'yxatida emassiz",
        });
      }

      if (scholarship) {
        const sch = await ScholarshipModel.findById(scholarship).select(ELIGIBILITY_FIELDS);
        const problem = checkApplyEligibility(sch, gifted);
        if (problem) return res.status(400).json(problem);
      }

      const ACTIVE_STATUSES = ["pending", "approved"];
      const dupFilter = { giftedStudent: gifted._id, status: { $in: ACTIVE_STATUSES } };
      if (scholarship) dupFilter.scholarship = scholarship;
      else dupFilter.type = type;

      if (academicYear) dupFilter.academicYear = academicYear;
      const existing = await ScholarshipApplication.findOne(dupFilter);
      if (existing) {
        return res.status(400).json({
          message:
            existing.status === "approved"
              ? "Bu stipendiya sizga allaqachon tasdiqlangan"
              : "Bu stipendiya uchun kutilayotgan arizangiz mavjud",
        });
      }

      const reuseFilter = { ...dupFilter, status: "rejected" };
      if (academicYear) reuseFilter.academicYear = academicYear;
      const rejected = await ScholarshipApplication.findOne(reuseFilter).sort({
        createdAt: -1,
      });

      if (rejected) {
        const priorReview = snapshotReview(rejected, { note: "rejectReason" });
        if (priorReview) rejected.reviewHistory.push(priorReview);

        rejected.status = "pending";
        rejected.appliedAt = new Date();
        rejected.rejectReason = undefined;
        rejected.reviewedBy = undefined;
        rejected.reviewedAt = undefined;
        if (scholarshipName !== undefined) rejected.scholarshipName = scholarshipName;
        if (motivation !== undefined) rejected.motivation = motivation;
        if (documents !== undefined) rejected.documents = documents;
        if (period !== undefined) rejected.period = period;
        if (academicYear !== undefined) rejected.academicYear = academicYear;
        await rejected.save();

        return res
          .status(201)
          .json({ message: "Stipendiya arizasi muvaffaqiyatli topshirildi" });
      }

      const doc = await new ScholarshipApplication({
        giftedStudent: gifted._id,
        scholarship,
        type,
        scholarshipName,
        motivation,
        documents,
        period,
        academicYear,
      }).save();

      if (!doc) return res.status(404).json({ message: "Saqlab bo'lmadi" });
      return res
        .status(201)
        .json({ message: "Stipendiya arizasi muvaffaqiyatli topshirildi" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ariza topshirishda xato", err.message),
      );
    }
  },

  findAll: async (req, res, next) => {
    try {
      const { type, status, search, page = 1, limit = 20 } = req.query;
      const ownedIds = await resolveOwnedGiftedStudentIds(req.user);
      const filter = {};
      if (ownedIds) filter.giftedStudent = { $in: ownedIds };
      if (type) filter.type = type;
      if (status) filter.status = status;
      const or = searchOr(search, ["scholarshipName"]);
      if (or) filter.$or = or;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
          {
            path: "giftedStudent",
            select: "-passportSeria -passportNumber -jshshir -email -phone",
            populate: { path: "user", select: "firstName lastName" },
          },
          { path: "scholarship", select: "name type" },
          { path: "reviewedBy", select: "firstName lastName" },
        ],
        select: "-updatedAt",
        lean: true,
      };

      const doc = await ScholarshipApplication.paginate(filter, options);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      await applyFreshTitles(
        (doc.docs || []).map((d) => d.giftedStudent).filter(Boolean),
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Arizalar ro'yxatini olishda xato", err.message),
      );
    }
  },

  getMyApplications: async (req, res, next) => {
    try {
      const gifted = await GiftedStudent.findOne({ user: req.user._id });
      if (!gifted) return res.status(200).json([]);

      const docs = await ScholarshipApplication.find({ giftedStudent: gifted._id })
        .select(
          "scholarship scholarshipName type status period academicYear appliedAt reviewedAt rejectReason amount createdAt",
        )
        .populate("scholarship", "name type")
        .sort({ createdAt: -1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Arizalarni olishda xato", err.message),
      );
    }
  },

  findByStudent: async (req, res, next) => {
    try {
      if (await denyStudentAccess(req, res, req.params.studentId)) return undefined;
      const docs = await ScholarshipApplication.find({
        giftedStudent: req.params.studentId,
      })
        .select(
          "scholarship scholarshipName type status period academicYear appliedAt reviewedAt rejectReason amount createdAt",
        )
        .populate("scholarship", "name type")
        .sort({ createdAt: -1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Talaba arizalarini olishda xato", err.message),
      );
    }
  },

  findOne: async (req, res, next) => {
    try {
      const doc = await ScholarshipApplication.findById(req.params.id)
        .populate({
          path: "giftedStudent",
          populate: { path: "user", select: "firstName lastName photo" },
        })
        .populate("reviewedBy", "firstName lastName");
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      if (await denyStudentAccess(req, res, doc.giftedStudent?._id)) return undefined;
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Arizani olishda xato", err.message));
    }
  },

  reviewApplication: async (req, res, next) => {
    try {
      const { status, rejectReason, amount, period } = req.body;

      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({
          message: "Status faqat 'approved' yoki 'rejected' bo'lishi mumkin",
        });
      }

      const doc = await ScholarshipApplication.findByIdAndUpdate(
        req.params.id,
        {
          status,
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          ...(status === "rejected" && rejectReason ? { rejectReason } : {}),
          ...(status === "approved" && amount ? { amount, period } : {}),
        },
        { new: true },
      );

      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      await notify({
        message: templates.scholarshipResult(doc.type, status),
        type: "telegram",
      });

      await notifyStudent(doc.giftedStudent, {
        eventType: EVENTS.APPLICATION_REVIEWED,
        title: status === "approved" ? "Stipendiya arizangiz tasdiqlandi" : "Stipendiya arizangiz rad etildi",
        body:
          status === "rejected" && doc.rejectReason
            ? doc.rejectReason
            : status === "approved" && doc.amount
              ? String(doc.amount)
              : "",
        link: LINKS.STUDENT_SCHOLARSHIPS,
      });

      return res.status(200).json({
        message:
          status === "approved" ? "Ariza tasdiqlandi" : "Ariza rad etildi",
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Arizani ko'rib chiqishda xato", err.message),
      );
    }
  },

  scoreApplication: async (req, res, next) => {
    try {
      const { scores } = req.body;
      const app = await ScholarshipApplication.findById(req.params.id);
      if (!app) return res.status(404).json({ message: "Topilmadi" });

      const sch = await ScholarshipModel.findById(app.scholarship).select("judges criteria");
      const isAssigned =
        sch && (sch.judges || []).some((j) => String(j) === String(req.user._id));
      if (!isAssigned) {
        return res
          .status(403)
          .json({ message: "Siz bu yo'nalishga tayinlangan hakam emassiz" });
      }

      const scoreError = await validateScores(sch, scores);
      if (scoreError) return res.status(400).json({ message: scoreError });

      const totalScore = scores.reduce((s, x) => s + (x.value || 0), 0);
      const entry = {
        judge: req.user._id,
        scores,
        totalScore,
        submittedAt: new Date(),
      };
      const idx = app.judgeScores.findIndex(
        (j) => String(j.judge) === String(req.user._id),
      );

      if (idx >= 0) {
        const previous = app.judgeScores[idx];
        app.judgeScoreHistory.push({
          judge: previous.judge,
          scores: previous.scores,
          totalScore: previous.totalScore,
          submittedAt: previous.submittedAt,
          supersededAt: entry.submittedAt,
          supersededBy: req.user._id,
        });
        app.judgeScores[idx] = entry;
      } else {
        app.judgeScores.push(entry);
      }
      await app.save();

      return res.status(200).json({
        message: "Baholar saqlandi",
        corrected: idx >= 0,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Baholashda xato", err.message));
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await ScholarshipApplication.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "O'chirildi" });
    } catch (err) {
      return next(new ErrorHandler(400, "O'chirishda xato", err.message));
    }
  },
};
