const mongoose = require("mongoose");

const WorkingScheduleJobSchema = new mongoose.Schema(
  {
    learningProcess: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "learningProcess",
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    state: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },
    totalCourses: { type: Number, default: 0 },
    completedCourses: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
    courses: [
      {
        courseNum: Number,
        status: {
          type: String,
          enum: ["pending", "in_progress", "created", "skipped", "failed"],
          default: "pending",
        },
      },
    ],
    error: { type: String, default: null },
    startedAt: { type: Date, default: () => new Date() },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

WorkingScheduleJobSchema.index(
  { learningProcess: 1 },
  { unique: true, partialFilterExpression: { state: "running" } },
);

module.exports = mongoose.model("workingScheduleJob", WorkingScheduleJobSchema);
