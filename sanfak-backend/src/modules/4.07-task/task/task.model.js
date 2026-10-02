const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");

const TASK_STATUSES = [
  "new",
  "in_progress",
  "under_review",
  "completed",
  "rejected",
  "not_needed",
];

const TERMINAL_STATUSES = ["completed", "rejected", "not_needed"];

const ACTIVE_STATUSES = TASK_STATUSES.filter((s) => !TERMINAL_STATUSES.includes(s));

const DISPLAY_STATUSES = [...TASK_STATUSES, "overdue"];

const TASK_PRIORITIES = ["low", "medium", "high"];

const TASK_OUTCOMES = ["completed", "not_needed", "rejected"];

const FINALIZE_OUTCOMES = ["completed", "not_needed"];

const AttachmentSchema = new mongoose.Schema(
  {
    name: { type: String },
    size: { type: String },
    type: { type: String },
    url: { type: String },
  },
  { _id: false },
);

const TaskSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true },

    batchId: { type: String, default: null, index: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    title: { type: String, required: true },
    description: { type: String, default: null },
    deadline: { type: Date, index: true },

    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: "medium",
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "taskCategory",
      default: null,
    },

    attachments: { type: [AttachmentSchema], default: [] },

    status: {
      type: String,
      enum: TASK_STATUSES,
      default: "new",
      index: true,
    },
    outcome: { type: String, enum: TASK_OUTCOMES, default: null },
    rejectionReason: { type: String, default: null },

    readAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    finalizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

TaskSchema.plugin(mongoosePaginate);
TaskSchema.plugin(aggregatePaginate);
TaskSchema.plugin(softDeletePlugin);

const TaskModel = mongoose.model("task", TaskSchema);

module.exports = TaskModel;
module.exports.TASK_STATUSES = TASK_STATUSES;
module.exports.TERMINAL_STATUSES = TERMINAL_STATUSES;
module.exports.TASK_OUTCOMES = TASK_OUTCOMES;
module.exports.ACTIVE_STATUSES = ACTIVE_STATUSES;
module.exports.DISPLAY_STATUSES = DISPLAY_STATUSES;
module.exports.TASK_PRIORITIES = TASK_PRIORITIES;
module.exports.FINALIZE_OUTCOMES = FINALIZE_OUTCOMES;
