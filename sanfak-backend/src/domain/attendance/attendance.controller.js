"use strict";
const { ErrorHandler } = require("#shared/error");
const Attendance = require("#domain/attendance/attendance.model");
const Student    = require("#domain/student/student.model");
const {
  resolveAcademicYearId,
} = require("#references/_services/academicYearResolver");

const populate = [
  { path: "group",   select: "title" },
  { path: "science", select: "name code" },
  { path: "teacher", select: "firstName lastName" },
  { path: "attendances.student", select: "firstName lastName studentId" },
];

const createAttendance = async (req, res, next) => {
  try {
    const { group, science, teacher, date, lessonType, academicYear, semester, attendances, note } = req.body;

    let academicYearId = null;
    if (academicYear) {
      academicYearId = resolveAcademicYearId(academicYear);
      if (!academicYearId) {
        return next(
          new ErrorHandler(404, `O'quv yili topilmadi: ${academicYear}`),
        );
      }
    }

    let entries = attendances;
    if (!entries || !entries.length) {
      const students = await Student.find({ group, status: "active", active: true }).select("_id");
      entries = students.map((s) => ({ student: s._id, status: "present" }));
    }

    const journal = await Attendance.create({
      group, science, teacher, date, lessonType,
      academicYear: academicYearId, semester, attendances: entries, note,
    });

    const result = await Attendance.findById(journal._id).populate(populate);
    return res.status(201).json({ message: "Davomad jurnali yaratildi", data: result });
  } catch (err) {
    return next(err);
  }
};

const findByGroup = async (req, res, next) => {
  try {
    const { group, science, fromDate, toDate, academicYear, semester, page = 1, limit = 30 } = req.query;

    const filter = {};
    if (group)        filter.group    = group;
    if (science)      filter.science  = science;
    if (academicYear) filter.academicYear = academicYear;
    if (semester)     filter.semester = Number(semester);
    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate)   filter.date.$lte = new Date(toDate);
    }

    const options = {
      page: Number(page), limit: Number(limit),
      populate,
      sort: { date: -1 },
    };

    const result = await Attendance.paginate(filter, options);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
};

const findOne = async (req, res, next) => {
  try {
    const journal = await Attendance.findById(req.params.id).populate(populate);
    if (!journal) return next(new ErrorHandler(404, "Jurnal topilmadi"));
    return res.json({ data: journal });
  } catch (err) {
    return next(err);
  }
};

const updateAttendance = async (req, res, next) => {
  try {
    const journal = await Attendance.findById(req.params.id);
    if (!journal) return next(new ErrorHandler(404, "Jurnal topilmadi"));

    if (req.body.academicYear !== undefined) {
      if (req.body.academicYear === null) {
        req.body.academicYear = null;
      } else {
        const academicYearId = resolveAcademicYearId(req.body.academicYear);
        if (!academicYearId) {
          return next(
            new ErrorHandler(404, `O'quv yili topilmadi: ${req.body.academicYear}`),
          );
        }
        req.body.academicYear = academicYearId;
      }
    }

    const allowed = ["attendances", "lessonType", "date", "note", "academicYear", "semester"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) journal[key] = req.body[key];
    }

    await journal.save();
    const updated = await Attendance.findById(journal._id).populate(populate);
    return res.json({ message: "Yangilandi", data: updated });
  } catch (err) {
    return next(err);
  }
};

const deleteAttendance = async (req, res, next) => {
  try {
    const journal = await Attendance.findByIdAndDelete(req.params.id);
    if (!journal) return next(new ErrorHandler(404, "Jurnal topilmadi"));
    return res.json({ message: "O'chirildi" });
  } catch (err) {
    return next(err);
  }
};

const studentStats = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { academicYear, semester, science } = req.query;

    const ObjectId = require("mongoose").Types.ObjectId;
    const match = { "attendances.student": new ObjectId(studentId) };
    if (academicYear && ObjectId.isValid(academicYear)) {
      match.academicYear = new ObjectId(academicYear);
    }
    if (semester) match.semester = Number(semester);
    if (science && ObjectId.isValid(science)) match.science = new ObjectId(science);

    const pipeline = [
      { $match: match },
      { $unwind: "$attendances" },
      { $match: { "attendances.student": new ObjectId(studentId) } },
      {
        $group: {
          _id: "$attendances.status",
          count: { $sum: 1 },
        },
      },
    ];

    const rows = await Attendance.aggregate(pipeline);
    const stats = { total: 0, present: 0, absent: 0, late: 0, excused: 0 };
    for (const r of rows) {
      stats[r._id] = r.count;
      stats.total += r.count;
    }
    stats.attendanceRate = stats.total
      ? Math.round(((stats.present + stats.late) / stats.total) * 100)
      : 0;

    return res.json({ data: stats });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createAttendance,
  findByGroup,
  findOne,
  updateAttendance,
  deleteAttendance,
  studentStats,
};
