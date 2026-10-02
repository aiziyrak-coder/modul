const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const NormaItemSchema = new mongoose.Schema({
  slug: { type: String, required: true },
  title: { type: String, default: null },
  value: { type: Number, required: true, min: 0 },
});

const AuditoriumHourSchema = new mongoose.Schema(
  {
    auditoriumHour: { type: Number, required: true, min: 0 },

    categories: { type: [NormaItemSchema], default: [] },

    allowedStakes: { type: [Number], default: [0.25, 0.5, 0.75, 1.0] },

    active: { type: Boolean, default: true, index: true },

    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

AuditoriumHourSchema.methods.minHourFor = function (
  positionSlug,
  stavka = 1.0,
) {
  const cat = (this.categories || []).find((c) => c.slug === positionSlug);
  const base = cat ? Number(cat.value) : Number(this.auditoriumHour);
  const factor = Number(stavka) || 1.0;
  return Math.round(base * factor);
};

AuditoriumHourSchema.plugin(mongoosePaginate);
AuditoriumHourSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("auditoriumHour", AuditoriumHourSchema);
