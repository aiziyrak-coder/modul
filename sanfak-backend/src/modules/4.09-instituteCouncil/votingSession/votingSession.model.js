const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const VotingSessionSchema = new mongoose.Schema(
  {
    title: { type: String },
    desc: { type: String },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "department" },
    rankType: { type: String },
    mode: { type: String, enum: ["single", "choice"], default: "single" },
    candidates: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        diplomaFile: { type: String },
        diplomaDate: { type: Date },
      },
    ],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    passingPercent: { type: Number, default: 60 },
    status: {
      type: String,
      enum: ["active", "approved", "rejected"],
      default: "active",
    },
    results: {
      for: { type: Number },
      against: { type: Number },
      abstain: { type: Number },
      winner: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
      passed: { type: Boolean },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    autoFinalizedAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

VotingSessionSchema.plugin(mongoosePaginate);
VotingSessionSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("votingSession", VotingSessionSchema);
