"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

const ANNOUNCEMENTS = "residencyannouncements";
const READS = "residencyannouncementreads";

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const ROLLBACK = args.includes("--rollback");

const log = (...a) => process.stdout.write(`${a.join(" ")}\n`);

async function ensureIndexes(db) {
  await db.collection(READS).createIndex(
    { announcement: 1, user: 1 },
    { unique: true, name: "announcement_1_user_1" },
  );
  await db.collection(READS).createIndex(
    { user: 1, announcement: 1 },
    { name: "user_1_announcement_1" },
  );
  log("Indekslar tayyor: {announcement,user} UNIQUE · {user,announcement}");
}

async function migrate(db) {
  const anns = await db
    .collection(ANNOUNCEMENTS)
    .find({ readBy: { $exists: true, $ne: [] } })
    .project({ readBy: 1 })
    .toArray();

  const rows = anns.flatMap((a) =>
    (a.readBy || [])
      .filter((r) => r.user)
      .map((r) => ({
        announcement: a._id,
        user: r.user,
        readAt: r.readAt || new Date(),
      })),
  );

  log(`Manba e'lonlar : ${anns.length}`);
  log(`Ko'chiriladigan: ${rows.length} ta o'qilganlik yozuvi`);

  if (!WRITE) {
    log("\n[DRY-RUN] hech narsa yozilmadi. Ko'chirish uchun: --write");
    return;
  }
  await ensureIndexes(db);

  if (!rows.length) {
    log("Ko'chiradigan yozuv yo'q (indekslar baribir tekshirildi).");
    return;
  }

  try {
    await db.collection(READS).insertMany(rows, { ordered: false });
  } catch (err) {
    const dup = err.writeErrors?.filter((e) => e.err?.code === 11000).length ?? 0;
    if (dup !== (err.writeErrors?.length ?? 0)) throw err;
    log(`(${dup} ta yozuv allaqachon mavjud edi — o'tkazib yuborildi)`);
  }

  const res = await db
    .collection(ANNOUNCEMENTS)
    .updateMany({ readBy: { $exists: true } }, { $unset: { readBy: "" } });
  log(`Kiritildi va ${res.modifiedCount} ta e'londan \`readBy\` olib tashlandi.`);
}

async function rollback(db) {
  const reads = await db.collection(READS).find({}).toArray();
  log(`Qaytariladigan: ${reads.length} ta yozuv`);

  if (!WRITE) {
    log("\n[DRY-RUN] hech narsa yozilmadi. Qaytarish uchun: --rollback --write");
    return;
  }
  if (!reads.length) return;

  const byAnnouncement = new Map();
  for (const r of reads) {
    const key = String(r.announcement);
    if (!byAnnouncement.has(key)) byAnnouncement.set(key, []);
    byAnnouncement.get(key).push({ user: r.user, readAt: r.readAt });
  }

  let n = 0;
  for (const [id, readBy] of byAnnouncement) {
    const res = await db
      .collection(ANNOUNCEMENTS)
      .updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { readBy } });
    n += res.modifiedCount;
  }
  log(`${n} ta e'longa \`readBy\` qaytarildi.`);
  log("Yozuvlar kolleksiyada QOLDI — o'chirish qo'lda (ataylab, xavfsizlik uchun).");
  log("Indekslar ham qoldirildi (kolleksiya bilan birga o'chiriladi).");
}

(async () => {
  if (!process.env.MONGO_HOST) {
    log("MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;
  log(`DB: ${mongoose.connection.name}`);
  log(`Rejim: ${ROLLBACK ? "ROLLBACK" : "MIGRATE"} ${WRITE ? "--write" : "(dry-run)"}\n`);

  try {
    if (ROLLBACK) await rollback(db);
    else await migrate(db);
  } finally {
    await mongoose.disconnect();
  }
})();
