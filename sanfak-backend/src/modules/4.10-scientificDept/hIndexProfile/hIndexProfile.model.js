const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const HIndexProfileSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "faculty",
    },

    scopusUrl: { type: String, default: "" },
    scopusAuthorId: { type: String, default: "" },
    scopusHIndex: { type: Number, default: 0, min: 0 },
    scopusCitations: { type: Number, default: 0, min: 0 },
    scopusDocuments: { type: Number, default: 0, min: 0 },
    scopusSyncedAt: { type: Date, default: null },
    scopusSyncError: { type: String, default: "" },

    scholarUrl: { type: String, default: "" },
    scholarUserId: { type: String, default: "" },
    scholarHIndex: { type: Number, default: 0, min: 0 },
    scholarCitations: { type: Number, default: 0, min: 0 },
    scholarI10Index: { type: Number, default: 0, min: 0 },
    scholarSyncedAt: { type: Date, default: null },
    scholarSyncError: { type: String, default: "" },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

HIndexProfileSchema.plugin(mongoosePaginate);
HIndexProfileSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("hIndexProfile", HIndexProfileSchema);
