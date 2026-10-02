const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualEarnedCertificateSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualCourse",
      required: true,
    },
    listener: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QualListener",
      required: true,
    },
    kind: {
      type: Number,
      required: true,
    },
    number: {
      type: String,
    },
    template: {
      type: Number,
    },
    regNumber: {
      type: String,
    },
    file: {
      type: String,
    },
    status: {
      type: Number,
      default: 1,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    approvedAt: {
      type: Date,
    },
    rejectReason: {
      type: String,
    },
  },
  { timestamps: true, versionKey: false },
);

QualEarnedCertificateSchema.index({ status: 1, createdAt: -1 });

QualEarnedCertificateSchema.index(
  { regNumber: 1 },
  { unique: true, partialFilterExpression: { regNumber: { $type: "string" } } },
);
QualEarnedCertificateSchema.index(
  { template: 1, number: 1 },
  { unique: true, partialFilterExpression: { number: { $type: "string" } } },
);

QualEarnedCertificateSchema.plugin(mongoosePaginate);
QualEarnedCertificateSchema.plugin(aggregatePaginate);

const model = mongoose.model(
  "qualEarnedCertificate",
  QualEarnedCertificateSchema,
);

module.exports = model;
