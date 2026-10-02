const { ErrorHandler } = require("#shared/error");
const logger = require("#shared/logger");
const { callMain } = require("#shared/mainApi");
const { ChatMessage } = require("#shared/models/chatMessage");
const { deliver } = require("#shared/chatRealtime");

const oid = (v) => String(v);

async function usersByIds(ids) {
  if (!ids.length) return new Map();
  try {
    const data = await callMain("/qualification-listener-sync/users", {
      query: { ids: ids.join(",") },
    });
    return new Map((data.users || []).map((u) => [String(u._id), u]));
  } catch (err) {
    logger.warn(`[chat] suhbatdosh ma'lumotini olishda xato: ${err.message}`);
    return new Map();
  }
}

async function send(myId, { receiver, message, fileUrl, fileType }) {
  if (!receiver || !message) throw new ErrorHandler(400, "receiver va message kerak");
  const doc = await ChatMessage().create({
    sender: oid(myId),
    receiver: oid(receiver),
    message,
    fileUrl,
    fileType,
  });

  const payload = {
    ...doc.toObject(),
    sender: { _id: oid(myId) },
    receiver: { _id: oid(receiver) },
  };
  deliver(oid(receiver), "receiveMessage", payload).catch(() => {});
  deliver(oid(myId), "messageSent", payload).catch(() => {});

  return doc;
}

async function thread(myId, otherId, { page = 1, limit = 30 } = {}) {
  const me = oid(myId);
  const other = oid(otherId);

  const res = await ChatMessage().paginate(
    {
      $or: [
        { sender: me, receiver: other },
        { sender: other, receiver: me },
      ],
      isDeleted: false,
    },
    { page: Number(page), limit: Number(limit), sort: { createdAt: -1 }, lean: true },
  );

  await ChatMessage().updateMany(
    { sender: other, receiver: me, readAt: null },
    { $set: { readAt: new Date() } },
  );

  res.docs = (res.docs || []).map((d) => ({
    ...d,
    sender: { _id: d.sender },
    receiver: { _id: d.receiver },
  }));
  return res;
}

async function conversations(myId) {
  const me = oid(myId);

  const rows = await ChatMessage().aggregate([
    { $match: { $or: [{ sender: me }, { receiver: me }], isDeleted: false } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { $cond: [{ $eq: ["$sender", me] }, "$receiver", "$sender"] },
        lastMessage: { $first: "$$ROOT" },
        unreadCount: {
          $sum: {
            $cond: [{ $and: [{ $eq: ["$receiver", me] }, { $eq: ["$readAt", null] }] }, 1, 0],
          },
        },
      },
    },
    { $sort: { "lastMessage.createdAt": -1 } },
  ]);

  const byId = await usersByIds(rows.map((r) => String(r._id)));

  return rows.map((r) => {
    const c = byId.get(String(r._id)) || {};
    return {
      user: {
        _id: String(r._id),
        firstName: c.firstName ?? null,
        lastName: c.lastName ?? null,
        photo: c.photo ?? null,
        workingSchedule: c.workingSchedule ?? [],
        lastSeen: c.lastSeen ?? null,
        online: c.online === true,
      },
      lastMessage: {
        message: r.lastMessage.message,
        createdAt: r.lastMessage.createdAt,
        fileType: r.lastMessage.fileType,
        sender: r.lastMessage.sender,
        readAt: r.lastMessage.readAt ?? null,
      },
      unreadCount: r.unreadCount,
    };
  });
}

async function unreadCount(myId) {
  const count = await ChatMessage().countDocuments({
    receiver: oid(myId),
    readAt: null,
    isDeleted: false,
  });
  return { unreadCount: count };
}

async function remove(myId, id) {
  const doc = await ChatMessage().findOne({ _id: id, sender: oid(myId) });
  if (!doc) throw new ErrorHandler(404, "Topilmadi yoki ruxsat yo'q");
  doc.isDeleted = true;
  await doc.save();
  return { message: "Xabar o'chirildi" };
}

async function markRead(myId, senderId) {
  const res = await ChatMessage().updateMany(
    { sender: oid(senderId), receiver: oid(myId), readAt: null },
    { $set: { readAt: new Date() } },
  );
  if (res.modifiedCount) {
    deliver(oid(senderId), "messagesRead", { by: oid(myId) }).catch(() => {});
  }
  return { ok: true };
}

module.exports = { send, thread, conversations, unreadCount, remove, markRead };
