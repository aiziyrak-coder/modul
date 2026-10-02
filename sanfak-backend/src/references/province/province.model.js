const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const ProvinceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ProvinceSchema.plugin(mongoosePaginate);
ProvinceSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("province", ProvinceSchema);
