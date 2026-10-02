const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const ScienceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, default: null },
    scienceCode: { type: String, default: null },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
    },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: { type: Boolean, default: true },
    isElective: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

ScienceSchema.plugin(mongoosePaginate);
ScienceSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("science", ScienceSchema);
