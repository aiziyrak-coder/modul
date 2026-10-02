const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const RegionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    province: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "province",
      required: true,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

RegionSchema.plugin(mongoosePaginate);
RegionSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("region", RegionSchema);
