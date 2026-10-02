const Joi = require("joi");

const {
  ATTENDANCE_STATUSES,
  CLIENT_ATTENDANCE_STATUSES,
  RESIDENCY_LESSON_TYPES,
} = require("./attendance.model");
const {
  optionalString,
  optionalObjectId,
  optionalNumber,
  optionalBoolean,
  optionalDate,
} = require("#validators/common");
const { attendanceDate } = require("#modules/4.05-residency/_services/dateBounds");
const { LESSON_SCORE_MAX } = require("#modules/4.05-residency/_services/lessonScore");

const objId = optionalObjectId();
const lessonType = Joi.string()
  .valid(...RESIDENCY_LESSON_TYPES)
  .allow(null, "");

const serverOnlyEvidence = Joi.any().strip();

const serverOnlyTime = Joi.any().strip();

const createAttendanceSchema = Joi.object({
  resident: Joi.string().required(),
  date: attendanceDate().required(),
  science: objId.optional(),
  scienceTitle: Joi.string().allow(null, "").optional(),
  lessonType: lessonType.optional(),

  teacher: Joi.any().strip(),
  teacherName: Joi.any().strip(),
  group: objId.optional(),
  status: Joi.string()
    .valid(...CLIENT_ATTENDANCE_STATUSES)
    .required(),
  hours: optionalNumber(Joi.number().min(0).max(24).default(2)),
  score: Joi.number().min(0).max(LESSON_SCORE_MAX).optional().allow(null),
  checkInTime: serverOnlyTime,
  checkOutTime: serverOnlyTime,
  samsVerified: serverOnlyEvidence,
  manualVerified: optionalBoolean(Joi.boolean().default(false)),
  excuseReason: Joi.string().max(500).optional().allow(null, ""),
  late: optionalBoolean(),
  lateMinutes: Joi.number().integer().min(1).max(600).optional().allow(null),
  fromDate: Joi.date().optional().allow(null),
  toDate: Joi.date().optional().allow(null),
});

const updateAttendanceSchema = Joi.object({
  status: Joi.string()
    .valid(...CLIENT_ATTENDANCE_STATUSES)
    .optional(),
  science: objId.optional(),
  scienceTitle: Joi.string().allow(null, "").optional(),
  lessonType: lessonType.optional(),

  teacher: Joi.any().strip(),
  teacherName: Joi.any().strip(),
  group: objId.optional(),
  hours: optionalNumber(Joi.number().min(0).max(24)),
  score: Joi.number().min(0).max(LESSON_SCORE_MAX).optional().allow(null),
  checkInTime: serverOnlyTime,
  checkOutTime: serverOnlyTime,
  samsVerified: serverOnlyEvidence,
  manualVerified: optionalBoolean(),
  excuseReason: Joi.string().max(500).optional().allow(null, ""),
  late: optionalBoolean(),
  lateMinutes: Joi.number().integer().min(1).max(600).optional().allow(null),
  fromDate: Joi.date().optional().allow(null),
  toDate: Joi.date().optional().allow(null),
});

const approveExcuseSchema = Joi.object({
  reason: Joi.string().min(2).max(500).required(),
  fromDate: Joi.date().optional().allow(null),
  toDate: Joi.date().optional().allow(null),
});

const listQuery = Joi.object({
  resident: optionalObjectId(),
  status: optionalString(Joi.string().valid(...ATTENDANCE_STATUSES)),
  science: optionalObjectId(),
  academicYear: optionalString(),
  course: optionalString(Joi.string().pattern(/^(\d{1,2}|[0-9a-fA-F]{24})$/)),
  lessonType: optionalString(Joi.string().valid(...RESIDENCY_LESSON_TYPES)),
  group: optionalObjectId(),
  date: optionalDate(),
  startDate: optionalDate(),
  endDate: optionalDate(),
  page: optionalNumber(Joi.number().integer()),
  limit: optionalNumber(Joi.number().integer()),
});

const byResidentQuery = Joi.object({
  startDate: optionalDate(),
  endDate: optionalDate(),
  science: optionalObjectId(),
  lessonType: optionalString(Joi.string().valid(...RESIDENCY_LESSON_TYPES)),
});

const idSchema = Joi.object({ id: Joi.string().required() });
const residentParam = Joi.object({ resident: Joi.string().required() });

module.exports = {
  createAttendanceSchema,
  updateAttendanceSchema,
  approveExcuseSchema,
  listQuery,
  byResidentQuery,
  idSchema,
  residentParam,
};
