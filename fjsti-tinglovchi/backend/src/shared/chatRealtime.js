const logger = require("./logger");
const { callMain } = require("./mainApi");

const clients = new Map();

function register(userId, socket) {
  const key = String(userId);
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key).add(socket);
}

function unregister(userId, socket) {
  const key = String(userId);
  const set = clients.get(key);
  if (!set) return;
  set.delete(socket);
  if (!set.size) clients.delete(key);
}

function emitLocal(userId, event, payload) {
  const set = clients.get(String(userId));
  if (!set || !set.size) return false;
  set.forEach((s) => s.emit(event, payload));
  return true;
}

async function deliver(userId, event, payload) {
  if (emitLocal(userId, event, payload)) return;
  try {
    await callMain("/qualification-listener-sync/notify", {
      method: "POST",
      body: { userId: String(userId), event, payload },
    });
  } catch (err) {
    logger.warn(`[chat-rt] asosiyga yetkazib bo'lmadi (${event}): ${err.message}`);
  }
}

module.exports = { register, unregister, emitLocal, deliver };
