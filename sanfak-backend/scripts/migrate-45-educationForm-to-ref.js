"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

const COLLECTION = "residencycurriculums";
const SRC = "educationForm";
const DST = "educationFormRef";

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const ROLLBACK = args.includes("--rollback");
const log = (...a) => process.stdout.write(`${a.join(" ")}\n`);
const key = (s) => String(s).trim().toLowerCase();

async function migrate(db) {
  const rows = await db
    .collection("educationforms")
    .find({})
    .project({ title: 1 })
    .toArray();
  log(`Ma'lumotnoma: ${rows.length} ta shakl — ${rows.map((r) => r.title).join(", ")}`);

  const byTitle = new Map(rows.map((r) => [key(r.title), r._id]));
  if (rows.length !== byTitle.size) {
    log("  ⚠️  Registrga befarq DUBLIKAT bor — avval ma'lumotnomani tozalang.");
  }
  log("");

  const docs = await db
    .collection(COLLECTION)
    .find({ [SRC]: { $type: "string", $ne: "" } })
    .project({ [SRC]: 1 })
    .toArray();

  const ops = [];
  const per = new Map();
  const unmapped = new Map();
  for (const d of docs) {
    per.set(d[SRC], (per.get(d[SRC]) || 0) + 1);
    const ref = byTitle.get(key(d[SRC]));
    if (ref) {
      ops.push({ updateOne: { filter: { _id: d._id }, update: { $set: { [DST]: ref } } } });
    } else {
      unmapped.set(d[SRC], (unmapped.get(d[SRC]) || 0) + 1);
    }
  }
  log(
    `${COLLECTION} — ${docs.length} hujjat | mos: ${ops.length} | ${[...per]
      .map(([v, n]) => `${v}×${n}`)
      .join(", ") || "—"}`,
  );

  if (WRITE && ops.length) await db.collection(COLLECTION).bulkWrite(ops, { ordered: false });

  log("");
  if (unmapped.size) {
    log("⚠️  MOS KELMAGAN qiymatlar:");
    for (const [v, n] of unmapped) log(`   "${v}" — ${n} ta`);
  } else {
    log("✅ Mos kelmagan qiymat YO'Q.");
  }
  log("");
  log(
    WRITE
      ? `Yozildi: ${ops.length} ta hujjatga \`${DST}\` qo'yildi.`
      : `[DRY-RUN] ${ops.length} ta hujjat bog'lanardi. Yozish uchun: --write`,
  );
}

async function rollback(db) {
  const n = await db.collection(COLLECTION).countDocuments({ [DST]: { $exists: true } });
  log(`${COLLECTION} — ${n} ta hujjatdan \`${DST}\` olinadi`);
  if (WRITE && n) {
    const r = await db
      .collection(COLLECTION)
      .updateMany({ [DST]: { $exists: true } }, { $unset: { [DST]: "" } });
    log(`${r.modifiedCount} ta tozalandi. Eski \`${SRC}\` TEGILMAGAN.`);
  } else if (!WRITE) {
    log(`[DRY-RUN] bajarish uchun: --rollback --write`);
  }
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
