const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const WorkReviewSchema = new mongoose.Schema(
  {
    work: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "scientificWork",
      required: true,
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    docKey: { type: String, required: true },
    type: {
      type: String,
      enum: ["positive", "neutral", "negative"],
      required: true,
    },
    text: { type: String, maxlength: 3000 },
    reviewedAt: { type: Date, default: Date.now },
    edited: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

WorkReviewSchema.plugin(mongoosePaginate);
WorkReviewSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("workReview", WorkReviewSchema);
