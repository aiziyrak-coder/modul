"use strict";
const { ErrorHandler } = require("#shared/error");
const Gradebook = require("#domain/gradebook/gradebook.model");
const Student = require("#domain/student/student.model");
const mongoose = require("mongoose");
const {
  resolveAcademicYearId,
} = require("#references/_services/academicYearResolver");

const populateList = [
  { path: "group", select: "title studentNumber" },
  { path: "science", select: "title" },
  { path: "teacher", select: "firstName lastName middleName" },
  { path: "faculty", select: "title" },
  { path: "department", select: "title" },
  { path: "academicYear", select: "title" },
];

const populateFull = [
  ...populateList,
  {
    path: "lessons.entries.student",
    select: "firstName lastName middleName studentId",
  },
  {
    path: "summary.student",
    select: "firstName lastName middleName studentId",
  },
  { path: "createdBy", select: "firstName lastName" },
  { path: "closedBy", select: "firstName lastName" },
];

const createGradebook = async (req, res, next) => {
  try {
    const {
      group,
      science,
      teacher,
      faculty,
      department,
      academicYear,
      semester,
      lessonType,
      totalHours,
      note,
    } = req.body;

    const academicYearId = resolveAcademicYearId(academicYear);
    if (!academicYearId) {
      return next(
        new ErrorHandler(404, `O'quv yili topilmadi: ${academicYear}`),
      );
    }

    const exists = await Gradebook.findOne({
      group,
      science,
      semester,
      academicYear: academicYearId,
      lessonType,
    });
    if (exists) {
      return next(new ErrorHandler(409, "Bu guruh va fan uchun jurnal allaqachon mavjud"));
    }

    const students = await Student.find({ group, status: "active" }).select(
      "_id",
    );
    const summary = students.map((s) => ({ student: s._id }));

    const doc = await Gradebook.create({
      group,
      science,
      teacher,
      faculty,
      department,
      academicYear: academicYearId,
      semester,
      lessonType: lessonType || "lecture",
      totalHours: totalHours || 0,
      summary,
      note: note || null,
      createdBy: req.user?._id || null,
    });

    const result = await Gradebook.findById(doc._id).populate(populateList);
    return res.status(201).json({ message: "Jurnal yaratildi", data: result });
  } catch (err) {
    if (err.code === 11000) {
      return next(new ErrorHandler(409, "Bu kombinatsiya uchun jurnal allaqachon mavjud"));
    }
    return next(err);
  }
};

const findAll = async (req, res, next) => {
  try {
    const {
      group,
      science,
      teacher,
      faculty,
      academicYear,
      semester,
      status,
      lessonType,
    } = req.query;
    const filter = { ...req.scope };
    if (group) filter.group = group;
    if (science) filter.science = science;
    if (teacher) filter.teacher = teacher;
    if (faculty) filter.faculty = faculty;
    if (academicYear) filter.academicYear = academicYear;
    if (semester) filter.semester = Number(semester);
    if (status) filter.status = status;
    if (lessonType) filter.lessonType = lessonType;

    const data = await Gradebook.find(filter)
      .populate(populateList)
      .select("-lessons -summary")
      .sort({ createdAt: -1 });
    return res.json({ data, total: data.length });
  } catch (err) {
    return next(err);
  }
};

