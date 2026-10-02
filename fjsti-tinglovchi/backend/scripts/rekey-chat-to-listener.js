"use strict";

require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  const conn = await mongoose.createConnection(process.env.MONGO_HOST).asPromise();
  const db = conn.useDb(process.env.LISTENER_DB || "listener-db", { useCache: true }).db;

  const listeners = await db
    .collection("listeners")
    .find({ userId: { $ne: null }, listenerId: { $ne: null } })
    .project({ userId: 1, listenerId: 1, fullName: 1 })
    .toArray();
  if (!listeners.length) {
    console.log("Moslik yo'q (listeners bo'sh) — to'xtatildi.");
    await conn.close();
    return;
  }
  const map = new Map(listeners.map((l) => [String(l.userId), String(l.listenerId)]));
  console.log(`Moslik: ${map.size} ta tinglovchi (userId → listenerId)`);

  const col = db.collection("chatmessages");
  const total = await col.countDocuments();

  const names = (await db.listCollections().toArray()).map((c) => c.name);
  if (!names.includes("chatmessages_backup")) {
    const all = await col.find({}).toArray();
    if (all.length) await db.collection("chatmessages_backup").insertMany(all);
    console.log(`Zaxira olindi: chatmessages_backup (${all.length} ta)`);
  } else {
    console.log("Zaxira allaqachon mavjud — qayta olinmadi");
  }

  let changed = 0;
  for (const [userId, listenerId] of map) {
    const r1 = await col.updateMany({ sender: userId }, { $set: { sender: listenerId } });
    const r2 = await col.updateMany({ receiver: userId }, { $set: { receiver: listenerId } });
    changed += (r1.modifiedCount || 0) + (r2.modifiedCount || 0);
  }

  console.log(`Jami xabar: ${total}, o'zgartirilgan maydon: ${changed}`);
  const qoldi = await col.countDocuments({
    $or: [{ sender: { $in: [...map.keys()] } }, { receiver: { $in: [...map.keys()] } }],
  });
  console.log(`Eski userId qolgan xabarlar: ${qoldi} ${qoldi === 0 ? "✓" : "← tekshiring"}`);

  await conn.close();
}

main().catch((err) => {
  console.error("[REKEY XATO]", err.message);
  process.exit(1);
});
