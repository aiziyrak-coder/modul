const mongoose = require("mongoose");

const DocItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    required: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    maxFiles: { type: Number, default: 1, min: 1 },
  },
  { _id: false },
);

const DocSettingSchema = new mongoose.Schema(
  {
    categories: {
      rank: { type: [DocItemSchema], default: [] },
      position: { type: [DocItemSchema], default: [] },
    },
    rankTypes: {
      type: [String],
      default: ["Dotsent", "Professor"],
    },
    positionTypes: {
      type: [String],
      default: [
        "Stajor",
        "Assistent (o'qituvchi)",
        "Katta o'qituvchi",
        "V.B. Dotsent",
        "V.B. Professor",
      ],
    },
    passingPercent: { type: Number, default: 60 },
    defaultDocsVersion: { type: Number, default: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("docSetting", DocSettingSchema);
