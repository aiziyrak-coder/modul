const mongoose = require("mongoose");

const TaskTelegramBindingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
      index: true,
    },
    chatId: { type: String, required: true },
    phone: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model(
  "taskTelegramBinding",
  TaskTelegramBindingSchema,
);
