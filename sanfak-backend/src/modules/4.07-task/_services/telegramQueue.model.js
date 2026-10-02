const mongoose = require("mongoose");

const TelegramQueueSchema = new mongoose.Schema(
  {
    chatId:  { type: String, required: true },
    message: { type: String, required: true },

    options: {
      type:    mongoose.Schema.Types.Mixed,
      default: () => ({ parse_mode: "HTML" }),
    },

    status: {
      type:    String,
      enum:    ["pending", "processing", "sent", "retry", "dead"],
      default: "pending",
    },

    retries:      { type: Number, default: 0 },
    retryAt:      { type: Date,   default: null },
    processingAt: { type: Date,   default: null },
    sentAt:       { type: Date,   default: null },
    deadAt:       { type: Date,   default: null },
    error:        { type: String, default: null },

    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, versionKey: false },
);

TelegramQueueSchema.index({ status: 1, retryAt: 1, createdAt: 1 });

TelegramQueueSchema.index({ status: 1, processingAt: 1 });

TelegramQueueSchema.index(
  { sentAt: 1 },
  { expireAfterSeconds: 7 * 24 * 3600, sparse: true },
);

TelegramQueueSchema.index(
  { deadAt: 1 },
  { expireAfterSeconds: 30 * 24 * 3600, sparse: true },
);

module.exports = mongoose.model("taskTelegramQueue", TelegramQueueSchema);
