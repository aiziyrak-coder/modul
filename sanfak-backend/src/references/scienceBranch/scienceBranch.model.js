const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const ScienceBranchSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    code: { type: String, default: "", trim: true },
    desc: { type: String, default: null },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

ScienceBranchSchema.plugin(mongoosePaginate);
ScienceBranchSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("scienceBranch", ScienceBranchSchema);
