"use strict";

require("dotenv").config();
const mongoose = require("mongoose");

const MAIN_URI = process.env.MAIN_MONGO_HOST;
const LISTENER_URI = process.env.MONGO_HOST;
const LISTENER_DB = process.env.LISTENER_DB || "listener-db";

async function main() {
  if (!MAIN_URI) {
    throw new Error(
      "MAIN_MONGO_HOST kerak — asosiy baza manzili (masalan mongodb://127.0.0.1:27017/institute-test)",
    );
  }
  if (!LISTENER_URI) throw new Error("MONGO_HOST (.env) sozlanmagan");

  const mainConn = await mongoose.createConnection(MAIN_URI).asPromise();
  const lisConn = await mongoose.createConnection(LISTENER_URI).asPromise();
  const lisDb = lisConn.useDb(LISTENER_DB, { useCache: true });

  const listeners = await lisDb
    .collection("listeners")
    .find({ userId: { $ne: null } })
    .project({ userId: 1, fullName: 1 })
    .toArray();
  const ids = listeners.map((l) => String(l.userId));
  console.log(`Tinglovchilar: ${ids.length} ta`);
  if (!ids.length) {
    console.log("Ko'chiriladigan tinglovchi yo'q — to'xtatildi.");
    await Promise.all([mainConn.close(), lisConn.close()]);
    return;
  }

  const objIds = ids.map((s) => new mongoose.Types.ObjectId(s));
  const msgs = await mainConn
    .collection("chatmessages")
    .find({ $or: [{ sender: { $in: objIds } }, { receiver: { $in: objIds } }] })
    .toArray();
  console.log(`Asosiy bazadagi tinglovchi xabarlari: ${msgs.length} ta`);
  if (!msgs.length) {
    await Promise.all([mainConn.close(), lisConn.close()]);
    return;
  }

  const ops = msgs.map((m) => ({
    replaceOne: {
      filter: { _id: m._id },
      replacement: {
        _id: m._id,
        sender: String(m.sender),
        receiver: String(m.receiver),
        message: m.message,
        fileUrl: m.fileUrl,
        fileType: m.fileType,
        readAt: m.readAt ?? null,
        isDeleted: m.isDeleted === true,
        active: m.active !== false,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      },
      upsert: true,
    },
  }));
  const res = await lisDb.collection("chatmessages").bulkWrite(ops);
  console.log(
    `Ko'chirildi → yangi: ${res.upsertedCount || 0}, yangilangan: ${res.modifiedCount || 0}`,
  );

  const total = await lisDb.collection("chatmessages").countDocuments();
  console.log(`listener-db.chatmessages jami: ${total} ta`);

  await Promise.all([mainConn.close(), lisConn.close()]);
}

main().catch((err) => {
  console.error("[CHAT MIGRATSIYA XATO]", err.message);
  process.exit(1);
});
