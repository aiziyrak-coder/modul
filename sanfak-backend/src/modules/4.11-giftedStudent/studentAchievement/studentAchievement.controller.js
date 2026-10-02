const { ErrorHandler } = require("#shared/error");
const { notify } = require("#system/notification/notification.service");
const {
  validateAchievementScore,
} = require("#modules/4.11-giftedStudent/_services/scoringLimits");
const {
  notifyStudent,
  EVENTS,
  LINKS,
} = require("#modules/4.11-giftedStudent/_services/giftedNotify");
const {
  denyStudentAccess,
  resolveOwnedGiftedStudentIds,
} = require("../_services/studentAccess");
const { isAchievementReviewer } = require("../_services/moduleRoles");
const { searchOr } = require("../_services/searchTerm");
const { applyFreshTitles } = require("../_services/freshTitles");
const { snapshotReview } = require("../_services/reviewHistory");
const { academicYearOf } = require("../_services/academicYearWindow");
const StudentAchievementModel = require("./studentAchievement.model");
const GiftedStudentModel = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");
const DocumentTypeModel = require("#modules/4.11-giftedStudent/documentType/documentType.model");

const STUDENT_POP = {
  path: "student",
  select: "fullName faculty facultyId direction directionId course group groupId",
};

const freshenStudents = (docs) =>
  applyFreshTitles(docs.map((d) => d.student).filter(Boolean));

async function personalExclusion(req) {
  if (isAchievementReviewer(req.user?.role)) return {};
  const personalIds = await DocumentTypeModel.find({ personal: true }).distinct("_id");
  return personalIds.length ? { documentType: { $nin: personalIds } } : {};
}

const yearOfAchievement = (a) => a.academicYear || academicYearOf(a.createdAt);

async function recalcTotal(studentId) {
  const approved = await StudentAchievementModel.find({
    student: studentId,
    status: "approved",
  }).exec();

  const scoresByYear = {};
  let totalScore = 0;
  for (const a of approved) {
    const score = a.score || 0;
    totalScore += score;
    const year = yearOfAchievement(a);
    if (year) scoresByYear[year] = (scoresByYear[year] || 0) + score;
  }

  await GiftedStudentModel.findByIdAndUpdate(studentId, { totalScore, scoresByYear });
}

