const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const STARTUP_FILE_SLOTS = [
  "passport",
  "application",
  "presentation",
  "certificate",
];

const StartupSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "faculty",
    },
    type: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "startupType",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    files: {
      passport: { type: String, default: "" },
      application: { type: String, default: "" },
      presentation: { type: String, default: "" },
      certificate: { type: String, default: "" },
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

StartupSchema.plugin(mongoosePaginate);
StartupSchema.plugin(aggregatePaginate);

const model = mongoose.model("startup", StartupSchema);
model.STARTUP_FILE_SLOTS = STARTUP_FILE_SLOTS;

module.exports = model;