const paginate = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      group,
      science,
      teacher,
      faculty,
      academicYear,
      semester,
      status,
      lessonType,
    } = req.query;
    const filter = { ...req.scope };
    if (group) filter.group = group;
    if (science) filter.science = science;
    if (teacher) filter.teacher = teacher;
    if (faculty) filter.faculty = faculty;
    if (academicYear) filter.academicYear = academicYear;
    if (semester) filter.semester = Number(semester);
    if (status) filter.status = status;
    if (lessonType) filter.lessonType = lessonType;

    const result = await Gradebook.paginate(filter, {
      page: Number(page),
      limit: Number(limit),
      populate: populateList,
      select: "-lessons -summary",
      sort: { createdAt: -1 },
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
};

const findOne = async (req, res, next) => {
  try {
    const doc = await Gradebook.findById(req.params.id).populate(populateFull);
    if (!doc) return next(new ErrorHandler(404, "Jurnal topilmadi"));
    return res.json({ data: doc });
  } catch (err) {
    return next(err);
  }
};

const addLesson = async (req, res, next) => {
  try {
    const { date, topic, lessonType, hours, entries } = req.body;

    const doc = await Gradebook.findById(req.params.id);
    if (!doc) return next(new ErrorHandler(404, "Jurnal topilmadi"));
    if (doc.status === "closed")
      return next(new ErrorHandler(400, "Jurnal yopilgan"));

    let lessonEntries = entries;
    if (!lessonEntries || lessonEntries.length === 0) {
      lessonEntries = doc.summary.map((s) => ({
        student: s.student,
        attendance: "present",
        grade: null,
      }));
    }

    doc.lessons.push({
      date,
      topic,
      lessonType: lessonType || doc.lessonType,
      hours: hours || 2,
      entries: lessonEntries,
    });

    doc.totalHours = doc.lessons.reduce((sum, l) => sum + (l.hours || 2), 0);

    await doc.save();
    const result = await Gradebook.findById(doc._id).populate(populateFull);
    return res.status(201).json({ message: "Dars qo'shildi", data: result });
  } catch (err) {
    return next(err);
  }
};

const updateLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const doc = await Gradebook.findById(req.params.id);
    if (!doc) return next(new ErrorHandler(404, "Jurnal topilmadi"));
    if (doc.status === "closed")
      return next(new ErrorHandler(400, "Jurnal yopilgan"));

    const lesson = doc.lessons.id(lessonId);
    if (!lesson) return next(new ErrorHandler(404, "Dars topilmadi"));

    const { date, topic, lessonType, hours, entries } = req.body;
    if (date) lesson.date = date;
    if (topic) lesson.topic = topic;
    if (lessonType) lesson.lessonType = lessonType;
    if (hours) lesson.hours = hours;
    if (entries) lesson.entries = entries;

    doc.totalHours = doc.lessons.reduce((sum, l) => sum + (l.hours || 2), 0);

    await doc.save();
    return res.json({ message: "Dars yangilandi" });
  } catch (err) {
    return next(err);
  }
};

const deleteLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const doc = await Gradebook.findById(req.params.id);
    if (!doc) return next(new ErrorHandler(404, "Jurnal topilmadi"));
    if (doc.status === "closed")
      return next(new ErrorHandler(400, "Jurnal yopilgan"));

    const lessonIndex = doc.lessons.findIndex(
      (l) => l._id.toString() === lessonId,
    );
    if (lessonIndex === -1)
      return next(new ErrorHandler(404, "Dars topilmadi"));

    doc.lessons.splice(lessonIndex, 1);
    doc.totalHours = doc.lessons.reduce((sum, l) => sum + (l.hours || 2), 0);
    await doc.save();
    return res.json({ message: "Dars o'chirildi" });
  } catch (err) {
    return next(err);
  }
};

const updateSummary = async (req, res, next) => {
  try {
    const { summaryData } = req.body;
    const doc = await Gradebook.findById(req.params.id);
    if (!doc) return next(new ErrorHandler(404, "Jurnal topilmadi"));

    for (const item of summaryData) {
      const entry = doc.summary.find(
        (s) => s.student.toString() === item.studentId,
      );
      if (!entry) continue;
      if (item.midterm !== undefined) entry.midterm = item.midterm;
      if (item.final !== undefined) entry.final = item.final;
      if (item.overall !== undefined) entry.overall = item.overall;
      if (item.letterGrade !== undefined) entry.letterGrade = item.letterGrade;
      if (item.passed !== undefined) entry.passed = item.passed;
    }

    for (const s of doc.summary) {
      const studentEntries = doc.lessons.flatMap((l) =>
        l.entries.filter((e) => e.student.toString() === s.student.toString()),
      );
      const totalHours =
        studentEntries.reduce((sum, e, i) => {
          const lesson = doc.lessons.find((l) =>
            l.entries.some((en) => en === e),
          );
          return sum + (lesson?.hours || 2);
        }, 0) || doc.totalHours;

      const presentEntries = studentEntries.filter(
        (e) => e.attendance === "present" || e.attendance === "late",
      );
      s.attendedHours = presentEntries.length * 2;
      s.missedHours = (studentEntries.length - presentEntries.length) * 2;
      s.attendanceRate =
        studentEntries.length > 0
          ? Math.round((presentEntries.length / studentEntries.length) * 100)
          : 0;
    }

    await doc.save();
    return res.json({ message: "Yakuniy baholar yangilandi" });
  } catch (err) {
    return next(err);
  }
};

