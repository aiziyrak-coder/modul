const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const {
  achievementBaseFields,
} = require("#modules/4.10-scientificDept/_shared/achievement.model");

const PATENT_TYPES = ["invention", "utilityModel", "industrialDesign", "selection"];

const PatentSchema = new mongoose.Schema(
  {
    ...achievementBaseFields(),
    title: { type: String, required: true, trim: true },
    patentType: {
      type: String,
      enum: PATENT_TYPES,
    },
    registrationNumber: { type: String, trim: true, default: "" },
    date: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

PatentSchema.plugin(mongoosePaginate);
PatentSchema.plugin(aggregatePaginate);

const model = mongoose.model("patent", PatentSchema);
model.PATENT_TYPES = PATENT_TYPES;

module.exports = model;
