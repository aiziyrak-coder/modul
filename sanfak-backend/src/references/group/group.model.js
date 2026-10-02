const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const GroupSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, default: null },
    direction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "direction",
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
    },
    lang: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "languageOfInstruction",
      default: null,
    },
    studentNumber: {
      type: Number,
      default: 0,
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
    },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

GroupSchema.plugin(mongoosePaginate);
GroupSchema.plugin(aggregatePaginate);

const {
  attachToGroupSchema,
} = require("#modules/4.02-studyLoad/_services/workloadRecalculator");
attachToGroupSchema(GroupSchema);

module.exports = mongoose.model("group", GroupSchema);
