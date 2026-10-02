const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const winston = require("#shared/winston.logger");

const ATTENDANCE_STATUSES = ["present", "absent", "excused"];

const { TIME_RE } = require("#modules/4.05-residency/residencySetting/residencySetting.model");

const CLIENT_ATTENDANCE_STATUSES = ["present", "absent"];

const RESIDENCY_LESSON_TYPES = [
  "maruza",
  "amaliy",
  "test",
  "oraliq_nazorat",
  "yakuniy_nazorat",
];

const AttendanceSchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "resident",
      required: true,
      index: true,
    },
    date: { type: Date, required: true },

    science: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "science",
      default: null,
    },
    scienceTitle: { type: String, default: null },
    lessonType: { type: String, enum: RESIDENCY_LESSON_TYPES, default: null },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    teacherName: { type: String, default: null },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "group", default: null },

    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      default: "present",
    },
    hours: { type: Number, default: 2 },

    checkInTime: { type: String, default: null, match: TIME_RE },
    checkOutTime: { type: String, default: null, match: TIME_RE },
    score: { type: Number, default: null },

    late: { type: Boolean, default: false },
    lateMinutes: { type: Number, default: null, min: 1, max: 600 },

    samsVerified: { type: Boolean, default: false },

    manualVerified: { type: Boolean, default: false },
    manualVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    manualVerifiedAt: { type: Date, default: null },

    excuseReason: { type: String, default: null },
    excuseApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    fromDate: { type: Date, default: null },
    toDate: { type: Date, default: null },

    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "residentApplication",
      default: null,
    },

    active: { type: Boolean, default: true },

    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "residencySession",
      default: null,
    },
    sessionRev: { type: Number, default: null },
    scoreRev: { type: Number, default: null },
  },
  { timestamps: true, versionKey: false },
);

AttendanceSchema.plugin(mongoosePaginate);
AttendanceSchema.plugin(aggregatePaginate);
AttendanceSchema.plugin(softDeletePlugin);

const LESSON_UNIQUE_INDEX_NAME = "resident_lesson_unique";
const lessonUniqueIndex = () => ({
  key: { resident: 1, date: 1, science: 1, lessonType: 1 },
  options: {
    unique: true,
    partialFilterExpression: { deletedAt: null },
    name: LESSON_UNIQUE_INDEX_NAME,
  },
});
const lessonIndex = lessonUniqueIndex();
AttendanceSchema.index(lessonIndex.key, lessonIndex.options);

const SESSION_INDEX_NAME = "attendance_session_resident_unique";
AttendanceSchema.index(
  { session: 1, resident: 1 },
  {
    unique: true,
    partialFilterExpression: { session: { $type: "objectId" } },
    name: SESSION_INDEX_NAME,
  },
);

const AttendanceModel = mongoose.model("attendance", AttendanceSchema);

const logIndexFailure = (err) => {
  if (!err) return;
  winston.error(
    `[4.5 attendance] indeks qurilmadi — getIndexes() bilan tekshiring (${LESSON_UNIQUE_INDEX_NAME}): ${err.message}`,
  );
};
AttendanceModel.on("index", logIndexFailure);

module.exports = AttendanceModel;
module.exports.ATTENDANCE_STATUSES = ATTENDANCE_STATUSES;
module.exports.CLIENT_ATTENDANCE_STATUSES = CLIENT_ATTENDANCE_STATUSES;
module.exports.RESIDENCY_LESSON_TYPES = RESIDENCY_LESSON_TYPES;
module.exports.LESSON_UNIQUE_INDEX_NAME = LESSON_UNIQUE_INDEX_NAME;
module.exports.lessonUniqueIndex = lessonUniqueIndex;
module.exports.SESSION_INDEX_NAME = SESSION_INDEX_NAME;
