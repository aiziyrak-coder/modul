const { ErrorHandler } = require("#shared/error");
const ResidencyTest = require("./residencyTest.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Assessment = require("#modules/4.05-residency/assessment/assessment.model");
const {
  allowedResidentIds,
} = require("#modules/4.05-residency/_services/residentScope");
const S = require("./residencyTest.service");

const RESIDENT_FIELDS = "fullName program specialtyTitle courseNumber groupTitle";

async function scopeSet(user) {
  const allowed = await allowedResidentIds(user);
  return allowed === null ? null : new Set(allowed.map(String));
}

async function loadRoster(test, user) {
  const inScope = await scopeSet(user);

  const filter = S.residentFilter(test);
  if (inScope !== null) filter._id = { $in: [...inScope] };

  const residents = await Resident.find(filter).select(RESIDENT_FIELDS).lean();

  const assessments = await Assessment.find({
    test: test._id,
    type: "test",
    active: true,
  })
    .select("resident score maxScore updatedAt")
    .lean();

  return { rows: S.joinResults(residents, assessments), inScope };
}

function requireTestManager(req, res, next) {
  if (S.canManageTests(req.user)) return next();
  return res.status(403).json({
    message: "Sinov testini faqat magistratura va klinik ordinatura bo'limi yuklaydi",
  });
}

module.exports = {
  requireTestManager,

  preview: async (req, res, next) => {
    try {
      const count = await Resident.countDocuments(S.residentFilter(req.query));
      return res.status(200).json({ count });
    } catch (err) {
      return next(new ErrorHandler(400, "Preview xatosi", err.message));
    }
  },

  addTest: async (req, res, next) => {
    try {
      const doc = await new ResidencyTest({
        ...req.body,
        uploadedBy: req.user?._id,
      }).save();
      const eligible = await Resident.countDocuments(S.residentFilter(doc));
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id, eligible });
    } catch (err) {
      return next(new ErrorHandler(400, "Sinov qo'shishda xato", err.message));
    }
  },

  findAllTests: async (req, res, next) => {
    try {
      const docs = await ResidencyTest.find(S.buildListFilter(req.query)).sort({
        date: -1,
      });
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Sinovlar ro'yxati xatosi", err.message));
    }
  },

  paginateTests: async (req, res, next) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const doc = await ResidencyTest.paginate(S.buildListFilter(req.query), {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { date: -1 },
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Sinovlar sahifalash xatosi", err.message));
    }
  },

  findOneTest: async (req, res, next) => {
    try {
      const doc = await ResidencyTest.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      const { rows } = await loadRoster(doc, req.user);
      return res.status(200).json({ test: doc, summary: S.summarize(rows) });
    } catch (err) {
      return next(new ErrorHandler(400, "Sinovni topishda xato", err.message));
    }
  },

  listResults: async (req, res, next) => {
    try {
      const doc = await ResidencyTest.findById(req.params.id).select(
        "specialty program courseNumber courseRef group academicYear maxScore",
      );
      if (!doc) return res.status(404).json({ message: "not found" });

      const { rows } = await loadRoster(doc, req.user);
      return res
        .status(200)
        .json({ maxScore: doc.maxScore, results: rows, summary: S.summarize(rows) });
    } catch (err) {
      return next(new ErrorHandler(400, "Natijalar ro'yxati xatosi", err.message));
    }
  },

  upsertResults: async (req, res, next) => {
    try {
      const test = await ResidencyTest.findById(req.params.id);
      if (!test) return res.status(404).json({ message: "not found" });

      const inCutDocs = await Resident.find(S.residentFilter(test))
        .select("_id")
        .lean();
      const inCut = new Set(inCutDocs.map((r) => String(r._id)));
      const inScope = await scopeSet(req.user);

      const check = S.validateResults(req.body.results, inCut, inScope, test.maxScore);
      if (!check.ok) return res.status(check.status).json({ message: check.message });

      let updated = 0;
      for (const row of req.body.results) {
        await Assessment.findOneAndUpdate(
          { test: test._id, resident: row.resident, type: "test" },
          {
            $set: {
              score: row.score,
              maxScore: test.maxScore,
              science: test.science ?? null,
              assessor: req.user?._id ?? null,
            },
            $setOnInsert: { active: true },
          },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
        );
        updated += 1;
      }

      return res.status(200).json({ message: "successfully updated", updated });
    } catch (err) {
      return next(new ErrorHandler(400, "Natijalarni saqlashda xato", err.message));
    }
  },

  updateTest: async (req, res, next) => {
    try {
      const doc = await ResidencyTest.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Sinovni yangilashda xato", err.message));
    }
  },

  deleteTest: async (req, res, next) => {
    try {
      const doc = await ResidencyTest.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(new ErrorHandler(400, "Sinovni o'chirishda xato", err.message));
    }
  },
};
