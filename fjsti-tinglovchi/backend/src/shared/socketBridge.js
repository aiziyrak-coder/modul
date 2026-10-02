const jwt = require("jsonwebtoken");
const { io: ioClient } = require("socket.io-client");
const logger = require("./logger");
const { register, unregister } = require("./chatRealtime");
const chatService = require("#modules/chat/chat.service");

const UP_EVENTS = ["typing", "stopTyping", "heartbeat", "getOnlineUsers"];

const DOWN_EVENTS = ["onlineUsers", "typing", "stopTyping"];

const mainOrigin = () =>
  String(process.env.MAIN_API_URL || "").replace(/\/api\/?$/, "").replace(/\/$/, "");

function initSocketBridge(io) {
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) return next(new Error("Token topilmadi"));

      const payload = jwt.verify(token, process.env.LISTENER_JWT_SECRET);
      if (payload.role !== "tinglovchi") return next(new Error("Faqat tinglovchi"));

      socket.userId = String(payload._id || payload.sub);
      return next();
    } catch {
      return next(new Error("Token noto'g'ri"));
    }
  });

  io.on("connection", (socket) => {
    const origin = mainOrigin();
    if (!origin) {
      logger.error("[bridge] MAIN_API_URL sozlanmagan — real-time ishlamaydi");
      return;
    }

    const upstream = ioClient(origin, {
      auth: { serviceKey: process.env.SERVICE_KEY || "", actAsListener: socket.userId },
      tryAllTransports: true,
      reconnection: true,
    });

    upstream.on("connect", () => logger.info(`[bridge] upstream ulandi: ${socket.userId}`));
    upstream.on("connect_error", (err) =>
      logger.warn(`[bridge] upstream xato (${socket.userId}): ${err.message}`),
    );

    upstream.on("disconnect", () => socket.emit("onlineUsers", []));

    DOWN_EVENTS.forEach((ev) => upstream.on(ev, (payload) => socket.emit(ev, payload)));

    UP_EVENTS.forEach((ev) => socket.on(ev, (payload) => upstream.emit(ev, payload)));

    register(socket.userId, socket);

    socket.on("sendMessage", async (data) => {
      try {
        await chatService.send(socket.userId, {
          receiver: data && data.receiverId,
          message: data && data.message,
          fileUrl: data && data.fileUrl,
          fileType: data && data.fileType,
        });
      } catch (err) {
        logger.warn(`[chat-rt] sendMessage xato: ${err.message}`);
        socket.emit("messageError", { error: err.message });
      }
    });

    socket.on("markAsRead", async (data) => {
      try {
        await chatService.markRead(socket.userId, data && data.senderId);
      } catch (err) {
        logger.warn(`[chat-rt] markAsRead xato: ${err.message}`);
      }
    });

    socket.on("disconnect", () => {
      unregister(socket.userId, socket);
      upstream.close();
      logger.info(`[bridge] uzildi: ${socket.userId}`);
    });
  });
}

module.exports = { initSocketBridge };
