const mongoose = require("mongoose");

const ApplicationTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, default: "application", unique: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    size: { type: Number, default: null },
    unit: { type: String, default: null },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model(
  "sciApplicationTemplate",
  ApplicationTemplateSchema,
);
