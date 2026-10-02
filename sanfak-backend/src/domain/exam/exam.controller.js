"use strict";
const { ErrorHandler } = require("#shared/error");
const Exam = require("#domain/exam/exam.model");
const Student = require("#domain/student/student.model");
const mongoose = require("mongoose");
const {
  resolveAcademicYearId,
} = require("#references/_services/academicYearResolver");

const populateList = [
  { path: "groups", select: "title studentNumber" },
  { path: "science", select: "title" },
  { path: "teacher", select: "firstName lastName middleName" },
  { path: "faculty", select: "title" },
  { path: "department", select: "title" },
  { path: "room", select: "title capacity" },
  { path: "academicYear", select: "title" },
];

const populateFull = [
  ...populateList,
  {
    path: "results.student",
    select: "firstName lastName middleName studentId",
  },
  { path: "approvedBy", select: "firstName lastName" },
  { path: "createdBy", select: "firstName lastName" },
];

const createExam = async (req, res, next) => {
  try {
    const {
      groups,
      science,
      teacher,
      faculty,
      department,
      room,
      examType,
      date,
      startTime,
      duration,
      academicYear,
      semester,
      note,
    } = req.body;

    const academicYearId = resolveAcademicYearId(academicYear);
    if (!academicYearId) {
      return next(
        new ErrorHandler(404, `O'quv yili topilmadi: ${academicYear}`),
      );
    }

    let results = [];
    if (groups && groups.length > 0) {
      const students = await Student.find({
        group: { $in: groups },
        status: "active",
      }).select("_id");
      results = students.map((s) => ({ student: s._id }));
    }

    const doc = await Exam.create({
      groups: groups || [],
      science,
      teacher,
      faculty: faculty || null,
      department: department || null,
      room: room || null,
      examType,
      date,
      startTime: startTime || null,
      duration: duration || 120,
      academicYear: academicYearId,
      semester,
      results,
      note: note || null,
      createdBy: req.user?._id || null,
    });

    const result = await Exam.findById(doc._id).populate(populateList);
    return res.status(201).json({ message: "Imtihon yaratildi", data: result });
  } catch (err) {
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
      examType,
      status,
      dateFrom,
      dateTo,
    } = req.query;
    const filter = { ...req.scope };
    if (group) filter.groups = group;
    if (science) filter.science = science;
    if (teacher) filter.teacher = teacher;
    if (faculty) filter.faculty = faculty;
    if (academicYear) filter.academicYear = academicYear;
    if (semester) filter.semester = Number(semester);
    if (examType) filter.examType = examType;
    if (status) filter.status = status;
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo);
    }

    const data = await Exam.find(filter)
      .populate(populateList)
      .select("-results")
      .sort({ date: 1 });
    return res.json({ data, total: data.length });
  } catch (err) {
    return next(err);
  }
};

const paginateExams = async (req, res, next) => {
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
      examType,
      status,
    } = req.query;
    const filter = { ...req.scope };
    if (group) filter.groups = group;
    if (science) filter.science = science;
    if (teacher) filter.teacher = teacher;
    if (faculty) filter.faculty = faculty;
    if (academicYear) filter.academicYear = academicYear;
    if (semester) filter.semester = Number(semester);
    if (examType) filter.examType = examType;
    if (status) filter.status = status;

    const result = await Exam.paginate(filter, {
      page: Number(page),
      limit: Number(limit),
      populate: populateList,
      select: "-results",
      sort: { date: 1 },
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
};

const findOne = async (req, res, next) => {
  try {
    const doc = await Exam.findById(req.params.id).populate(populateFull);
    if (!doc) return next(new ErrorHandler(404, "Imtihon topilmadi"));
    return res.json({ data: doc });
  } catch (err) {
    return next(err);
  }
};

const updateExam = async (req, res, next) => {
  try {
    const allowed = [
      "groups",
      "science",
      "teacher",
      "faculty",
      "department",
      "room",
      "examType",
      "date",
      "startTime",
      "duration",
      "academicYear",
      "semester",
      "note",
    ];
    const updates = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    if (updates.academicYear !== undefined) {
      const academicYearId = resolveAcademicYearId(updates.academicYear);
      if (!academicYearId) {
        return next(
          new ErrorHandler(404, `O'quv yili topilmadi: ${updates.academicYear}`),
        );
      }
      updates.academicYear = academicYearId;
    }

    const doc = await Exam.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    }).populate(populateList);
    if (!doc) return next(new ErrorHandler(404, "Imtihon topilmadi"));
    return res.json({ message: "Imtihon yangilandi", data: doc });
  } catch (err) {
    return next(err);
  }
};

