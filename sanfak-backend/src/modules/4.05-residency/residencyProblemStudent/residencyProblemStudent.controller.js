const { ErrorHandler } = require("#shared/error");
const ProblemStudent = require("./residencyProblemStudent.model");
const {
  applyAcademicYearFilter,
} = require("#modules/4.05-residency/_services/academicYearFilter");
const {
  applyCourseFilter,
} = require("#modules/4.05-residency/_services/courseFilter");
const { searchRegex } = require("../_services/searchTerm");

const POP = [
  { path: "specialty", select: "title code" },
  { path: "department", select: "title" },
];

function buildFilter(query) {
  const {
    search,
    academicYear,
    program,
    specialty,
    department,
    courseNumber,
    group,
    active,
  } = query;
  const data = {};
  applyAcademicYearFilter(data, academicYear);
  if (program) data.program = program;
  if (specialty) data.specialty = specialty;
  if (department) data.department = department;
  applyCourseFilter(data, courseNumber);
  if (group) data.group = group;
  if (active !== undefined) data.active = active;
  const rx = searchRegex(search);
  if (rx) data.fullName = rx;
  return data;
}

module.exports = {
  buildFilter,
  addProblemStudent: async (req, res, next) => {
    try {
      await new ProblemStudent({ ...req.body, createdBy: req.user._id }).save();
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(new ErrorHandler(400, "Yozuv qo'shishda xato", err.message));
    }
  },

  findAllProblemStudents: async (req, res, next) => {
    try {
      const docs = await ProblemStudent.find(buildFilter(req.query))
        .populate(POP)
        .sort({ date: -1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Muammoli talabalar ro'yxati xatosi", err.message),
      );
    }
  },

  paginateProblemStudents: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const doc = await ProblemStudent.paginate(buildFilter(req.query), {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { date: -1 },
        populate: POP,
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Sahifalash xatosi", err.message));
    }
  },

  updateProblemStudent: async (req, res, next) => {
    try {
      const doc = await ProblemStudent.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Yozuvni yangilashda xato", err.message));
    }
  },

  deleteProblemStudent: async (req, res, next) => {
    try {
      const doc = await ProblemStudent.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(new ErrorHandler(400, "Yozuvni o'chirishda xato", err.message));
    }
  },
};
