"use strict";

const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { DAY_RE } = require("#modules/4.05-residency/samsIngest/samsContract");

const { Schema } = mongoose;

const ResidencySamsOutageSchema = new Schema(
  {
    from: { type: String, required: true, match: DAY_RE },
    to: { type: String, required: true, match: DAY_RE },
    dbname: { type: String, default: null },
    orgTitle: { type: String, default: null },
    reason: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "user", required: true },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "user", default: null },
    cancelReason: { type: String, default: null },
    resolutionPendingSince: { type: Date, default: null },
    resolutionAttempts: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

ResidencySamsOutageSchema.index({ cancelledAt: 1, from: 1 });
ResidencySamsOutageSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("residencySamsOutage", ResidencySamsOutageSchema);
