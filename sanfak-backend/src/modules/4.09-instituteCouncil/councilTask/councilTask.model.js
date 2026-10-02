const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const HistorySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    actor: { type: String },
    action: { type: String },
    reason: { type: String },
  },
  { _id: false },
);

const CouncilTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    deadline: { type: Date },
    resultFiles: [{ type: String }],
    status: {
      type: String,
      enum: ["new", "in_progress", "done", "approved", "rejected", "overdue"],
      default: "new",
    },
    rejectReason: { type: String },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    completedAt: { type: Date },
    overdueNotifiedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    history: { type: [HistorySchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

CouncilTaskSchema.plugin(mongoosePaginate);
CouncilTaskSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("councilTask", CouncilTaskSchema);
