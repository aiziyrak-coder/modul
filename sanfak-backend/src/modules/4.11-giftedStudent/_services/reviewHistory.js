const mongoose = require("mongoose");

const ReviewHistorySchema = new mongoose.Schema(
  {
    status: { type: String },
    note: { type: String, default: null },
    score: { type: Number },
    scoreLabel: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    reviewedAt: { type: Date },
    supersededAt: { type: Date },
  },
  { _id: false },
);

function snapshotReview(doc, fields = {}) {
  if (!doc) return null;
  const noteKey = fields.note || "reviewNote";
  const status = doc.status;
  if (status !== "approved" && status !== "rejected") return null;

  const entry = {
    status,
    note: doc[noteKey] ?? null,
    reviewedBy: doc.reviewedBy ?? undefined,
    reviewedAt: doc.reviewedAt ?? undefined,
    supersededAt: new Date(),
  };
  if (fields.withScore) {
    if (doc.score != null) entry.score = doc.score;
    if (doc.scoreLabel != null) entry.scoreLabel = doc.scoreLabel;
  }
  return entry;
}

module.exports = { ReviewHistorySchema, snapshotReview };
