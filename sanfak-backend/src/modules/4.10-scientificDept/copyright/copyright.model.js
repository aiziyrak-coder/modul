const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const {
  achievementBaseFields,
} = require("#modules/4.10-scientificDept/_shared/achievement.model");

const CopyrightSchema = new mongoose.Schema(
  {
    ...achievementBaseFields(),
    title: { type: String, required: true, trim: true },
    authors: { type: String, trim: true, default: "" },
    institutionName: { type: String, trim: true, default: "" },
    registrationNumber: { type: String, trim: true, default: "" },
    date: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

CopyrightSchema.plugin(mongoosePaginate);
CopyrightSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("copyright", CopyrightSchema);
