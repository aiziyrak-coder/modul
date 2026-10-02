const { ErrorHandler } = require("#shared/error");
const Curriculum = require("./residencyCurriculum.model");
const {
  applyAcademicYearFilter,
} = require("#modules/4.05-residency/_services/academicYearFilter");
const {
  applyEducationFormFilter,
} = require("#modules/4.05-residency/_services/educationFormFilter");
const { searchRegex } = require("#modules/4.05-residency/_services/searchTerm");

const POP = [{ path: "specialty", select: "title code program" }];

function buildFilter(query) {
  const { search, specialty, program, academicYear, educationForm, active } =
    query;
  const data = {};
  if (specialty) data.specialty = specialty;
  if (program) data.program = program;
  applyAcademicYearFilter(data, academicYear);
  applyEducationFormFilter(data, educationForm);
  if (active !== undefined) data.active = active;
  const rx = searchRegex(search);
  if (rx) data.title = rx;
  return data;
}

module.exports = {
  addCurriculum: async (req, res, next) => {
    try {
      await new Curriculum(req.body).save();
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(new ErrorHandler(400, "O'quv reja qo'shishda xato", err.message));
    }
  },

  findAllCurriculums: async (req, res, next) => {
    try {
      const docs = await Curriculum.find(buildFilter(req.query))
        .populate(POP)
        .sort({ createdAt: -1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "O'quv reja ro'yxati xatosi", err.message));
    }
  },

  paginateCurriculums: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const doc = await Curriculum.paginate(buildFilter(req.query), {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: POP,
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "O'quv reja sahifalash xatosi", err.message));
    }
  },

  findCurriculum: async (req, res, next) => {
    try {
      const doc = await Curriculum.findById(req.params.id).populate(POP);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "O'quv rejani olishda xato", err.message));
    }
  },

  updateCurriculum: async (req, res, next) => {
    try {
      const doc = await Curriculum.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "O'quv rejani yangilashda xato", err.message));
    }
  },

  deleteCurriculum: async (req, res, next) => {
    try {
      const doc = await Curriculum.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(new ErrorHandler(400, "O'quv rejani o'chirishda xato", err.message));
    }
  },
};
