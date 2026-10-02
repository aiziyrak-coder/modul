const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");

const SEMESTERS = [
  "1-semestr",
  "2-semestr",
  "3-semestr",
  "4-semestr",
  "5-semestr",
  "6-semestr",
];

const ResidencySkillSchema = new mongoose.Schema(
  {
    specialty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "residencySpecialty",
      required: true,
      index: true,
    },
    specialtyTitle: { type: String, default: null },
    semester: { type: String, enum: SEMESTERS, required: true, index: true },
    theoryTopic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "residencyTheoryTopic",
      required: true,
    },
    theoryTopicTitle: { type: String, default: null },
    practicalSkill: { type: String, required: true },
    patientCount: { type: Number, default: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ResidencySkillSchema.plugin(mongoosePaginate);
ResidencySkillSchema.plugin(aggregatePaginate);
ResidencySkillSchema.plugin(softDeletePlugin);

const ResidencySkillModel = mongoose.model("residencySkill", ResidencySkillSchema);

module.exports = ResidencySkillModel;
module.exports.SEMESTERS = SEMESTERS;
