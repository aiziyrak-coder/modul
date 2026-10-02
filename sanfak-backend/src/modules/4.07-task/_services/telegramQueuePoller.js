const mongoose = require("mongoose");
const winston = require("#shared/winston.logger");
const TelegramQueue = require("./telegramQueue.model");
const { getBot } = require("./taskBot");

const POLL_INTERVAL_MS   = 35;
const MAX_RETRIES        = 5;
const STUCK_THRESHOLD_MS = 60 * 1000;

const PERMANENT_400 = ["chat not found", "user is deactivated", "bot was blocked by the user"];
const isPermanentError = (err) =>
  err?.code === 403 ||
  (err?.code === 400 && PERMANENT_400.some((m) => err?.description?.toLowerCase().includes(m)));

let _timer     = null;
let _isRunning = false;

const recoverStuck = async () => {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS);
    const result = await TelegramQueue.updateMany(
      { status: "processing", processingAt: { $lt: threshold } },
      { $set: { status: "pending", processingAt: null } },
    );
    if (result.modifiedCount > 0) {
      winston.warn(
        `[Task:TgQueue] ${result.modifiedCount} ta tiqilib qolgan xabar "pending"ga qaytarildi`,
      );
    }
  } catch (err) {
    winston.error(`[Task:TgQueue] recoverStuck xato: ${err.message}`);
  }
};

const logQueueHealth = async () => {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const rows = await TelegramQueue.aggregate([
      { $match: { status: { $in: ["pending", "retry", "dead"] } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);
    const s = Object.fromEntries(rows.map((r) => [r._id, r.n]));
    if (s.pending || s.retry || s.dead) {
      winston.info(
        `[Task:TgQueue] holat — pending:${s.pending || 0} retry:${s.retry || 0} dead:${s.dead || 0}`,
      );
    }
    if (s.dead) {
      winston.warn(`[Task:TgQueue] ${s.dead} ta xabar dead-letter — tasktelegramqueues kolleksiyasini tekshiring`);
    }
  } catch (err) {
    winston.error(`[Task:TgQueue] health log xato: ${err.message}`);
  }
};

const processOne = async () => {
  let doc;
  try {
    doc = await TelegramQueue.findOneAndUpdate(
      {
        status: { $in: ["pending", "retry"] },
        $or: [{ retryAt: null }, { retryAt: { $lte: new Date() } }],
      },
      { $set: { status: "processing", processingAt: new Date() } },
      { sort: { createdAt: 1 }, new: false },
    );
  } catch (err) {
    winston.error(`[Task:TgQueue] claim xato: ${err.message}`);
    return;
  }

  if (!doc) return;

  const bot = getBot();
  if (!bot) {
    try {
      await TelegramQueue.findByIdAndUpdate(doc._id, {
        $set: { status: "pending", processingAt: null },
      });
    } catch (e) {
      winston.error(`[Task:TgQueue] release xato: ${e.message}`);
    }
    return;
  }

  try {
    await bot.telegram.sendMessage(
      doc.chatId,
      doc.message,
      doc.options || { parse_mode: "HTML" },
    );
    await TelegramQueue.findByIdAndUpdate(doc._id, {
      $set: { status: "sent", sentAt: new Date(), error: null },
    });
  } catch (err) {
    const newRetries = (doc.retries || 0) + 1;

    const is429      = err?.code === 429 || err?.response?.error_code === 429;
    const retryAfter = err?.parameters?.retry_after || err?.response?.parameters?.retry_after;

    if (isPermanentError(err)) {
      try {
        await TelegramQueue.findByIdAndUpdate(doc._id, {
          $set: {
            status:  "dead",
            deadAt:  new Date(),
            error:   err.description || err.message,
            retries: newRetries,
          },
        });
      } catch (e) {
        winston.error(`[Task:TgQueue] dead mark xato: ${e.message}`);
      }
      winston.warn(
        `[Task:TgQueue] permanent xato dead: chatId=${doc.chatId} code=${err?.code} — ${err.description || err.message}`,
      );
    } else if (newRetries >= MAX_RETRIES) {
      try {
        await TelegramQueue.findByIdAndUpdate(doc._id, {
          $set: {
            status:  "dead",
            deadAt:  new Date(),
            error:   err.message,
            retries: newRetries,
          },
        });
      } catch (e) {
        winston.error(`[Task:TgQueue] dead mark xato: ${e.message}`);
      }
      winston.error(
        `[Task:TgQueue] dead: chatId=${doc.chatId} retries=${newRetries} — ${err.message}`,
      );
    } else if (is429 && retryAfter) {
      try {
        await TelegramQueue.findByIdAndUpdate(doc._id, {
          $set: {
            status:  "retry",
            retryAt: new Date(Date.now() + retryAfter * 1000),
            error:   err.message,
            retries: newRetries,
          },
        });
      } catch (e) {
        winston.error(`[Task:TgQueue] 429 update xato: ${e.message}`);
      }
      winston.warn(
        `[Task:TgQueue] 429 — ${retryAfter}s kutilmoqda (chatId=${doc.chatId}, urinish ${newRetries})`,
      );
    } else {
      const backoffMs = Math.min(60, 2 ** newRetries) * 1000;
      try {
        await TelegramQueue.findByIdAndUpdate(doc._id, {
          $set: {
            status:  "retry",
            retryAt: new Date(Date.now() + backoffMs),
            error:   err.message,
            retries: newRetries,
          },
        });
      } catch (e) {
        winston.error(`[Task:TgQueue] backoff update xato: ${e.message}`);
      }
      winston.warn(
        `[Task:TgQueue] xato retry ${newRetries}/${MAX_RETRIES} — backoff ${backoffMs / 1000}s: ${err.message}`,
      );
    }
  }
};

const tick = async () => {
  if (_isRunning) return;
  if (mongoose.connection.readyState !== 1) return;
  _isRunning = true;
  try {
    await processOne();
  } finally {
    _isRunning = false;
  }
};

const initPoller = async () => {
  if (_timer) return;

  await recoverStuck();

  setInterval(recoverStuck, 5 * 60 * 1000).unref();
  setInterval(logQueueHealth, 60 * 1000).unref();

  _timer = setInterval(tick, POLL_INTERVAL_MS);
  _timer.unref();
  winston.info(
    `[Task:TgQueue] poller ishga tushdi (${POLL_INTERVAL_MS}ms interval, max ~${Math.floor(1000 / POLL_INTERVAL_MS)} msg/s)`,
  );
};

const stopPoller = () => {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    winston.info("[Task:TgQueue] poller to'xtatildi");
  }
};

module.exports = { initPoller, stopPoller };