module.exports = {
  addAchievement: async (req, res, next) => {
    try {
      if (!req.body.student) {
        return res.status(400).json({ message: "`student` majburiy" });
      }
      if (await denyStudentAccess(req, res, req.body.student)) return undefined;

      const doc = await new StudentAchievementModel(req.body).save();
      return res.status(201).json({ message: "successfully created", id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to add student achievement", err.message));
    }
  },

  addMyAchievement: async (req, res, next) => {
    try {
      const gs = await GiftedStudentModel.findOne({ user: req.user._id });
      if (!gs)
        return res.status(404).json({ message: "Siz iqtidorli talabalar ro'yxatida emassiz" });
      const doc = await new StudentAchievementModel({
        ...req.body,
        student: gs._id,
        status: "pending",
      }).save();
      return res.status(201).json({ message: "successfully created", id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to add achievement", err.message));
    }
  },

  findAllAchievements: async (req, res, next) => {
    try {
      const { status, search } = req.query;

      const ownedIds = await resolveOwnedGiftedStudentIds(req.user);
      const filter = { ...(await personalExclusion(req)) };
      if (ownedIds) filter.student = { $in: ownedIds };
      if (status) filter.status = status;
      const or = searchOr(search, ["title", "desc"]);
      if (or) filter.$or = or;
      const docs = await StudentAchievementModel.find(filter, { updatedAt: 0 })
        .populate(STUDENT_POP)
        .populate("documentType")
        .sort({ createdAt: -1 })
        .lean()
        .exec();
      await freshenStudents(docs);
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find achievements", err.message));
    }
  },

  findMyAchievements: async (req, res, next) => {
    try {
      const gs = await GiftedStudentModel.findOne({ user: req.user._id });
      if (!gs) return res.status(200).json([]);
      const docs = await StudentAchievementModel.find({ student: gs._id }, { updatedAt: 0 })
        .populate("documentType")
        .sort({ createdAt: -1 })
        .exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find my achievements", err.message));
    }
  },

  findAchievementsByStudent: async (req, res, next) => {
    try {
      if (await denyStudentAccess(req, res, req.params.studentId)) return undefined;
      const docs = await StudentAchievementModel.find(
        { student: req.params.studentId, ...(await personalExclusion(req)) },
        { updatedAt: 0 },
      )
        .populate(STUDENT_POP)
        .populate("documentType")
        .sort({ createdAt: -1 })
        .lean()
        .exec();
      await freshenStudents(docs);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find achievements by student", err.message),
      );
    }
  },

  updateAchievement: async (req, res, next) => {
    try {
      const current = await StudentAchievementModel.findById(req.params.id);
      if (!current) return res.status(404).json({ message: "not found" });
      const patch = { ...req.body };
      const priorReview =
        current.status === "rejected"
          ? snapshotReview(current, { withScore: true })
          : null;
      if (current.status === "rejected") {
        patch.status = "pending";
        patch.reviewNote = null;
        patch.reviewedBy = null;
        patch.reviewedAt = null;
        patch.score = 0;
      }
      const update = priorReview
        ? { $set: patch, $push: { reviewHistory: priorReview } }
        : patch;
      await StudentAchievementModel.findByIdAndUpdate(req.params.id, update, { new: true });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to update student achievement", err.message));
    }
  },

  updateMyAchievement: async (req, res, next) => {
    try {
      const gs = await GiftedStudentModel.findOne({ user: req.user._id });
      if (!gs)
        return res.status(404).json({ message: "Siz iqtidorli talabalar ro'yxatida emassiz" });
      const current = await StudentAchievementModel.findById(req.params.id);
      if (!current) return res.status(404).json({ message: "not found" });
      if (String(current.student) !== String(gs._id)) {
        return res.status(403).json({ message: "Bu faoliyat sizga tegishli emas" });
      }
      const patch = { ...req.body };

      const wasApproved = current.status === "approved";
      const priorReview = snapshotReview(current, { withScore: true });
      if (current.status !== "pending") {
        patch.status = "pending";
        patch.reviewNote = null;
        patch.reviewedBy = null;
        patch.reviewedAt = null;
        patch.score = 0;
        patch.scoreCriteria = null;
        patch.scoreCategoryId = null;
        patch.scoreLabel = null;
      }
      const update = priorReview
        ? { $set: patch, $push: { reviewHistory: priorReview } }
        : patch;
      await StudentAchievementModel.findByIdAndUpdate(req.params.id, update, { new: true });

      if (wasApproved) await recalcTotal(current.student);

      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to update my achievement", err.message));
    }
  },

  reviewAchievement: async (req, res, next) => {
    try {
      const { status, reviewNote, score, scoreCriteria, scoreCategoryId, scoreLabel } = req.body;

      const current = await StudentAchievementModel.findById(req.params.id);
      if (!current) return res.status(404).json({ message: "not found" });
      const priorReview = snapshotReview(current, { withScore: true });

      const update = {
        status,
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
        reviewNote: status === "rejected" ? reviewNote || "" : "",
      };
      if (status === "approved") {
        const scoreError = await validateAchievementScore({
          scoreCriteria,
          scoreCategoryId,
          score,
        });
        if (scoreError) {
          return next(new ErrorHandler(400, scoreError, scoreError));
        }
        if (score !== undefined) update.score = score;
        update.scoreCriteria = scoreCriteria || null;
        update.scoreCategoryId = scoreCategoryId || null;
        update.scoreLabel = scoreLabel || null;
      } else {
        update.scoreCriteria = null;
        update.scoreCategoryId = null;
        update.scoreLabel = null;
      }
      const doc = await StudentAchievementModel.findByIdAndUpdate(
        req.params.id,
        priorReview ? { $set: update, $push: { reviewHistory: priorReview } } : update,
        { new: true },
      );
      if (!doc) return res.status(404).json({ message: "not found" });
      await recalcTotal(doc.student);

      const outcome = status === "approved" ? "tasdiqlandi ✅" : "rad etildi ❌";
      const extra =
        status === "approved" && doc.score
          ? `\nBall: <b>${doc.score}</b>`
          : status === "rejected" && doc.reviewNote
            ? `\nSabab: ${doc.reviewNote}`
            : "";
      await notify({
        message: `🏅 <b>Faoliyat holati o'zgardi</b>\n"${doc.title || "Faoliyat"}" ${outcome}${extra}`,
        type: "telegram",
      });

      await notifyStudent(doc.student, {
        eventType: EVENTS.ACHIEVEMENT_REVIEWED,
        title:
          status === "approved" ? "Faoliyatingiz tasdiqlandi" : "Faoliyatingiz rad etildi",
        body: `"${doc.title || "Faoliyat"}"${
          status === "approved" && doc.score ? ` — ${doc.score} ball` : ""
        }${status === "rejected" && doc.reviewNote ? ` — ${doc.reviewNote}` : ""}`,
        link: LINKS.STUDENT_ACTIVITIES,
      });

      return res.status(200).json({
        message: status === "approved" ? "Faoliyat tasdiqlandi" : "Faoliyat rad etildi",
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to review student achievement", err.message));
    }
  },

  deleteAchievement: async (req, res, next) => {
    try {
      const doc = await StudentAchievementModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      await recalcTotal(doc.student);
      return res.status(200).json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to delete student achievement", err.message));
    }
  },
};
