const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const LanguageOfInstructionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

LanguageOfInstructionSchema.plugin(mongoosePaginate);
LanguageOfInstructionSchema.plugin(aggregatePaginate);

const model = mongoose.model(
  "languageOfInstruction",
  LanguageOfInstructionSchema,
);

module.exports = model;
