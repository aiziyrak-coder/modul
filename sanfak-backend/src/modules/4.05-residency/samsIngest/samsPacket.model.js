"use strict";

const mongoose = require("mongoose");
const { DAY_RE } = require("./samsContract");

const { Schema } = mongoose;

const PACKET_TTL_SECONDS = 90 * 24 * 60 * 60;

const OrgRefSchema = new Schema(
  { dbname: { type: String, required: true }, orgTitle: { type: String, default: "" } },
  { _id: false },
);

const count = { type: Number, default: 0 };

const SamsPacketSchema = new Schema(
  {
    receivedAt: { type: Date, required: true },
    emittedAt: { type: Date, required: true },
    schemaVersion: { type: Number, required: true },
    packetId: { type: String, default: null },
    trigger: { type: String, default: null },
    serverUtcOffsetMinutes: { type: Number, default: null },
    window: {
      from: { type: String, required: true, match: DAY_RE },
      to: { type: String, required: true, match: DAY_RE },
    },
    tenantsScanned: count,
    tenantsWithResidents: count,
    tenantCount: count,
    peopleCount: count,
    unresolvedCount: count,
    ambiguousCount: count,
    failedTenants: { type: [OrgRefSchema], default: [] },
    tenantDbnames: { type: [String], default: undefined },
    tenantSetChanged: {
      type: new Schema(
        { added: { type: [OrgRefSchema], default: [] }, removed: { type: [String], default: [] } },
        { _id: false },
      ),
      default: null,
    },
  },
  { versionKey: false },
);

SamsPacketSchema.index({ receivedAt: 1 }, { expireAfterSeconds: PACKET_TTL_SECONDS });

module.exports = mongoose.model("residencySamsPacket", SamsPacketSchema);
module.exports.PACKET_TTL_SECONDS = PACKET_TTL_SECONDS;
