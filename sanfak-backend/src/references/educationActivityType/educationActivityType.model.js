const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const EducationActivityTypeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, default: null },
    flow: { type: Boolean, default: false },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

EducationActivityTypeSchema.plugin(mongoosePaginate);
EducationActivityTypeSchema.plugin(aggregatePaginate);

module.exports = mongoose.model(
  "educationActivityType",
  EducationActivityTypeSchema,
);
