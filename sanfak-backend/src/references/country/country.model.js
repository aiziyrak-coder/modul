const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const CountrySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    flag: { type: String, default: null },
    passportSeries: { type: String, default: null },
    passportNumber: { type: String, default: null },
    phone: { type: String, default: null },
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

CountrySchema.plugin(mongoosePaginate);
CountrySchema.plugin(aggregatePaginate);

module.exports = mongoose.model("country", CountrySchema);
