const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const AcademicTitleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    position: { type: mongoose.Types.ObjectId, ref: "position" },
    rateTime: { type: Number, required: true },
    hourMultiplier: { type: Number, default: 1.0 },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

AcademicTitleSchema.plugin(mongoosePaginate);
AcademicTitleSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("academicTitle", AcademicTitleSchema);
