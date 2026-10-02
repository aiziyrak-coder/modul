const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const RankApplicationSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    rankType: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["rank", "position"],
      default: "rank",
    },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "department" },
    submittedDocs: [
      {
        name: { type: String },
        fileUrl: { type: String },
      },
    ],
    officialDocs: {
      organizationLetter: { type: String },
      guaranteeLetter: { type: String },
      councilApproval: { type: String },
    },
    diploma: {
      fileUrl: { type: String },
      date: { type: Date },
    },
    status: {
      type: String,
      enum: ["new", "accepted", "returned"],
      default: "new",
    },
    returnReason: { type: String },
    archived: { type: Boolean, default: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    submittedAt: { type: Date, default: Date.now },
    history: [
      {
        at: { type: Date, default: Date.now },
        actor: { type: String },
        action: { type: String },
        reason: { type: String },
      },
    ],
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

RankApplicationSchema.plugin(mongoosePaginate);
RankApplicationSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("rankApplication", RankApplicationSchema);
