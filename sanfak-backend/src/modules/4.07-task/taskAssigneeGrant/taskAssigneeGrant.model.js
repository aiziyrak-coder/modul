const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const TaskAssigneeGrantSchema = new mongoose.Schema(
  {
    assigner: {
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

TaskAssigneeGrantSchema.index({ assigner: 1, assignee: 1 }, { unique: true });

TaskAssigneeGrantSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("taskAssigneeGrant", TaskAssigneeGrantSchema);
