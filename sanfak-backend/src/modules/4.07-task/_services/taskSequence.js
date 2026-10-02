const mongoose = require("mongoose");

const TaskCounterSchema = new mongoose.Schema(
  {
    _id: { type: String },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

const TaskCounter =
  mongoose.models.taskCounter ||
  mongoose.model("taskCounter", TaskCounterSchema);

const COUNTER_ID = "task";

const reserveTaskCodes = async (count = 1) => {
  const doc = await TaskCounter.findByIdAndUpdate(
    COUNTER_ID,
    { $inc: { seq: count } },
    { new: true, upsert: true },
  );
  const end = doc.seq;
  const start = end - count + 1;
  return { start, end };
};

const formatTaskCode = (seq) => `T-${seq}`;

module.exports = { reserveTaskCodes, formatTaskCode, TaskCounter };
