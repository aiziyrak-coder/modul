"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

const {
  resolveCourse,
} = require("#references/_services/courseResolver");

const NUMBER_COLLECTIONS = [
  "residents",
  "residencyattestations",
  "residencylessons",
  "residencyproblemstudents",
];

const ANNOUNCEMENTS = "residencyannouncements";

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const ROLLBACK = args.includes("--rollback");

const log = (...a) => process.stdout.write(`${a.join(" ")}\n`);

async function showReference(db) {
  const rows = await db
    .collection("courses")
    .find({})
    .project({ title: 1 })
    .toArray();
  log(`Ma'lumotnoma: ${rows.length} ta kurs`);
  for (const r of rows) log(`  · ${r.title}`);
  log("");
  return rows.length;
}

async function migrate(db) {
  if (!(await showReference(db))) {
    log("⚠️  `courses` ma'lumotnomasi BO'SH — avval uni to'ldiring.");
    return;
  }

  const unmapped = new Map();
  let total = 0;

  for (const name of NUMBER_COLLECTIONS) {
    const coll = db.collection(name);
    const docs = await coll
      .find({ courseNumber: { $type: "number" } })
      .project({ courseNumber: 1 })
      .toArray();

    if (!docs.length) {
      log(`${name.padEnd(28)} — sonli kurs yo'q`);
      continue;
    }

    const ops = [];
    const per = new Map();
    for (const d of docs) {
      per.set(d.courseNumber, (per.get(d.courseNumber) || 0) + 1);
      const ref = await resolveCourse(d.courseNumber);
      if (ref) {
        ops.push({
          updateOne: { filter: { _id: d._id }, update: { $set: { courseRef: ref } } },
        });
      } else {
        unmapped.set(d.courseNumber, (unmapped.get(d.courseNumber) || 0) + 1);
      }
    }
    log(
      `${name.padEnd(28)} — ${docs.length} hujjat | mos: ${ops.length} | ${[...per]
        .map(([v, n]) => `${v}×${n}`)
        .join(", ")}`,
    );
    if (WRITE && ops.length) await coll.bulkWrite(ops, { ordered: false });
    total += ops.length;
  }

  const anns = await db
    .collection(ANNOUNCEMENTS)
    .find({ targetCourses: { $exists: true, $ne: [] } })
    .project({ title: 1, targetCourses: 1 })
    .toArray();

  let annOps = 0;
  for (const a of anns) {
    const refs = [];
    for (const n of a.targetCourses || []) {
      const ref = await resolveCourse(n);
      if (ref) refs.push(ref);
      else unmapped.set(n, (unmapped.get(n) || 0) + 1);
    }
    log(
      `${ANNOUNCEMENTS.padEnd(28)} — "${a.title}" ${JSON.stringify(a.targetCourses)} → ${refs.length} ta havola`,
    );
    if (refs.length) {
      if (WRITE) {
        await db
          .collection(ANNOUNCEMENTS)
          .updateOne({ _id: a._id }, { $set: { targetCoursesRef: refs } });
      }
      annOps += 1;
    }
  }
  total += annOps;

  log("");
  if (unmapped.size) {
    log("⚠️  MOS KELMAGAN kurs raqamlari:");
    for (const [v, n] of unmapped) log(`   ${v} — ${n} joyda`);
    log("   (`courses` ma'lumotnomasiga shu kurslarni qo'shing)");
  } else {
    log("✅ Mos kelmagan kurs YO'Q.");
  }

  log("");
  log(
    WRITE
      ? `Yozildi: ${total} ta hujjat bog'landi.`
      : `[DRY-RUN] hech narsa yozilmadi. ${total} ta hujjat bog'lanardi. Yozish uchun: --write`,
  );
}

async function rollback(db) {
  let total = 0;
  for (const name of NUMBER_COLLECTIONS) {
    const n = await db.collection(name).countDocuments({ courseRef: { $exists: true } });
    if (!n) continue;
    log(`${name.padEnd(28)} — ${n} ta hujjatdan \`courseRef\` olinadi`);
    if (WRITE) {
      const r = await db
        .collection(name)
        .updateMany({ courseRef: { $exists: true } }, { $unset: { courseRef: "" } });
      total += r.modifiedCount ?? 0;
    } else total += n;
  }
  const an = await db
    .collection(ANNOUNCEMENTS)
    .countDocuments({ targetCoursesRef: { $exists: true } });
  if (an) {
    log(`${ANNOUNCEMENTS.padEnd(28)} — ${an} ta e'londan \`targetCoursesRef\` olinadi`);
    if (WRITE) {
      const r = await db
        .collection(ANNOUNCEMENTS)
        .updateMany(
          { targetCoursesRef: { $exists: true } },
          { $unset: { targetCoursesRef: "" } },
        );
      total += r.modifiedCount ?? 0;
    } else total += an;
  }
  log("");
  log(
    WRITE
      ? `${total} ta hujjat tozalandi. Eski son maydonlar TEGILMAGAN.`
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
