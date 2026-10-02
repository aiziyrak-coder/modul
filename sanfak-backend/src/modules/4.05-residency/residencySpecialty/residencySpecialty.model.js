const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");

const RESIDENCY_PROGRAMS = ["magistratura", "ordinatura"];

const ResidencySpecialtySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    code: { type: String, default: null },
    program: { type: String, enum: RESIDENCY_PROGRAMS, required: true, index: true },
    studyPeriod: { type: Number, default: null, min: 1, max: 10 },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      default: null,
    },
    departmentTitle: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ResidencySpecialtySchema.index(
  { code: 1, program: 1 },
  {
    unique: true,
    partialFilterExpression: { code: { $type: "string" }, deletedAt: null },
  },
);

ResidencySpecialtySchema.plugin(mongoosePaginate);
ResidencySpecialtySchema.plugin(aggregatePaginate);
ResidencySpecialtySchema.plugin(softDeletePlugin);

const ResidencySpecialtyModel = mongoose.model(
  "residencySpecialty",
  ResidencySpecialtySchema,
);

module.exports = ResidencySpecialtyModel;
module.exports.RESIDENCY_PROGRAMS = RESIDENCY_PROGRAMS;
