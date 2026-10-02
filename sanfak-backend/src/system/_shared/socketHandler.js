const jwt = require("jsonwebtoken");
const ChatMessage = require("#system/chat/chatMessage.model");
const User = require("#modules/4.01-auth/user/user.model");
const winston = require("#shared/winston.logger");
const { pub } = require("./redisClient");

let _listenerLastSeenSink = null;

const registerListenerLastSeenSink = (fn) => {
  _listenerLastSeenSink = typeof fn === "function" ? fn : null;
};

let _ioRef = null;
const getIo = () => _ioRef;

const redisReady = () => pub && pub.status === "ready";

const ADAPTER_FETCH_TIMEOUT_MS = 3000;

let fetchTimeoutWarned = false;
pub.on("ready", () => {
  fetchTimeoutWarned = false;
});

const localFetchSockets = (operator) => (operator.local || operator).fetchSockets();

const fetchSocketsSafe = async (operator) => {
  if (!redisReady()) return localFetchSockets(operator);

  let timer;
  try {
    const result = await Promise.race([
      operator.fetchSockets(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Redis adapter fetchSockets timeout")),
          ADAPTER_FETCH_TIMEOUT_MS,
        );
        timer.unref?.();
      }),
    ]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    if (!fetchTimeoutWarned) {
      fetchTimeoutWarned = true;
      winston.warn(
        `[Socket] Redis adapter fetchSockets javob bermadi — lokal natijaga tushildi: ${err.message}`,
      );
    }
    return localFetchSockets(operator);
  }
};

const ownerOf = (sock) =>
  (sock && sock.data && sock.data.userId) || (sock && sock.userId) || null;

const onlineIdSet = async () => {
  if (!_ioRef) return new Set();
  const sockets = await fetchSocketsSafe(_ioRef);
  const ids = new Set();
  for (const sock of sockets) {
    const owner = ownerOf(sock);
    if (owner) ids.add(String(owner));
  }
  return ids;
};

const isOnline = async (userId) => {
  if (!_ioRef) return false;
  const sockets = await fetchSocketsSafe(_ioRef.in(String(userId)));
  return sockets.length > 0;
};

const isOnlineBatch = async (userIds) => {
  const ids = [...new Set(userIds.map(String))];
  if (!ids.length) return new Map();
  const online = await onlineIdSet();
  return new Map(ids.map((id) => [id, online.has(id)]));
};

const listOnlineUserIds = async () => [...(await onlineIdSet())];

const disconnectUser = async (userId) => {
  if (!_ioRef) return;
  const room = String(userId);

  if (!redisReady()) {
    _ioRef.local.in(room).disconnectSockets(true);
    return;
  }

  let timer;
  try {
    await Promise.race([
      _ioRef.in(room).disconnectSockets(true),
      new Promise((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Redis adapter disconnectSockets timeout")),
          ADAPTER_FETCH_TIMEOUT_MS,
        );
        timer.unref?.();
      }),
    ]);
    clearTimeout(timer);
  } catch (err) {
    clearTimeout(timer);
    winston.warn(
      `[Socket] disconnectUser adapter javob bermadi — lokal so'rovga tushildi: ${err.message}`,
    );
    _ioRef.local.in(room).disconnectSockets(true);
  }
};

const emitToUser = async (userId, event, payload) => {
  if (!_ioRef) return false;
  const room = String(userId);
  const sockets = await fetchSocketsSafe(_ioRef.in(room));
  if (!sockets.length) return false;
  _ioRef.to(room).emit(event, payload);
  return true;
};

const LISTENER_ROLE_TITLE = "malaka_tinglovchi";

const authenticateService = async (socket, next, { serviceKey, actAs, actAsListener }) => {
  if (!process.env.SERVICE_KEY || serviceKey !== process.env.SERVICE_KEY) {
    return next(new Error("Service kaliti yaroqsiz"));
  }

  if (actAsListener) {
    socket.userId = String(actAsListener);
    socket.data.isListener = true;
    return next();
  }

  if (!actAs) return next(new Error("actAs yuborilmadi"));

  const user = await User.findById(actAs)
    .select("active role")
    .populate("role", "title")
    .lean();
  if (!user || user.active === false) return next(new Error("Foydalanuvchi topilmadi"));
  if (!user.role || user.role.title !== LISTENER_ROLE_TITLE) {
    return next(new Error("Service faqat tinglovchi nomidan ulanadi"));
  }

  socket.userId = String(actAs);
  return next();
};

