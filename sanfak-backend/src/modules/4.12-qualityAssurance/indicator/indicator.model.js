const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const IndicatorSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, default: null },
    coefficient: { type: Number, default: 1 },
    dataFields: [
      {
        fieldName: { type: String },
        fieldType: { type: String },
        required: { type: Boolean },
      },
    ],
    category: { type: String },
    order: { type: Number },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

IndicatorSchema.plugin(mongoosePaginate);
IndicatorSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("indicator", IndicatorSchema);
