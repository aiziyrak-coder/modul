const { ErrorHandler } = require("#shared/error");
const {
  RESIDENT_REF_POPULATE,
} = require("#modules/4.05-residency/_services/residentRefPopulate");
const Assessment = require("./assessment.model");
const {
  checkAttestationEligibility,
} = require("#modules/4.05-residency/_services/attestationCheck");
const { buildResidentScope } = require("../_services/residentScope");

const POP = [
  {
    path: "resident",
    select:
      "fullName program courseNumber groupTitle specialtyTitle departmentTitle specialty department group",
    populate: RESIDENT_REF_POPULATE,
  },
  { path: "science", select: "title" },
  { path: "assessor", select: "firstName lastName middleName" },
];

function buildFilter(query) {
  const { science, type, active, test } = query;
  const data = {};
  if (science) data.science = science;
  if (type) data.type = type;
  if (test) data.test = test;
  data.active = active !== undefined ? active : true;
  return data;
}

async function denyAssessmentWrite(req, res, residentId) {
  if (!residentId) {
    res.status(400).json({ message: "Rezident ko'rsatilmagan" });
    return true;
  }
  const { denied } = await buildResidentScope(req.user, String(residentId));
  if (denied) {
    res.status(403).json({ message: "Bu rezidentga ball qo'yish huquqi yo'q" });
    return true;
  }
  return false;
}

module.exports = {
  addAssessment: async (req, res, next) => {
    try {
      if (await denyAssessmentWrite(req, res, req.body.resident)) return undefined;

      const doc = await new Assessment({
        ...req.body,
        assessor: req.user?._id,
      }).save();
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Baho qo'shishda xato", err.message));
    }
  },

  gradeAssessment: async (req, res, next) => {
    try {
      const { resident, science, type, score, maxScore = 100 } = req.body;

      if (await denyAssessmentWrite(req, res, resident)) return undefined;

      if (score > maxScore) {
        return next(
          new ErrorHandler(
            400,
            `Ball ${maxScore} ballik tizim chegarasidan tashqarida (${score})`,
          ),
        );
      }

      const doc = await Assessment.create({
        resident,
        science,
        type,
        score,
        maxScore,
        assessor: req.user?._id,
      });

      return res.status(201).json({
        message: "Ball qo'yildi",
        _id: doc._id,
        score,
        percentage: ((score / maxScore) * 100).toFixed(2),
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Ball qo'yishda xatolik", err.message));
    }
  },

  findAllAssessments: async (req, res, next) => {
    try {
      const { filter } = await buildResidentScope(req.user, req.query.resident);
      const docs = await Assessment.find({ ...buildFilter(req.query), ...filter })
        .populate(POP)
        .sort({ createdAt: -1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Baholar ro'yxati xatosi", err.message));
    }
  },

  paginateAssessments: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const { filter } = await buildResidentScope(req.user, req.query.resident);
      const doc = await Assessment.paginate(
        { ...buildFilter(req.query), ...filter },
        {
          page: parseInt(page),
          limit: parseInt(limit),
          sort: { createdAt: -1 },
          populate: POP,
        },
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Baho sahifalash xatosi", err.message));
    }
  },

  findAssessmentsByResident: async (req, res, next) => {
    try {
      const { residentId } = req.params;
      const { filter, denied } = await buildResidentScope(req.user, residentId);
      if (denied) {
        return next(new ErrorHandler(403, "Bu rezident ma'lumotiga ruxsat yo'q"));
      }
      const docs = await Assessment.find({ ...filter, active: true })
        .populate(POP)
        .sort({ createdAt: -1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Rezident baholari xatosi", err.message));
    }
  },

  attestationEligibility: async (req, res, next) => {
    try {
      const { residentId } = req.params;
      const { science, fromDate, toDate } = req.query;

      const { denied } = await buildResidentScope(req.user, residentId);
      if (denied) {
        return next(new ErrorHandler(403, "Bu rezident ma'lumotiga ruxsat yo'q"));
      }

      const result = await checkAttestationEligibility(residentId, {
        science,
        fromDate,
        toDate,
      });
      return res.status(200).json(result);
    } catch (err) {
      return next(new ErrorHandler(400, "Eligibility hisoblashda xatolik", err.message));
    }
  },

  updateAssessment: async (req, res, next) => {
    try {
      const current = await Assessment.findById(req.params.id).select("resident").lean();
      if (!current) return res.status(404).json({ message: "not found" });
      if (await denyAssessmentWrite(req, res, current.resident)) return undefined;
      if (req.body.resident && String(req.body.resident) !== String(current.resident)) {
        if (await denyAssessmentWrite(req, res, req.body.resident)) return undefined;
      }

      const doc = await Assessment.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Bahoni yangilashda xato", err.message));
    }
  },

  deleteAssessment: async (req, res, next) => {
    try {
      const doc = await Assessment.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      if (await denyAssessmentWrite(req, res, doc.resident)) return undefined;
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(new ErrorHandler(400, "Bahoni o'chirishda xato", err.message));
    }
  },
};
