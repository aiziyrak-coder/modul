const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const EducationFormSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, default: null },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: { type: Boolean, default: true },
    isInternational: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

EducationFormSchema.plugin(mongoosePaginate);
EducationFormSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("educationForm", EducationFormSchema);
