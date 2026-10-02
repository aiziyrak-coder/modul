const { ErrorHandler } = require("#shared/error");
const Lesson = require("./residencyLesson.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { allowedResidentIds } = require("../_services/residentScope");
const { applyScopedEquals } = require("../_services/scopeGuard");
const { searchRegex } = require("../_services/searchTerm");
const {
  applyAcademicYearFilter,
} = require("#modules/4.05-residency/_services/academicYearFilter");
const {
  applyCourseFilter,
} = require("#modules/4.05-residency/_services/courseFilter");

const POP = [
  { path: "science", select: "title" },
  { path: "department", select: "title" },
  { path: "teacher", select: "firstName lastName middleName" },
  { path: "groups.group", select: "title name" },
];

async function buildLessonScope(user) {
  const ids = await allowedResidentIds(user);
  if (ids === null) return {};

  const groupIds = await Resident.find({
    _id: { $in: ids },
    group: { $ne: null },
  }).distinct("group");

  return { "groups.group": { $in: groupIds } };
}

function buildFilter(query, scope) {
  const { search, academicYear, science, courseNumber, group, fromDate, toDate, active } =
    query;
  const data = { ...scope };
  applyAcademicYearFilter(data, academicYear);
  if (science) data.science = science;
  applyCourseFilter(data, courseNumber);
  applyScopedEquals(data, scope, "groups.group", group);
  if (active !== undefined) data.active = active;
  const rx = searchRegex(search);
  if (rx) data.scienceTitle = rx;
  if (fromDate) data.endDate = { $gte: new Date(fromDate) };
  if (toDate) data.startDate = { $lte: new Date(toDate) };
  return data;
}

module.exports = {
  addLesson: async (req, res, next) => {
    try {
      await new Lesson(req.body).save();
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(new ErrorHandler(400, "Dars qo'shishda xato", err.message));
    }
  },

  findAllLessons: async (req, res, next) => {
    try {
      const scope = await buildLessonScope(req.user);
      const docs = await Lesson.find(buildFilter(req.query, scope))
        .populate(POP)
        .sort({ startDate: -1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Darslar ro'yxati xatosi", err.message));
    }
  },

  paginateLessons: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const scope = await buildLessonScope(req.user);
      const doc = await Lesson.paginate(
        buildFilter(req.query, scope),
        {
          page: parseInt(page),
          limit: parseInt(limit),
          sort: { startDate: -1 },
          populate: POP,
        },
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Darslar sahifalash xatosi", err.message));
    }
  },

  findLesson: async (req, res, next) => {
    try {
      const doc = await Lesson.findById(req.params.id).populate(POP);
      if (!doc) return res.status(404).json({ message: "not found" });

      const scope = await buildLessonScope(req.user);
      const allowedGroups = scope["groups.group"] && scope["groups.group"].$in;
      if (allowedGroups) {
        const inScope = (doc.groups || []).some((g) =>
          allowedGroups.some((id) => String(id) === String(g.group?._id || g.group)),
        );
        if (!inScope) return res.status(404).json({ message: "not found" });
      }
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Darsni olishda xato", err.message));
    }
  },

  updateLesson: async (req, res, next) => {
    try {
      if (req.body.startDate !== undefined || req.body.endDate !== undefined) {
        const current = await Lesson.findById(req.params.id).select(
          "startDate endDate",
        );
        if (!current) return res.status(404).json({ message: "not found" });
        const start =
          req.body.startDate !== undefined
            ? new Date(req.body.startDate)
            : current.startDate;
        const end =
          req.body.endDate !== undefined
            ? new Date(req.body.endDate)
            : current.endDate;
        if (start && end && end < start) {
          return res.status(400).json({
            message: "Tugash sanasi boshlanish sanasidan oldin bo'la olmaydi",
          });
        }
      }

      const doc = await Lesson.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Darsni yangilashda xato", err.message));
    }
  },

  deleteLesson: async (req, res, next) => {
    try {
      const doc = await Lesson.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(new ErrorHandler(400, "Darsni o'chirishda xato", err.message));
    }
  },
};
