"use strict";

const mongoose = require("mongoose");
const { DAY_RE, ORG_UNMEASURED_REASONS } = require("./samsContract");

const { Schema } = mongoose;

const count = { type: Number, default: 0 };

const DeviceMixSchema = new Schema(
  { hikvision: count, mobile: count, server: count, in: count, out: count },
  { _id: false },
);

const SamsOrgDaySchema = new Schema(
  {
    dbname: { type: String, required: true },
    day: { type: String, required: true, match: DAY_RE },
    orgId: { type: String, default: null },
    orgTitle: { type: String, default: "" },
    horizon: { type: String, default: null },
    measured: { type: Boolean, required: true },
    unmeasuredReason: { type: String, enum: [...ORG_UNMEASURED_REASONS, null], default: null },
    packetAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
    rosterScanCount: count,
    expectedResidents: count,
    scannedResidents: count,
    deviceMix: { type: DeviceMixSchema, default: () => ({}) },
  },
  { timestamps: true, versionKey: false },
);

SamsOrgDaySchema.index({ dbname: 1, day: 1 }, { unique: true, name: "dbname_day_unique" });

module.exports = mongoose.model("residencySamsOrgDay", SamsOrgDaySchema);
