const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const WorkDecisionSchema = new mongoose.Schema(
  {
    work: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "scientificWork",
      required: true,
    },
    type: {
      type: String,
      enum: ["seminar", "revision", "rejection"],
    },
    finalConclusion: { type: String },
    comment: { type: String },
    revisionDocs: [{ type: String }],
    seminarDate: { type: Date },
    rejectionReason: { type: String },
    dalolatnoma: { type: String },
    eriSigned: { type: Boolean, default: false },
    signedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        signedAt: { type: Date },
      },
    ],
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

WorkDecisionSchema.plugin(mongoosePaginate);
WorkDecisionSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("workDecision", WorkDecisionSchema);
