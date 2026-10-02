const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { listenerDb } = require("#shared/db");

let _model = null;

function ChatMessage() {
  if (_model) return _model;

  const schema = new mongoose.Schema(
    {
      sender: { type: String, required: true, index: true },
      receiver: { type: String, required: true, index: true },
      message: { type: String, required: true },
      fileUrl: { type: String },
      fileType: { type: String },
      readAt: { type: Date, default: null },
      isDeleted: { type: Boolean, default: false },
      active: { type: Boolean, default: true },
    },
    { timestamps: true, versionKey: false, strict: true },
  );

  schema.index({ sender: 1, receiver: 1, createdAt: -1 });
  schema.index({ receiver: 1, readAt: 1 });
  schema.plugin(mongoosePaginate);

  _model = listenerDb().model("ChatMessage", schema, "chatmessages");
  return _model;
}

module.exports = { ChatMessage };
