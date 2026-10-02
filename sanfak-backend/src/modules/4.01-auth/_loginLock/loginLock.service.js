const crypto = require("crypto");
const { ipKeyGenerator } = require("express-rate-limit");
const LoginLockModel = require("./loginLock.model");

const LOCK_POLICY = Object.freeze({
  MAX_FAILED_ATTEMPTS: 8,
  WINDOW_MS: 15 * 60 * 1000,
  LOCK_MS: 30 * 60 * 1000,
});

const TTL_GRACE_MS = 5 * 60 * 1000;

const hashKey = (ip, pin) => {
  const normalizedIp = ipKeyGenerator(String(ip || ""));
  return crypto
    .createHash("sha256")
    .update(`loginLock:v2:${normalizedIp}|${pin}`)
    .digest("hex");
};

const remainingFrom = (lockedUntil, now) => {
  const ms = Math.max(lockedUntil.getTime() - now, 0);
  return {
    retryAfterSeconds: Math.ceil(ms / 1000),
    retryAfterMinutes: Math.max(Math.ceil(ms / 60000), 1),
  };
};

module.exports = {
  LOCK_POLICY,
  hashKey,

  checkLock: async (ip, pin) => {
    const doc = await LoginLockModel.findOne({ pinHash: hashKey(ip, pin) })
      .select("lockedUntil")
      .lean()
      .exec();

    const now = Date.now();
    if (!doc || !doc.lockedUntil || new Date(doc.lockedUntil).getTime() <= now) {
      return { locked: false };
    }

    const lockedUntil = new Date(doc.lockedUntil);
    return { locked: true, lockedUntil, ...remainingFrom(lockedUntil, now) };
  },

  registerFailure: async (ip, pin) => {
    const pinHash = hashKey(ip, pin);
    const now = new Date();
    const windowFloor = new Date(now.getTime() - LOCK_POLICY.WINDOW_MS);

    await LoginLockModel.updateOne(
      { pinHash, windowStartAt: { $lt: windowFloor } },
      { $set: { windowStartAt: now, failedCount: 0 } },
    ).exec();

    const doc = await LoginLockModel.findOneAndUpdate(
      { pinHash },
      {
        $inc: { failedCount: 1 },
        $set: {
          lastFailedAt: now,
          expiresAt: new Date(now.getTime() + LOCK_POLICY.WINDOW_MS + TTL_GRACE_MS),
        },
        $setOnInsert: { windowStartAt: now },
      },
      { new: true, upsert: true },
    ).exec();

    const failedCount = doc?.failedCount || 0;
    if (failedCount < LOCK_POLICY.MAX_FAILED_ATTEMPTS) {
      return {
        locked: false,
        justLocked: false,
        failedCount,
        remaining: LOCK_POLICY.MAX_FAILED_ATTEMPTS - failedCount,
        lockedUntil: null,
      };
    }

    const lockedUntil = new Date(now.getTime() + LOCK_POLICY.LOCK_MS);
    await LoginLockModel.updateOne(
      { pinHash },
      {
        $set: {
          lockedUntil,
          failedCount: 0,
          windowStartAt: now,
          expiresAt: new Date(lockedUntil.getTime() + TTL_GRACE_MS),
        },
        $inc: { lockCount: 1 },
      },
    ).exec();

    return {
      locked: true,
      justLocked: true,
      failedCount,
      remaining: 0,
      lockedUntil,
    };
  },

  clearFailures: async (ip, pin) => {
    await LoginLockModel.deleteOne({ pinHash: hashKey(ip, pin) }).exec();
  },
};
