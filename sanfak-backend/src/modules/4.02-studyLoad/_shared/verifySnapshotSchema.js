"use strict";

const mongoose = require("mongoose");

const VerifySnapshotSchema = new mongoose.Schema(
  {
    step: { type: String, default: null },
    label: { type: String, default: null },
    shortName: { type: String, default: null },
    date: { type: Date, default: null },
  },
  { _id: false },
);

module.exports = { VerifySnapshotSchema };
