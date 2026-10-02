const Redis = require("ioredis");
const winston = require("#shared/winston.logger");

const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 500, 10000),
};

const pub = new Redis(redisConfig);
const sub = pub.duplicate();

const OFFLINE_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"]);
let offlineLogged = false;

const onRedisError = (who) => (err) => {
  if (OFFLINE_CODES.has(err?.code)) {
    if (offlineLogged) return;
    offlineLogged = true;
    winston.warn(
      `[Redis] ulanib bo'lmadi (${redisConfig.host}:${redisConfig.port}) — ` +
        `Socket.IO ko'p-process adapteri ISHLAMAYDI, asosiy API ishlayveradi. ` +
        `Qayta urinish davom etadi; takroriy loglar bosildi.`,
    );
    return;
  }
  winston.error(`[Redis] ${who} xato: ${err.message}`);
};

pub.on("error", onRedisError("pub"));
sub.on("error", onRedisError("sub"));
pub.on("connect", () => {
  winston.info("[Redis] pub ulandi");
  offlineLogged = false;
  pub.stream?.unref?.();
});
sub.on("connect", () => {
  winston.info("[Redis] sub ulandi");
  sub.stream?.unref?.();
});

module.exports = { pub, sub };
