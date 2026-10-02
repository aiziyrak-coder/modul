const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({
  path: path.resolve(__dirname, "..", "..", ".env"),
});

const CLASS_TYPE_MAP = [
  { legacy: "lecture",           slug: "maruza",          title: "Ma'ruza" },
  { legacy: "clinicalPractice",  slug: "klinik_amaliyot", title: "Klinik o'quv amaliyoti" },
  { legacy: "labTraining",       slug: "laboratoriya",    title: "Laboratoriya mashg'uloti" },
  { legacy: "practicalExercise", slug: "amaliy",          title: "Amaliy mashg'ulot" },
];

const ITEM_MAP = [
  { legacy: "student",          slug: "on",         title: "ON (1 tal. 0.2 soat)" },
  { legacy: "yan",              slug: "yan",        title: "YAN (1 tal. 0.3 soat)" },
  { legacy: "missedLesson",     slug: "qoldirilgan",title: "Qoldirilgan dars / Qayta topshirish" },
  { legacy: "skilledPractical", slug: "malakaviy",  title: "Malakaviy amaliyotga rahbarlik" },
];

const OTHER_MAP = [
  { legacy: "special",                slug: "yada_umumiy",    title: "YADA umumiy ma'ruza" },
  { legacy: "participation",          slug: "yada_qatnashish",title: "YADA qatnashish" },
  { legacy: "reception",              slug: "qabul",          title: "Qabul (ijodiy imtihon)" },
  { legacy: "consulting",             slug: "maslahatchilik", title: "MI ilmiy maslahatchilik" },
  { legacy: "openLecture.department", slug: "ochiq_kafedra",  title: "Ochiq leksiya (kafedrada)" },
  { legacy: "openLecture.integral",   slug: "ochiq_integral", title: "Ochiq leksiya (integral)" },
];

function alreadyMigrated(sw) {
  return (
    sw && (Array.isArray(sw.classTypes) && sw.classTypes.length > 0)
  );
}

function migrateStudyWork(sw) {
  if (!sw || typeof sw !== "object") return sw;
  if (alreadyMigrated(sw)) return sw;

  const classTypes = [];
  for (const { legacy, slug, title } of CLASS_TYPE_MAP) {
    const legacyVal = sw[legacy];
    if (legacyVal && typeof legacyVal === "object") {
      classTypes.push({
        slug,
        title,
        stream: Number(legacyVal.stream) || 0,
        total:  Number(legacyVal.total) || 0,
      });
      delete sw[legacy];
    }
  }

  const items = [];
  for (const { legacy, slug, title } of ITEM_MAP) {
    if (Object.prototype.hasOwnProperty.call(sw, legacy)) {
      items.push({ slug, title, value: Number(sw[legacy]) || 0 });
      delete sw[legacy];
    }
  }

  sw.classTypes = classTypes;
  sw.items = items;
  return sw;
}

function migrateOtherWork(ow) {
  if (!ow || typeof ow !== "object") return ow;
  if (Array.isArray(ow.items) && ow.items.length > 0) return ow;

  const items = [];
  for (const { legacy, slug, title } of OTHER_MAP) {
    const parts = legacy.split(".");
    if (parts.length === 1) {
      if (Object.prototype.hasOwnProperty.call(ow, parts[0])) {
        items.push({ slug, title, value: Number(ow[parts[0]]) || 0 });
        delete ow[parts[0]];
      }
    } else {
      const [a, b] = parts;
      if (ow[a] && typeof ow[a] === "object" && b in ow[a]) {
        items.push({ slug, title, value: Number(ow[a][b]) || 0 });
      }
    }
  }
  if (ow.openLecture) delete ow.openLecture;
  ow.items = items;
  return ow;
}

async function run() {
  const DRY_RUN = !!process.env.DRY_RUN;
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("[migrate] MONGODB_URI yoki MONGO_URI .env da topilmadi.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`[migrate] Bazaga ulandi${DRY_RUN ? " (DRY RUN)" : ""}.`);

  const workloadColl = mongoose.connection.db.collection("workloads");
  const distColl     = mongoose.connection.db.collection("workloaddistributions");

  {
    const total = await workloadColl.countDocuments({});
    console.log(`[migrate] workloads jami: ${total}`);
    let updated = 0, blocks = 0;

    const cursor = workloadColl.find({});
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      let changed = false;

      for (const dir of (doc.directions || [])) {
        for (const b of (dir.blocks || [])) {
          if (b.studyWork) {
            const beforeSw = JSON.stringify(b.studyWork);
            migrateStudyWork(b.studyWork);
            if (JSON.stringify(b.studyWork) !== beforeSw) { blocks++; changed = true; }
          }
          if (b.otherWork) {
            const beforeOw = JSON.stringify(b.otherWork);
            migrateOtherWork(b.otherWork);
            if (JSON.stringify(b.otherWork) !== beforeOw) { changed = true; }
          }
        }
      }

      if (changed) {
        updated++;
        if (!DRY_RUN) {
          await workloadColl.updateOne(
            { _id: doc._id },
            { $set: { directions: doc.directions } },
          );
        }
        console.log(`[migrate] workload ${doc._id} ${DRY_RUN ? "[DRY]" : ""} yangilandi`);
      }
    }
    console.log(`[migrate] workloads: ${updated}/${total} hujjat, ${blocks} block migratsiya qilindi`);
  }

  {
    const total = await distColl.countDocuments({});
    console.log(`[migrate] workloaddistributions jami: ${total}`);
    let updated = 0, blocks = 0;

    const cursor = distColl.find({});
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      let changed = false;

      for (const t of (doc.teachers || [])) {
        for (const b of (t.blocks || [])) {
          if (b.studyWork) {
            const beforeSw = JSON.stringify(b.studyWork);
            migrateStudyWork(b.studyWork);
            if (JSON.stringify(b.studyWork) !== beforeSw) { blocks++; changed = true; }
          }
        }
      }

      if (changed) {
        updated++;
        if (!DRY_RUN) {
          await distColl.updateOne(
            { _id: doc._id },
            { $set: { teachers: doc.teachers } },
          );
        }
        console.log(`[migrate] distribution ${doc._id} ${DRY_RUN ? "[DRY]" : ""} yangilandi`);
      }
    }
    console.log(`[migrate] distributions: ${updated}/${total} hujjat, ${blocks} block migratsiya qilindi`);
  }

  console.log("------------------------------------------------------------");
  if (DRY_RUN) console.log("[migrate] DRY_RUN=1 — hech narsa yozilmadi.");
  else        console.log("[migrate] Migratsiya muvaffaqiyatli yakunlandi.");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[migrate] XATO:", err);
  process.exit(1);
});
