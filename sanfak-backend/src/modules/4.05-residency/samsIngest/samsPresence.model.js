"use strict";

const mongoose = require("mongoose");
const { DAY_RE, UNMEASURED_REASONS } = require("./samsContract");

const { Schema } = mongoose;

const DeviceSchema = new Schema(
  {
    device: { type: Number, default: null },
    type: { type: Number, default: null },
  },
  { _id: false },
);

const RecordSchema = new Schema(
  {
    attendId: { type: String, required: true },
    accessTime: { type: String, default: null },
    exitTime: { type: String, default: null },
    deviceType: { type: [DeviceSchema], default: [] },
    lated: { type: Number, default: null },
    earlyLeft: { type: Number, default: null },
  },
  { _id: false },
);

const SamsPresenceSchema = new Schema(
  {
    resident: { type: Schema.Types.ObjectId, ref: "resident", required: true },
    day: { type: String, required: true, match: DAY_RE },
    dbname: { type: String, default: null },
    samsUserId: { type: String, default: null },
    measured: { type: Boolean, required: true },
    unmeasuredReason: { type: String, enum: [...UNMEASURED_REASONS, null], default: null },
    ambiguousDbnames: { type: [String], default: [] },
    hasShift: { type: Boolean, default: null },
    samsSince: { type: String, default: null },
    samsUserActive: { type: Boolean, default: null },
    lastActive: { type: String, default: null },
    records: { type: [RecordSchema], default: [] },
    recordCount: { type: Number, default: 0 },
    packetAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

SamsPresenceSchema.index({ resident: 1, day: 1 }, { unique: true, name: "resident_day_unique" });
SamsPresenceSchema.index({ dbname: 1, day: 1 });

const SamsPresence = mongoose.model("residencySamsPresence", SamsPresenceSchema);

module.exports = SamsPresence;
module.exports.UNMEASURED_REASONS = UNMEASURED_REASONS;
