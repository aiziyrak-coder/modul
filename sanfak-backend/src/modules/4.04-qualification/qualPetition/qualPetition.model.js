const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualPetitionSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    passport: {
      type: String,
      required: true,
    },
    bachelorDiploma: {
      type: String,
      required: true,
    },
    mastersDiploma: {
      type: String,
      default: null,
    },
    moCertificate: {
      type: String,
      default: null,
    },
    status: {
      type: Number,
      default: 1,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualCourse",
      required: true,
    },
    province: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "province",
      required: true,
    },
    region: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "region",
      required: true,
    },
    institution: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    passportSeries: {
      type: String,
      default: null,
    },
    passportNumber: {
      type: String,
      default: null,
    },
    passportValidUntil: {
      type: String,
      default: null,
    },
    passportIssuedBy: {
      type: String,
      default: null,
    },
    mfy: {
      type: String,
      default: null,
    },
    street: {
      type: String,
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

QualPetitionSchema.index({ status: 1, course: 1 });
QualPetitionSchema.index({ course: 1 });

QualPetitionSchema.plugin(mongoosePaginate);
QualPetitionSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualPetition", QualPetitionSchema);

module.exports = model;
