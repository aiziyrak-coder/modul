const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const CouncilSpecialtySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    branch: { type: String, default: null, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

CouncilSpecialtySchema.plugin(mongoosePaginate);
CouncilSpecialtySchema.plugin(aggregatePaginate);

module.exports = mongoose.model("sciCouncilSpecialty", CouncilSpecialtySchema);
