const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualCalendarPlanSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    file: {
      type: String,
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

QualCalendarPlanSchema.plugin(mongoosePaginate);
QualCalendarPlanSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualCalendarPlan", QualCalendarPlanSchema);

module.exports = model;
