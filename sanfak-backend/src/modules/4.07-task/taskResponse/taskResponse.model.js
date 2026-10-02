const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const AttachmentSchema = new mongoose.Schema(
  {
    name: { type: String },
    size: { type: String },
    type: { type: String },
    url: { type: String },
  },
  { _id: false },
);

const TaskResponseSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "task",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    text: { type: String, default: null },
    attachments: { type: [AttachmentSchema], default: [] },

    isComment: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false },
    isRejected: { type: Boolean, default: false },
    rejectionReason: { type: String, default: null },

    isDeadlineChange: { type: Boolean, default: false },
    isReassign: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

TaskResponseSchema.index({ task: 1, createdAt: 1 });
TaskResponseSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("taskResponse", TaskResponseSchema);
