const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const {
  achievementBaseFields,
} = require("#modules/4.10-scientificDept/_shared/achievement.model");

const DefenseSchema = new mongoose.Schema(
  {
    ...achievementBaseFields(),

    degreeType: { type: String, required: true, trim: true },
    scienceBranch: { type: String, required: true, trim: true },
    specialty: { type: String, required: true, trim: true },
    diplomaSeries: { type: String, default: "", trim: true },
    diplomaNumber: { type: String, default: "", trim: true },

    defenseDate: { type: Date },
    councilName: { type: String, default: "", trim: true },
    councilNumber: { type: String, default: "", trim: true },

    autoAbstractUrl: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false },
);

DefenseSchema.plugin(mongoosePaginate);
DefenseSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("defense", DefenseSchema);
