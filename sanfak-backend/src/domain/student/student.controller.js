"use strict";
const { ErrorHandler } = require("#shared/error");
const Student  = require("#domain/student/student.model");
const Group    = require("#references/group/group.model");
const mongoose = require("mongoose");

const populate = [
  { path: "group",     select: "title studentNumber" },
  { path: "faculty",   select: "title" },
  { path: "direction", select: "title directionCode" },
  { path: "user",      select: "firstName lastName email" },
];

const addStudent = async (req, res, next) => {
  try {
    const student = await Student.create(req.body);

    if (student.group) {
      await Group.findByIdAndUpdate(student.group, { $inc: { studentNumber: 1 } });
    }

    const result = await Student.findById(student._id).populate(populate);
    return res.status(201).json({ message: "Talaba qo'shildi", data: result });
  } catch (err) {
    if (err.code === 11000) {
      return next(new ErrorHandler(400, "Bu talaba ID allaqachon mavjud"));
    }
    return next(err);
  }
};

const findAllStudents = async (req, res, next) => {
  try {
    const {
      group, faculty, direction, course, semester,
      status, studyType, educationForm, search, active,
    } = req.query;

    const filter = { ...req.scope };
    if (group)         filter.group     = group;
    if (faculty && !req.scope?.faculty) filter.faculty = faculty;
    if (direction)     filter.direction = direction;
    if (course)        filter.course    = Number(course);
    if (semester)      filter.semester  = Number(semester);
    if (status)        filter.status    = status;
    if (studyType)     filter.studyType = studyType;
    if (educationForm) filter.educationForm = educationForm;
    if (active !== undefined) filter.active = active === "true";

    if (search) {
      const rx = new RegExp(search, "i");
      filter.$or = [
        { firstName: rx }, { lastName: rx }, { middleName: rx },
        { studentId: rx }, { phone: rx }, { email: rx },
        { jshshir: rx },
      ];
    }

    const data = await Student.find(filter)
      .populate(populate)
      .sort({ lastName: 1, firstName: 1 });

    return res.json({ data, total: data.length });
  } catch (err) {
    return next(err);
  }
};

const paginateStudents = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 20,
      group, faculty, direction, course, status,
      studyType, educationForm, search, active,
    } = req.query;

    const filter = { ...req.scope };
    if (group)         filter.group     = group;
    if (faculty && !req.scope?.faculty) filter.faculty = faculty;
    if (direction)     filter.direction = direction;
    if (course)        filter.course    = Number(course);
    if (status)        filter.status    = status;
    if (studyType)     filter.studyType = studyType;
    if (educationForm) filter.educationForm = educationForm;
    if (active !== undefined) filter.active = active === "true";

    if (search) {
      const rx = new RegExp(search, "i");
      filter.$or = [
        { firstName: rx }, { lastName: rx }, { middleName: rx },
        { studentId: rx }, { phone: rx }, { jshshir: rx },
      ];
    }

    const options = {
      page: Number(page),
      limit: Number(limit),
      populate,
      sort: { lastName: 1, firstName: 1 },
    };

    const result = await Student.paginate(filter, options);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
};

const findOneStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id).populate(populate);
    if (!student) return next(new ErrorHandler(404, "Talaba topilmadi"));
    return res.json({ data: student });
  } catch (err) {
    return next(err);
  }
};

const updateStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return next(new ErrorHandler(404, "Talaba topilmadi"));

    const oldGroup = student.group?.toString();
    const newGroup = req.body.group;

    if (newGroup && oldGroup !== newGroup) {
      if (oldGroup) await Group.findByIdAndUpdate(oldGroup, { $inc: { studentNumber: -1 } });
      await Group.findByIdAndUpdate(newGroup, { $inc: { studentNumber: 1 } });
    }

    Object.assign(student, req.body);
    await student.save();

    const updated = await Student.findById(student._id).populate(populate);
    return res.json({ message: "Yangilandi", data: updated });
  } catch (err) {
    return next(err);
  }
};

const deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return next(new ErrorHandler(404, "Talaba topilmadi"));

    if (student.group) {
      await Group.findByIdAndUpdate(student.group, { $inc: { studentNumber: -1 } });
    }

    return res.json({ message: "O'chirildi", data: student });
  } catch (err) {
    return next(err);
  }
};

const changeStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const allowed = ["active", "leave", "expelled", "graduated", "transferred"];
    if (!allowed.includes(status)) {
      return next(new ErrorHandler(400, `Noto'g'ri holat: ${status}`));
    }

    const student = await Student.findById(req.params.id);
    if (!student) return next(new ErrorHandler(404, "Talaba topilmadi"));

    student.status            = status;
    student.statusChangedAt   = new Date();
    student.statusChangeReason = reason || null;
    if (status !== "active") student.active = false;
    else student.active = true;

    await student.save();
    return res.json({ message: "Holat yangilandi", data: { status, reason } });
  } catch (err) {
    return next(err);
  }
};

const groupStats = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const pipeline = [
      { $match: { group: new mongoose.Types.ObjectId(groupId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ];
    const rows = await Student.aggregate(pipeline);
    const stats = { total: 0, active: 0, leave: 0, expelled: 0, graduated: 0, transferred: 0 };
    for (const r of rows) {
      stats[r._id] = r.count;
      stats.total += r.count;
    }
    return res.json({ data: stats });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  addStudent,
  findAllStudents,
  paginateStudents,
  findOneStudent,
  updateStudent,
  deleteStudent,
  changeStatus,
  groupStats,
};
