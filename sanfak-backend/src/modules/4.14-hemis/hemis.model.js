const mongoose = require("mongoose");

// HEMIS'dan kelgan xom yozuv (nusxa). Asosiy jadvallarga ko'chirish alohida qadam.
const hemisRecordSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    hemisId: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    hash: { type: String },
    runId: { type: String },
    missing: { type: Boolean, default: false }, // oxirgi to'liq sinxronda HEMIS'da topilmadi
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
hemisRecordSchema.index({ type: 1, hemisId: 1 }, { unique: true });
hemisRecordSchema.index({ type: 1, runId: 1 });

const hemisSyncRunSchema = new mongoose.Schema(
  {
    runId: { type: String, required: true, unique: true },
    types: [String],
    trigger: { type: String, enum: ["manual", "cron"], default: "manual" },
    status: { type: String, enum: ["running", "ok", "partial", "failed"], default: "running" },
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
    results: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

module.exports = {
  HemisRecord: mongoose.models.HemisRecord || mongoose.model("HemisRecord", hemisRecordSchema),
  HemisSyncRun:
    mongoose.models.HemisSyncRun || mongoose.model("HemisSyncRun", hemisSyncRunSchema),
};
