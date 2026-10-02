const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const SectionSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true, min: 0 },
    title: { type: String, required: true, minlength: 3, maxlength: 500 },
    comment: { type: String, required: true, minlength: 3 },
  },
  { _id: false },
);

const PublicOfferSchema = new mongoose.Schema(
  {
    sections: { type: [SectionSchema], default: [] },
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

PublicOfferSchema.index(
  { active: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);

PublicOfferSchema.plugin(mongoosePaginate);
PublicOfferSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("publicOffer", PublicOfferSchema);
