const mongoose = require("mongoose");

const QualTestConfigSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualCourse",
      required: true,
    },
    kind: {
      type: Number,
      required: true,
    },
    timeLimit: {
      type: Number,
      default: 0,
    },
    randomCount: {
      type: Number,
      default: 0,
    },
    passPercentage: {
      type: Number,
      default: 60,
    },
    topic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualTopic",
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

QualTestConfigSchema.index({ course: 1, kind: 1, topic: 1 }, { unique: true });

module.exports = mongoose.model("qualTestConfig", QualTestConfigSchema);
