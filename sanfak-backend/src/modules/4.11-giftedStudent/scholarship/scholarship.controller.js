const { ErrorHandler } = require("#shared/error");
const { isScoringComplete, touchesScoring } = require("../_services/scoringComplete");
const { rolesGranting } = require("../_services/roleEligibility");
const { usersWithRoles } = require("../_services/userCandidates");
const { JUDGE, isJudge } = require("../_services/moduleRoles");
const ScholarshipApplicationModel = require("#modules/4.11-giftedStudent/scholarshipApplication/scholarshipApplication.model");
const ScholarshipModel = require("./scholarship.model");
const { applyAcademicYearFilter } = require("../_services/academicYearFilter");
const { applyFreshTitles } = require("../_services/freshTitles");
const { searchRegex } = require("../_services/searchTerm");
const {
  resolveApplicant,
  attachCanApply,
} = require("../_services/scholarshipCanApply");

const buildFilter = (query) => {
  const { type, academicYear, active, search } = query;
  const filter = {};
  if (type) filter.type = type;
  applyAcademicYearFilter(filter, academicYear);
  if (active !== undefined) filter.active = active;
  const rx = searchRegex(search);
  if (rx) filter.name = rx;
  return filter;
};

const withJudgeScope = (filter, req) => {
  if (isJudge(req.user?.role)) filter.judges = req.user._id;
  return filter;
};

module.exports = {
  judgeCandidates: async (req, res, next) => {
    try {
      const roleIds = await rolesGranting(JUDGE.required, JUDGE);
      return res.status(200).json(await usersWithRoles(roleIds));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to list judge candidates", err.message),
      );
    }
  },

  addScholarship: async (req, res, next) => {
    try {
      const doc = await new ScholarshipModel(req.body).save();
      return res.status(201).json({ message: "successfully created", id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add scholarship", err.message),
      );
    }
  },

  findAllScholarships: async (req, res, next) => {
    try {
      const applicant = await resolveApplicant(req.user);
      const docs = await ScholarshipModel.find(withJudgeScope(buildFilter(req.query), req), {
        createdAt: 0,
        updatedAt: 0,
      }).exec();
      return res.status(200).json(attachCanApply(docs, applicant));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find scholarships", err.message),
      );
    }
  },

  paginateScholarships: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        select: ["-createdAt", "-updatedAt"],
        sort: { createdAt: -1 },
      };
      const applicant = await resolveApplicant(req.user);
      const doc = await ScholarshipModel.paginate(withJudgeScope(buildFilter(req.query), req), options);
      doc.docs = attachCanApply(doc.docs, applicant);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate scholarships", err.message),
      );
    }
  },

  findOneScholarship: async (req, res, next) => {
    try {
      const doc = await ScholarshipModel.findById(req.params.id, {
        createdAt: 0,
        updatedAt: 0,
      })
        .populate("judges", "firstName lastName")
        .populate("criteria.criteria")
        .exec();
      if (!doc) return res.status(404).json({ message: "not found" });

      const out = doc.toObject();
      out.scoringComplete = await isScoringComplete(doc);
      return res.status(200).json(out);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find scholarship", err.message),
      );
    }
  },

  findApplicants: async (req, res, next) => {
    try {
      const docs = await ScholarshipApplicationModel.find({
        scholarship: req.params.id,
        status: "approved",
      })
        .select("giftedStudent appliedAt createdAt")
        .populate({
          path: "giftedStudent",
          select: "fullName faculty facultyId direction directionId course group groupId",
        })
        .sort({ createdAt: 1 })
        .lean();

      const applicants = docs
        .filter((d) => d.giftedStudent)
        .map((d) => ({ ...d.giftedStudent, appliedAt: d.appliedAt || d.createdAt }));
      return res.status(200).json(await applyFreshTitles(applicants));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find scholarship applicants", err.message),
      );
    }
  },

  updateScholarship: async (req, res, next) => {
    try {
      const current = await ScholarshipModel.findById(req.params.id)
        .select("type judges")
        .lean();
      if (!current) return res.status(404).json({ message: "not found" });

      if (touchesScoring(req.body) && (await isScoringComplete(current))) {
        return res.status(400).json({
          message:
            "Baholash yakunlangan — yo'nalishni tahrirlab bo'lmaydi (faqat Faol/Nofaol holatini o'zgartirish mumkin)",
        });
      }

      const doc = await ScholarshipModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update scholarship", err.message),
      );
    }
  },

  deleteScholarship: async (req, res, next) => {
    try {
      const doc = await ScholarshipModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete scholarship", err.message),
      );
    }
  },
};
