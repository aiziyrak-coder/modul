const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");

const ASSESSMENT_TYPES = ["oraliq", "amaliy", "yakuniy", "attestatsiya", "test"];

const AssessmentSchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "resident",
      required: true,
      index: true,
    },
    science: { type: mongoose.Schema.Types.ObjectId, ref: "science" },
    type: { type: String, enum: ASSESSMENT_TYPES, index: true },
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "residencyTest",
      default: null,
      index: true,
    },
    score: { type: Number },
    maxScore: { type: Number, default: 100 },
    attestationAllowed: { type: Boolean, default: true },
    assessor: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

AssessmentSchema.plugin(mongoosePaginate);
AssessmentSchema.plugin(aggregatePaginate);
AssessmentSchema.plugin(softDeletePlugin);

const AssessmentModel = mongoose.model("assessment", AssessmentSchema);

module.exports = AssessmentModel;
module.exports.ASSESSMENT_TYPES = ASSESSMENT_TYPES;
