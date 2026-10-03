const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const PositionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, default: null },

    annualHours: { type: Number, default: 720 },
    minAuditoriumHours: { type: Number, default: 400 },
    maxAuditoriumHours: { type: Number, default: 800 },
    allowedStakes: {
      type: [Number],
      default: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5],
    },

    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: { type: Boolean, default: true },
    hemisCode: { type: String, default: null }, // HEMIS lavozim kodi (sinxron kaliti)
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

PositionSchema.plugin(mongoosePaginate);
PositionSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("position", PositionSchema);
