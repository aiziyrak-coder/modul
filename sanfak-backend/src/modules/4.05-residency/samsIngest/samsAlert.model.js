"use strict";

const mongoose = require("mongoose");
const { DAY_RE } = require("./samsContract");

const ALERT_TTL_SECONDS = 90 * 24 * 60 * 60;
const ALERT_KINDS = ["digest", "tenants"];

const SamsAlertSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    kind: { type: String, enum: ALERT_KINDS, required: true },
    day: { type: String, required: true, match: DAY_RE },
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
    sent: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false, minimize: false },
);

SamsAlertSchema.index({ createdAt: 1 }, { expireAfterSeconds: ALERT_TTL_SECONDS });
SamsAlertSchema.index({ kind: 1, createdAt: -1 });

module.exports = mongoose.model("residencySamsAlert", SamsAlertSchema);
module.exports.ALERT_TTL_SECONDS = ALERT_TTL_SECONDS;
module.exports.ALERT_KINDS = ALERT_KINDS;
