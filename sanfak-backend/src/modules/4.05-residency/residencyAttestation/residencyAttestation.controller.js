const { ErrorHandler } = require("#shared/error");
const Attestation = require("./residencyAttestation.model");
const Result = require("./residencyAttestationResult.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { STATUS_IN_STUDY } = Resident;
const {
  applyAcademicYearFilter,
} = require("#modules/4.05-residency/_services/academicYearFilter");
const {
  applyCourseFilter,
} = require("#modules/4.05-residency/_services/courseFilter");
const { searchOr } = require("#modules/4.05-residency/_services/searchTerm");

function residentFilter(q) {
  const f = {
    active: true,

    status: STATUS_IN_STUDY,

    expulsionOrderCreated: { $ne: true },
  };
  if (q.specialty) f.specialty = q.specialty;
  if (q.program) f.program = q.program;
  applyCourseFilter(f, q.courseNumber);
  if (q.group) f.group = q.group;
  applyAcademicYearFilter(f, q.academicYear);
  return f;
}

function buildListFilter(query) {
  const { search, academicYear, courseNumber, group, specialty } = query;
  const data = {};
  applyAcademicYearFilter(data, academicYear);
  applyCourseFilter(data, courseNumber);
  if (group) data.group = group;
  if (specialty) data.specialty = specialty;
  const or = searchOr(search, ["scienceTitle", "specialtyTitle"]);
  if (or) data.$or = or;
  return data;
}

module.exports = {
  _residentFilter: residentFilter,

  preview: async (req, res, next) => {
    try {
      const count = await Resident.countDocuments(residentFilter(req.query));
      return res.status(200).json({ count });
    } catch (err) {
      return next(new ErrorHandler(400, "Preview xatosi", err.message));
    }
  },

  addAttestation: async (req, res, next) => {
    try {
      const doc = await new Attestation(req.body).save();
      const residents = await Resident.find(residentFilter(req.body))
        .select("fullName")
        .lean();
      if (residents.length) {
        await Result.insertMany(
          residents.map((r) => ({
            attestation: doc._id,
            resident: r._id,
            residentName: r.fullName,
            score: null,
            included: true,
          })),
          { ordered: false },
        );
      }
      return res
        .status(201)
        .json({ message: "successfully created", enrolled: residents.length });
    } catch (err) {
      return next(new ErrorHandler(400, "Attestatsiya qo'shishda xato", err.message));
    }
  },

  findAllAttestations: async (req, res, next) => {
    try {
      const docs = await Attestation.find(buildListFilter(req.query)).sort({ date: -1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Attestatsiya ro'yxati xatosi", err.message));
    }
  },

  paginateAttestations: async (req, res, next) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const doc = await Attestation.paginate(buildListFilter(req.query), {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { date: -1 },
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Attestatsiya sahifalash xatosi", err.message));
    }
  },

  findOneAttestation: async (req, res, next) => {
    try {
      const doc = await Attestation.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      const results = await Result.find({ attestation: doc._id, active: true })
        .select("score included")
        .lean();
      const scored = results.filter((r) => r.included && r.score !== null);
      const summary = {
        total: results.length,
        included: results.filter((r) => r.included).length,
        scored: scored.length,
        avgScore: scored.length
          ? Number(
              (scored.reduce((s, r) => s + (r.score || 0), 0) / scored.length).toFixed(1),
            )
          : null,
      };
      return res.status(200).json({ attestation: doc, summary });
    } catch (err) {
      return next(new ErrorHandler(400, "Attestatsiyani topishda xato", err.message));
    }
  },

  listResults: async (req, res, next) => {
    try {
      const docs = await Result.find({ attestation: req.params.id }).populate({
        path: "resident",
        select: "fullName program specialtyTitle courseNumber groupTitle",
      });

      const nameOf = (d) => String(d.resident?.fullName || d.residentName || "");
      docs.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Natijalar ro'yxati xatosi", err.message));
    }
  },

  updateResult: async (req, res, next) => {
    try {
      const update = {};
      if (req.body.score !== undefined) update.score = req.body.score;
      if (req.body.included !== undefined) {
        update.included = req.body.included;
        if (req.body.included === true) update.excludeReason = null;
      }
      if (req.body.excludeReason !== undefined)
        update.excludeReason = req.body.excludeReason;

      const doc = await Result.findOneAndUpdate(
        { _id: req.params.resultId, attestation: req.params.id },
        update,
        { new: true, runValidators: true },
      );
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Natijani yangilashda xato", err.message));
    }
  },

  deleteResult: async (req, res, next) => {
    try {
      const doc = await Result.findOne({
        _id: req.params.resultId,
        attestation: req.params.id,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(new ErrorHandler(400, "Natijani o'chirishda xato", err.message));
    }
  },

  updateAttestation: async (req, res, next) => {
    try {
      const doc = await Attestation.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Attestatsiyani yangilashda xato", err.message));
    }
  },

  deleteAttestation: async (req, res, next) => {
    try {
      const doc = await Attestation.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(new ErrorHandler(400, "Attestatsiyani o'chirishda xato", err.message));
    }
  },
};
