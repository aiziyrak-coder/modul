const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const AnonymousVoteSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "votingSession",
      required: true,
    },
    voter: { type: String, required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId },
    choice: {
      type: String,
      enum: ["for", "against", "abstain"],
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

AnonymousVoteSchema.index({ session: 1, voter: 1 }, { unique: true });

AnonymousVoteSchema.plugin(mongoosePaginate);
AnonymousVoteSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("anonymousVote", AnonymousVoteSchema);