const closeGradebook = async (req, res, next) => {
  try {
    const doc = await Gradebook.findByIdAndUpdate(
      req.params.id,
      {
        status: "closed",
        closedAt: new Date(),
        closedBy: req.user?._id || null,
      },
      { new: true },
    );
    if (!doc) return next(new ErrorHandler(404, "Jurnal topilmadi"));
    return res.json({
      message: "Jurnal yopildi",
      data: { status: doc.status },
    });
  } catch (err) {
    return next(err);
  }
};

const deleteGradebook = async (req, res, next) => {
  try {
    const doc = await Gradebook.findByIdAndDelete(req.params.id);
    if (!doc) return next(new ErrorHandler(404, "Jurnal topilmadi"));
    return res.json({ message: "Jurnal o'chirildi" });
  } catch (err) {
    return next(err);
  }
};

const studentStats = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { academicYear, semester } = req.query;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return next(new ErrorHandler(400, "Noto'g'ri talaba ID"));
    }

    const matchStage = {
      "summary.student": new mongoose.Types.ObjectId(studentId),
    };
    if (academicYear) matchStage.academicYear = academicYear;
    if (semester) matchStage.semester = Number(semester);

    const data = await Gradebook.aggregate([
      { $match: matchStage },
      { $unwind: "$summary" },
      { $match: { "summary.student": new mongoose.Types.ObjectId(studentId) } },
      {
        $lookup: {
          from: "sciences",
          localField: "science",
          foreignField: "_id",
          as: "scienceInfo",
        },
      },
      { $unwind: { path: "$scienceInfo", preserveNullAndEmpty: true } },
      {
        $project: {
          academicYear: 1,
          semester: 1,
          lessonType: 1,
          science: "$scienceInfo.title",
          attendanceRate: "$summary.attendanceRate",
          attendedHours: "$summary.attendedHours",
          missedHours: "$summary.missedHours",
          midterm: "$summary.midterm",
          final: "$summary.final",
          overall: "$summary.overall",
          letterGrade: "$summary.letterGrade",
          passed: "$summary.passed",
        },
      },
      { $sort: { academicYear: -1, semester: 1 } },
    ]);

    return res.json({ data, total: data.length });
  } catch (err) {
    return next(err);
  }
};

const teacherStats = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const { academicYear, semester } = req.query;

    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      return next(new ErrorHandler(400, "Noto'g'ri o'qituvchi ID"));
    }

    const match = { teacher: new mongoose.Types.ObjectId(teacherId) };
    if (academicYear) match.academicYear = academicYear;
    if (semester) match.semester = Number(semester);

    const data = await Gradebook.aggregate([
      { $match: match },
      {
        $project: {
          academicYear: 1,
          semester: 1,
          lessonType: 1,
          group: 1,
          science: 1,
          status: 1,
          totalHours: 1,
          lessonsCount: { $size: "$lessons" },
          studentsCount: { $size: "$summary" },
          passedCount: {
            $size: {
              $filter: {
                input: "$summary",
                as: "s",
                cond: { $eq: ["$$s.passed", true] },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "groups",
          localField: "group",
          foreignField: "_id",
          as: "groupInfo",
        },
      },
      {
        $lookup: {
          from: "sciences",
          localField: "science",
          foreignField: "_id",
          as: "scienceInfo",
        },
      },
      { $unwind: { path: "$groupInfo", preserveNullAndEmpty: true } },
      { $unwind: { path: "$scienceInfo", preserveNullAndEmpty: true } },
      {
        $project: {
          academicYear: 1,
          semester: 1,
          lessonType: 1,
          status: 1,
          totalHours: 1,
          lessonsCount: 1,
          studentsCount: 1,
          passedCount: 1,
          group: "$groupInfo.title",
          science: "$scienceInfo.title",
        },
      },
      { $sort: { academicYear: -1, semester: 1 } },
    ]);

    return res.json({ data, total: data.length });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createGradebook,
  findAll,
  paginate,
  findOne,
  addLesson,
  updateLesson,
  deleteLesson,
  updateSummary,
  closeGradebook,
  deleteGradebook,
  studentStats,
  teacherStats,
};
