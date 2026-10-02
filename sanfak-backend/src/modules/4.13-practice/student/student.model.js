const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const PracticeStudentSchema = new mongoose.Schema(
  {
    fish: { type: String, required: true },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      required: true,
    },
    direction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "direction",
      required: true,
    },
    course: { type: Number, required: true, min: 1 },
    group: { type: String, required: true },
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
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  },
  { timestamps: true, versionKey: false },
);

PracticeStudentSchema.plugin(mongoosePaginate);
PracticeStudentSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("practiceStudent", PracticeStudentSchema);
