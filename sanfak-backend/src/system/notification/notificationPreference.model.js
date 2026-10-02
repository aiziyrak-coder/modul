const mongoose = require("mongoose");

const NotificationPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
    },

    preferences: {
      type: Map,
      of: {
        inApp:    { type: Boolean, default: true },
        telegram: { type: Boolean, default: false },
        email:    { type: Boolean, default: false },
        sms:      { type: Boolean, default: false },
      },
      default: () => new Map(),
    },

    digest: {
      enabled:   { type: Boolean, default: false },
      frequency: { type: String, enum: ["daily", "weekly"], default: "daily" },
      time:      { type: String, default: "09:00" },
      lastSentAt:{ type: Date, default: null },
    },

    paused:   { type: Boolean, default: false },
    pausedUntil: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model(
  "notificationPreference",
  NotificationPreferenceSchema,
);
