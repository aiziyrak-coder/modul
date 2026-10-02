const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const CouncilNumberSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, trim: true },
    specialties: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "sciCouncilSpecialty",
      },
    ],
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

CouncilNumberSchema.plugin(mongoosePaginate);
CouncilNumberSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("sciCouncilNumber", CouncilNumberSchema);
