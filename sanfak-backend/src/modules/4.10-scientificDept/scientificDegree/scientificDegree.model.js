const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const {
  achievementBaseFields,
} = require("#modules/4.10-scientificDept/_shared/achievement.model");

const DEGREE_TYPES = ["phd", "dsc"];

const ScientificDegreeSchema = new mongoose.Schema(
  {
    ...achievementBaseFields(),
    degreeType: {
      type: String,
      required: true,
      trim: true,
    },
    specialty: { type: String, required: true, trim: true },
    dissertationTopic: { type: String, required: true, trim: true },
    awardedDate: { type: Date },

    defenseDate: { type: Date },
    councilName: { type: String, default: "", trim: true },
    councilNumber: { type: String, default: "", trim: true },
    autoAbstractUrl: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false },
);

ScientificDegreeSchema.plugin(mongoosePaginate);
ScientificDegreeSchema.plugin(aggregatePaginate);

const model = mongoose.model("scientificDegree", ScientificDegreeSchema);
model.DEGREE_TYPES = DEGREE_TYPES;

module.exports = model;
