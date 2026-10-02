const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const {
  achievementBaseFields,
} = require("#modules/4.10-scientificDept/_shared/achievement.model");

const TITLE_TYPES = ["dotsent", "professor"];

const ScientificTitleSchema = new mongoose.Schema(
  {
    ...achievementBaseFields(),
    titleType: {
      type: String,
      required: true,
      trim: true,
    },
    specialty: { type: String, required: true, trim: true },
    diplomaSeries: { type: String, required: true, trim: true },
    diplomaNumber: { type: String, required: true, trim: true },
    date: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

ScientificTitleSchema.plugin(mongoosePaginate);
ScientificTitleSchema.plugin(aggregatePaginate);

const model = mongoose.model("scientificTitle", ScientificTitleSchema);
model.TITLE_TYPES = TITLE_TYPES;

module.exports = model;
