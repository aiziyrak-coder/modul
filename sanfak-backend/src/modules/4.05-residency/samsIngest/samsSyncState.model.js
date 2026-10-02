"use strict";

const mongoose = require("mongoose");
const { DAY_RE } = require("./samsContract");

const SYNC_STATE_KEY = "default";

const SamsSyncStateSchema = new mongoose.Schema(
  {
    key: { type: String, enum: [SYNC_STATE_KEY], default: SYNC_STATE_KEY, unique: true },
    resendFrom: { type: String, default: null, match: DAY_RE },
    resendRequestedAt: { type: Date, default: null },
    resendClearedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("residencySamsSyncState", SamsSyncStateSchema);
module.exports.SYNC_STATE_KEY = SYNC_STATE_KEY;
