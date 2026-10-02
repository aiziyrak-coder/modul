const mongoose = require("mongoose");
const { listenerDb } = require("#shared/db");

let _model = null;

function TopicCompletion() {
  if (_model) return _model;

  const schema = new mongoose.Schema(
    {
      course: { type: String, required: true },
      topic: { type: String, required: true },
      listener: { type: String, required: true },
      startedAt: { type: Date, required: true },
      status: { type: Number, default: 1 },
      isLocked: { type: Boolean, default: false },
      scenarioAnswer: { type: String },
      scenarioImage: { type: String },
      syncedAt: { type: Date, default: null },
      userId: { type: String, default: null },
    },
    { timestamps: true, versionKey: false, strict: true },
  );

  schema.index({ course: 1, topic: 1, listener: 1 }, { unique: true });

  _model = listenerDb().model("TopicCompletion", schema, "topiccompletions");
  return _model;
}

module.exports = { TopicCompletion };
