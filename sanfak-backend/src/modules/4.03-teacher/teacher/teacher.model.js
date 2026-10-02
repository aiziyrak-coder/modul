const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const TeacherProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      default: null,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "faculty",
      default: null,
    },

    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "position",
      default: null,
    },
    employmentType: {
      type: String,
      enum: ["asosiy", "ichki_sovmestitel", "tashqi_sovmestitel", "soatbay"],
      default: "asosiy",
    },

    education: [
      {
        level: {
          type: String,
          enum: ["bakalavr", "magistr", "doktorantura", "ordinatura"],
          default: "bakalavr",
        },
        institution: { type: String, default: null },
        specialty:   { type: String, default: null },
        graduationYear: { type: Number, default: null },
        diplomaNumber:  { type: String, default: null },
      },
    ],

    academicDegree: {
      type: String,
      enum: ["fan_nomzodi", "fan_doktori", "falsafa_doktori", null],
      default: null,
    },
    academicTitle: {
      type: String,
      enum: ["dotsent", "professor", "katta_ilmiy_xodim", null],
      default: null,
    },

    teachingSpecialtyName: { type: String, default: null },
    teachingSpecialtyCode: { type: String, default: null },
    teachingSpecialtyBasis: {
      type: String,
      enum: [
        "diplom",
        "ordinatura",
        "sertifikat",
        "qayta_tayyorlash",
        "tajriba",
        "ilmiy_daraja",
        null,
      ],
      default: null,
    },
    teachingSpecialtyNote: { type: String, default: null },

    photo: { type: String, default: null },
    birthDate: { type: Date, default: null },
    gender: {
      type: String,
      enum: ["male", "female", null],
      default: null,
    },
    passportSeries:  { type: String, default: null },
    passportNumber:  { type: String, default: null },
    passportIssuedBy:{ type: String, default: null },
    passportIssuedAt:{ type: Date,   default: null },
    passportExpiry:  { type: Date,   default: null },
    jshshir:         { type: String, default: null },
    address: {
      region:   { type: String, default: null },
      district: { type: String, default: null },
      street:   { type: String, default: null },
    },

    contactInfo: {
      phone: { type: String, default: null },
      email: { type: String, default: null },
    },

    googleScholarUrl: { type: String, default: null },
    scopusUrl:        { type: String, default: null },
    orcidUrl:         { type: String, default: null },
    hIndex:           { type: Number, default: 0 },

    hrApprovalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    hrApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    hrApprovalDate:    { type: Date,   default: null },
    hrComment:         { type: String, default: null },

    changedFields: { type: [String], default: [] },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

TeacherProfileSchema.plugin(mongoosePaginate);
TeacherProfileSchema.plugin(aggregatePaginate);

async function deriveFaculty(department) {
  if (!department) return null;
  const Department = mongoose.model("department");
  const doc = await Department.findById(department).select("faculty").lean();
  return doc?.faculty || null;
}

TeacherProfileSchema.pre("save", async function preSave(next) {
  try {
    if (this.department && !this.faculty) {
      this.faculty = await deriveFaculty(this.department);
    }
    next();
  } catch (err) {
    next(err);
  }
});

TeacherProfileSchema.pre("findOneAndUpdate", async function preUpdate(next) {
  try {
    const update = this.getUpdate() || {};

    const nextDepartment = update.$set?.department ?? update.department;
    const nextFaculty = update.$set?.faculty ?? update.faculty;

    if (nextDepartment && !nextFaculty) {
      const faculty = await deriveFaculty(nextDepartment);
      if (update.$set?.department !== undefined) {
        update.$set.faculty = faculty;
      } else {
        update.faculty = faculty;
      }
      this.setUpdate(update);
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("teacherProfile", TeacherProfileSchema);
