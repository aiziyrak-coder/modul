const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const AssessmentTypeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, default: null },
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

AssessmentTypeSchema.plugin(mongoosePaginate);
AssessmentTypeSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("assessmentType", AssessmentTypeSchema);
