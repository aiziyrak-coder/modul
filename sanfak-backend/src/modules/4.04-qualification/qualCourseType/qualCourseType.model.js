const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualCourseTypeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    kind: {
      type: Number,
      required: true,
    },
    template: {
      type: Number,
      default: 1,
    },
    file: {
      type: String,
    },
    fileDetails: {
      type: Object,
    },
  },
  { timestamps: true, versionKey: false },
);

QualCourseTypeSchema.plugin(mongoosePaginate);
QualCourseTypeSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualCourseType", QualCourseTypeSchema);

module.exports = model;
