const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const StudyPeriodSchema = new mongoose.Schema(
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

StudyPeriodSchema.plugin(mongoosePaginate);
StudyPeriodSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("studyPeriod", StudyPeriodSchema);
