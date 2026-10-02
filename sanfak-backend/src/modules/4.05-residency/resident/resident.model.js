const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("#modules/4.05-residency/_services/academicYearRefPlugin");
const courseRefPlugin = require("#modules/4.05-residency/_services/courseRefPlugin");

const RESIDENT_PROGRAMS = ["magistratura", "ordinatura"];
const FUNDING_TYPES = ["byudjet", "shartnoma"];

const RESIDENT_STATUSES = ["oquvda", "chetlatilgan", "akademik_tatil"];

const STUDY_PERIOD_MIN = 1;
const STUDY_PERIOD_MAX = 10;

const ClinicalSkillSchema = new mongoose.Schema(
  {
    skill: { type: String },
    targetCount: { type: Number, default: 0 },
    completedCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const ResidentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },

    program: {
      type: String,
      enum: RESIDENT_PROGRAMS,
      required: true,
      index: true,
    },

    fullName: { type: String, required: true },
    jshshir: { type: String, default: null },
    passportSeria: { type: String, default: null },
    passportNumber: { type: String, default: null },
    address: { type: String, default: null },
    workplace: { type: String, default: null },
    workplaceLocation: {
      type: new mongoose.Schema(
        {
          lat: { type: Number, required: true, min: -90, max: 90 },
          lng: { type: Number, required: true, min: -180, max: 180 },
        },
        { _id: false },
      ),
      default: null,
    },
    email: { type: String, default: null },
    phone: { type: String, default: null },
    foreign: { type: Boolean, default: false },

    fundingType: { type: String, enum: FUNDING_TYPES, default: null },
    studyPeriod: {
      type: Number,
      default: null,
      min: STUDY_PERIOD_MIN,
      max: STUDY_PERIOD_MAX,
      validate: {
        validator: (v) => v === null || v === undefined || Number.isInteger(v),
        message: "O'qish muddati butun son (yil) bo'lishi kerak",
      },
    },
    academicYear: { type: String, default: null },
    academicYearRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
      index: true,
    },
    courseNumber: { type: Number, default: null },
    courseRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      default: null,
      index: true,
    },
    admissionOrder: { type: String, default: null },
    admissionDate: { type: Date, default: null },

    specialty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "residencySpecialty",
      default: null,
    },
    specialtyTitle: { type: String, default: null },
    specialtyCode: { type: String, default: null },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      default: null,
      index: true,
    },
    departmentTitle: { type: String, default: null },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "group", default: null },
    groupTitle: { type: String, default: null },

    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
      index: true,
    },
    supervisorName: { type: String, default: null },
    teachingLocation: { type: String, default: null },
    practiceLocation: { type: String, default: null },
    scheduleText: { type: String, default: null },
    weeklyHours: { type: Number, default: null, min: 0, max: 60 },
    assignedAt: { type: Date, default: null },

    diplomaSeria: { type: String, default: null },
    diplomaNumber: { type: String, default: null },
    diplomaDate: { type: Date, default: null },
    diplomaFileUrl: { type: String, default: null },

    clinicalSkillsPlan: { type: [ClinicalSkillSchema], default: [] },

    totalUnexcusedHours: { type: Number, default: 0 },
    warningIssued: { type: Boolean, default: false },
    warningIssuedAt: { type: Date, default: null },
    expulsionOrderCreated: { type: Boolean, default: false },
    expulsionOrderCreatedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: RESIDENT_STATUSES,
      default: "oquvda",
      index: true,
    },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ResidentSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: "objectId" }, deletedAt: null },
  },
);

ResidentSchema.index(
  { jshshir: 1 },
  {
    unique: true,
    partialFilterExpression: { jshshir: { $type: "string" }, deletedAt: null },
  },
);
ResidentSchema.index(
  { passportSeria: 1, passportNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      passportSeria: { $type: "string" },
      passportNumber: { $type: "string" },
      deletedAt: null,
    },
  },
);

ResidentSchema.plugin(mongoosePaginate);
ResidentSchema.plugin(aggregatePaginate);
ResidentSchema.plugin(softDeletePlugin);

ResidentSchema.plugin(academicYearRefPlugin);

ResidentSchema.plugin(courseRefPlugin);

const ResidentModel = mongoose.model("resident", ResidentSchema);

module.exports = ResidentModel;
module.exports.RESIDENT_PROGRAMS = RESIDENT_PROGRAMS;
module.exports.FUNDING_TYPES = FUNDING_TYPES;
module.exports.RESIDENT_STATUSES = RESIDENT_STATUSES;

module.exports.STATUS_IN_STUDY = "oquvda";
module.exports.STUDY_PERIOD_MIN = STUDY_PERIOD_MIN;
module.exports.STUDY_PERIOD_MAX = STUDY_PERIOD_MAX;
