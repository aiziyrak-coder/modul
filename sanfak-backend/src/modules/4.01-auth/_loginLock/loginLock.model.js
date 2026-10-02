const mongoose = require("mongoose");

const LoginLockSchema = new mongoose.Schema(
  {
    pinHash: { type: String, required: true, unique: true },

    failedCount: { type: Number, default: 0 },

    windowStartAt: { type: Date, default: () => new Date() },

    lockedUntil: { type: Date, default: null },

    lastFailedAt: { type: Date, default: null },

    lockCount: { type: Number, default: 0 },

    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

LoginLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("loginLock", LoginLockSchema);
