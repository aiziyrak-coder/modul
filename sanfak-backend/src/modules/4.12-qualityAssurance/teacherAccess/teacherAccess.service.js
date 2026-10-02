const TeacherAccess = require("./teacherAccess.model");

const DEFAULT_ACCESS = { active: true, activeFrom: null };

const SELECT = "teacher active activeFrom";

module.exports = {
  DEFAULT_ACCESS,

  findByTeacher: async (teacherId) => {
    const doc = await TeacherAccess.findOne({ teacher: teacherId })
      .select(SELECT)
      .lean();
    return doc || { teacher: teacherId, ...DEFAULT_ACCESS };
  },

  listWritten: () => TeacherAccess.find({}).select(SELECT).lean(),

  set: (teacherId, { active, activeFrom }) =>
    TeacherAccess.findOneAndUpdate(
      { teacher: teacherId },
      { teacher: teacherId, active, activeFrom: activeFrom || null },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    )
      .select(SELECT)
      .lean(),
};