const deleteExam = async (req, res, next) => {
  try {
    const doc = await Exam.findByIdAndDelete(req.params.id);
    if (!doc) return next(new ErrorHandler(404, "Imtihon topilmadi"));
    return res.json({ message: "Imtihon o'chirildi" });
  } catch (err) {
    return next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const allowed = [
      "scheduled",
      "ongoing",
      "completed",
      "cancelled",
      "postponed",
    ];
    const { status } = req.body;
    if (!allowed.includes(status)) {
      return next(new ErrorHandler(400, `Noto'g'ri status: ${status}`));
    }

    const updates = { status };
    if (status === "completed") updates.approvedBy = req.user?._id || null;

    const doc = await Exam.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    if (!doc) return next(new ErrorHandler(404, "Imtihon topilmadi"));
    return res.json({
      message: "Status yangilandi",
      data: { status: doc.status },
    });
  } catch (err) {
    return next(err);
  }
};

const enterResults = async (req, res, next) => {
  try {
    const { results } = req.body;
    if (!Array.isArray(results) || results.length === 0) {
      return next(new ErrorHandler(400, "Natijalar ro'yxati bo'sh"));
    }

    const doc = await Exam.findById(req.params.id);
    if (!doc) return next(new ErrorHandler(404, "Imtihon topilmadi"));
    if (doc.status === "cancelled")
      return next(new ErrorHandler(400, "Imtihon bekor qilingan"));

    for (const item of results) {
      const entry = doc.results.find(
        (r) => r.student.toString() === item.studentId,
      );
      if (entry) {
        if (item.grade !== undefined) entry.grade = item.grade;
        if (item.letterGrade !== undefined)
          entry.letterGrade = item.letterGrade;
        if (item.passed !== undefined) entry.passed = item.passed;
        if (item.absent !== undefined) entry.absent = item.absent;
        if (item.note !== undefined) entry.note = item.note;
        entry.gradedAt = new Date();
      } else {
        doc.results.push({
          student: item.studentId,
          grade: item.grade || null,
          letterGrade: item.letterGrade || null,
          passed: item.passed ?? null,
          absent: item.absent || false,
          note: item.note || null,
          gradedAt: new Date(),
        });
      }
    }

    await doc.save();
    const updated = await Exam.findById(doc._id).populate(populateFull);
    return res.json({ message: "Natijalar kiritildi", data: updated });
  } catch (err) {
    return next(err);
  }
};

const updateResult = async (req, res, next) => {
  try {
    const { resultId } = req.params;
    const { grade, letterGrade, passed, absent, note } = req.body;

    const doc = await Exam.findById(req.params.id);
    if (!doc) return next(new ErrorHandler(404, "Imtihon topilmadi"));

    const entry = doc.results.id(resultId);
    if (!entry) return next(new ErrorHandler(404, "Natija topilmadi"));

    if (grade !== undefined) entry.grade = grade;
    if (letterGrade !== undefined) entry.letterGrade = letterGrade;
    if (passed !== undefined) entry.passed = passed;
    if (absent !== undefined) entry.absent = absent;
    if (note !== undefined) entry.note = note;
    entry.gradedAt = new Date();

    await doc.save();
    return res.json({ message: "Natija yangilandi" });
  } catch (err) {
    return next(err);
  }
};

const examStats = async (req, res, next) => {
  try {
    const doc = await Exam.findById(req.params.id);
    if (!doc) return next(new ErrorHandler(404, "Imtihon topilmadi"));

    const results = doc.results;
    const total = results.length;
    const appeared = results.filter((r) => !r.absent).length;
    const passed = results.filter((r) => r.passed === true).length;
    const failed = results.filter((r) => r.passed === false).length;
    const absent = results.filter((r) => r.absent).length;

    const grades = results.filter((r) => r.grade !== null).map((r) => r.grade);
    const avgGrade =
      grades.length > 0
        ? Math.round((grades.reduce((s, g) => s + g, 0) / grades.length) * 10) /
          10
        : null;

    const distribution = {};
    for (const r of results) {
      const lg = r.letterGrade || "—";
      distribution[lg] = (distribution[lg] || 0) + 1;
    }

    return res.json({
      data: {
        total,
        appeared,
        passed,
        failed,
        absent,
        passRate: appeared > 0 ? Math.round((passed / appeared) * 100) : 0,
        avgGrade,
        distribution,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createExam,
  findAll,
  paginateExams,
  findOne,
  updateExam,
  deleteExam,
  updateStatus,
  enterResults,
  updateResult,
  examStats,
};
