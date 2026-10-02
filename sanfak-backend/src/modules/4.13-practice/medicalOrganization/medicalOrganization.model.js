const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const MedicalOrganizationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    orgType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "orgType",
      required: true,
    },
    stir: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{9}$/, "STIR 9 xonali raqamdan iborat bo'lishi kerak"],
    },
    region: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "province",
      required: true,
    },
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "region",
      required: true,
    },
    address: { type: String, required: true },
    headName: { type: String, required: true },
    headJshshir: {
      type: String,
      required: true,
      match: [/^\d{14}$/, "JSHSHIR 14 xonali raqamdan iborat bo'lishi kerak"],
    },
    headPhone: { type: String, required: true },
    email: { type: String, default: null },
    capacity: { type: Number, min: 0, default: null },
    responsibleUsers: [
      { type: mongoose.Schema.Types.ObjectId, ref: "user", index: true },
    ],
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  },
  { timestamps: true, versionKey: false },
);

MedicalOrganizationSchema.plugin(mongoosePaginate);
MedicalOrganizationSchema.plugin(aggregatePaginate);

module.exports = mongoose.model(
  "medicalOrganization",
  MedicalOrganizationSchema,
);
