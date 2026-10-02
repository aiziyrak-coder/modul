"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

const {
  normalizeTitle,
} = require("#references/_services/academicYearResolver");

const COLLECTIONS = [
  "residents",
  "residencyannouncements",
  "residencycurriculums",
  "residencylessons",
  "residencynotices",
  "residencyproblemstudents",
  "residencyattestations",
  "residentapplications",
  "residencyactivityplans",
  "residencydissertationplans",
];

const SRC = "academicYear";
const DST = "academicYearRef";

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const ROLLBACK = args.includes("--rollback");

const log = (...a) => process.stdout.write(`${a.join(" ")}\n`);

async function buildYearIndex(db) {
  const rows = await db
    .collection("academicyears")
    .find({})
    .project({ title: 1, active: 1 })
    .toArray();

  const byTitle = new Map();
  for (const r of rows) {
    const key = normalizeTitle(r.title);
    if (key) byTitle.set(key, r);
  }
  log(`Ma'lumotnoma: ${rows.length} ta o'quv yili`);
  for (const r of rows) {
    log(
      `  · ${r.title}  →  normal "${normalizeTitle(r.title)}"${r.active === false ? "  (nofaol)" : ""}`,
    );
  }
  if (rows.length !== byTitle.size) {
    log(
      `  ⚠️  ${rows.length - byTitle.size} ta qator normallashtirib bo'lmadi — ular moslashuvda qatnashmaydi`,
    );
  }
  return byTitle;
}

async function migrate(db) {
  const byTitle = await buildYearIndex(db);
  log("");

  let totalMapped = 0;
  const unmapped = new Map();

  for (const name of COLLECTIONS) {
    const coll = db.collection(name);
    const docs = await coll
      .find({ [SRC]: { $type: "string", $ne: "" } })
      .project({ [SRC]: 1 })
      .toArray();

    if (!docs.length) {
      log(`${name.padEnd(28)} — satr qiymatli hujjat yo'q`);
      continue;
    }

    const ops = [];
    const perValue = new Map();
    for (const d of docs) {
      const raw = d[SRC];
      const key = normalizeTitle(raw);
      const hit = key ? byTitle.get(key) : null;
      perValue.set(raw, (perValue.get(raw) || 0) + 1);
      if (hit) {
        ops.push({
          updateOne: { filter: { _id: d._id }, update: { $set: { [DST]: hit._id } } },
        });
      } else {
        unmapped.set(raw, (unmapped.get(raw) || 0) + 1);
      }
    }

    const detail = [...perValue.entries()]
      .map(([v, n]) => `${v}×${n}`)
      .join(", ");
    log(
      `${name.padEnd(28)} — ${docs.length} hujjat | mos: ${ops.length} | ${detail}`,
    );

    if (WRITE && ops.length) {
      const res = await coll.bulkWrite(ops, { ordered: false });
      totalMapped += res.modifiedCount ?? 0;
    } else {
      totalMapped += ops.length;
    }
  }

  log("");
  if (unmapped.size) {
    log("⚠️  MOS KELMAGAN qiymatlar — bular bog'lanmaydi:");
    for (const [v, n] of unmapped) log(`   "${v}" — ${n} ta hujjat`);
    log("   (ma'lumotnomaga shu yillarni qo'shing yoki qiymatni tuzating)");
  } else {
    log("✅ Mos kelmagan qiymat YO'Q — barcha satrlar ma'lumotnomaga tushadi.");
  }

  log("");
  log(
    WRITE
      ? `Yozildi: ${totalMapped} ta hujjatga \`${DST}\` qo'yildi.`
      : `[DRY-RUN] hech narsa yozilmadi. ${totalMapped} ta hujjat bog'lanardi. Yozish uchun: --write`,
  );
}

async function rollback(db) {
  let total = 0;
  for (const name of COLLECTIONS) {
    const coll = db.collection(name);
    const n = await coll.countDocuments({ [DST]: { $exists: true } });
    if (!n) continue;
    log(`${name.padEnd(28)} — ${n} ta hujjatdan \`${DST}\` olinadi`);
    if (WRITE) {
      const res = await coll.updateMany(
        { [DST]: { $exists: true } },
        { $unset: { [DST]: "" } },
      );
      total += res.modifiedCount ?? 0;
    } else {
      total += n;
    }
  }
  log("");
  log(
    WRITE
      ? `${total} ta hujjatdan \`${DST}\` olib tashlandi. Eski \`${SRC}\` satri TEGILMAGAN.`
      : `[DRY-RUN] ${total} ta hujjat tozalanardi. Bajarish uchun: --rollback --write`,
  );
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