const initSocket = (io) => {
  _ioRef = io;
  io.use((socket, next) => {
    (async () => {
      try {
        const { serviceKey, actAs, actAsListener } = socket.handshake.auth || {};
        if (serviceKey) {
          return await authenticateService(socket, next, { serviceKey, actAs, actAsListener });
        }

        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.split(" ")[1];

        if (!token) return next(new Error("Token topilmadi"));

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const uid = decoded._id || decoded.id;

        const dbUser = await User.findById(uid).select("tokenVersion active").lean();
        if (!dbUser) return next(new Error("Foydalanuvchi topilmadi"));
        if (dbUser.active === false) return next(new Error("Foydalanuvchi bloklangan"));
        if ((decoded.tv ?? 0) !== (dbUser.tokenVersion ?? 0)) {
          return next(new Error("Sessiya bekor qilingan, qayta kiring"));
        }

        socket.userId = uid;
        return next();
      } catch (err) {
        return next(new Error("Token noto'g'ri"));
      }
    })();
  });

  const touchLastSeen = async (socket, userId) => {
    if (socket.data && socket.data.isListener) {
      if (_listenerLastSeenSink) await _listenerLastSeenSink(userId, new Date());
      return;
    }
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
  };

  io.on("connection", (socket) => {
    const userId = socket.userId;
    if (!userId) return;
    const room = userId.toString();

    socket.join(room);
    socket.data.userId = room;

    (async () => {
      try {
        io.emit("onlineUsers", await listOnlineUserIds());
      } catch (err) {
        winston.error(`[Socket] onlayn holat yozishda xato: ${err.message}`);
      }
    })();
    winston.info(`[Socket] Ulandi: ${userId}`);

    touchLastSeen(socket, userId).catch((err) =>
      winston.error(`[Socket] connect lastSeen xato: ${err.message}`),
    );

    socket.on("sendMessage", async (data) => {
      try {
        const { receiverId, message, fileUrl, fileType } = data;
        if (!receiverId || !message) return;

        const chatMsg = await new ChatMessage({
          sender: userId,
          receiver: receiverId,
          message,
          fileUrl,
          fileType,
        }).save();

        const populated = await chatMsg.populate([
          { path: "sender", select: "firstName lastName photo" },
          { path: "receiver", select: "firstName lastName photo" },
        ]);

        io.to(receiverId.toString()).emit("receiveMessage", populated);

        socket.emit("messageSent", populated);
      } catch (err) {
        winston.error(`[Socket] sendMessage xato: ${err.message}`);
        socket.emit("messageError", { error: err.message });
      }
    });

    socket.on("markAsRead", async (data) => {
      try {
        const { senderId } = data;
        await ChatMessage.updateMany(
          { sender: senderId, receiver: userId, readAt: null },
          { readAt: new Date() },
        );

        if (senderId) io.to(senderId.toString()).emit("messagesRead", { by: userId });
      } catch (err) {
        winston.error(`[Socket] markAsRead xato: ${err.message}`);
      }
    });

    socket.on("typing", (data) => {
      const { receiverId } = data;
      if (receiverId) io.to(receiverId.toString()).emit("typing", { from: userId });
    });

    socket.on("stopTyping", (data) => {
      const { receiverId } = data;
      if (receiverId) io.to(receiverId.toString()).emit("stopTyping", { from: userId });
    });

    socket.on("getOnlineUsers", async () => {
      try {
        socket.emit("onlineUsers", await listOnlineUserIds());
      } catch (err) {
        winston.error(`[Socket] getOnlineUsers xato: ${err.message}`);
      }
    });

    socket.on("heartbeat", async () => {
      try {
        await touchLastSeen(socket, userId);
      } catch (err) {
        winston.error(`[Socket] heartbeat lastSeen xato: ${err.message}`);
      }
    });

    socket.on("disconnect", async () => {
      try {
        io.emit("onlineUsers", await listOnlineUserIds());
      } catch (err) {
        winston.error(`[Socket] onlayn holat broadcast xatosi: ${err.message}`);
      }
      try {
        await touchLastSeen(socket, userId);
      } catch (err) {
        winston.error(`[Socket] lastSeen yozishda xato: ${err.message}`);
      }
      winston.info(`[Socket] Uzildi: ${userId}`);
    });
  });
};

module.exports = {
  initSocket,
  getIo,
  emitToUser,
  disconnectUser,
  isOnline,
  isOnlineBatch,
  listOnlineUserIds,
  registerListenerLastSeenSink,
};
