const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const toStr = (v) => {
  if (v == null) return v;
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    return v.uz || v.ru || v.eng || "";
  }
  return String(v);
};

const migrateCollection = async (collName, fields) => {
  const db = mongoose.connection.db;
  const coll = db.collection(collName);
  const total = await coll.countDocuments();
  let updated = 0;
  let skipped = 0;

  console.log(`\n→ ${collName} (${total} hujjat)`);

  const cursor = coll.find({});
  for await (const doc of cursor) {
    const $set = {};
    for (const field of fields) {
      const val = getNested(doc, field);
      if (val && typeof val === "object" && !Array.isArray(val)) {
        if ("uz" in val || "ru" in val || "eng" in val) {
          $set[field] = toStr(val);
        }
      }
    }
    if (Object.keys($set).length) {
      await coll.updateOne({ _id: doc._id }, { $set });
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`  ✓ Yangilandi: ${updated}, o'zgarmagan: ${skipped}`);
  return { updated, skipped };
};

const getNested = (obj, path) => {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
};

const COLLECTIONS = {
  faculties: ["title", "desc"],
  departments: ["title", "desc"],
  sciences: ["title", "desc"],
  directions: [
    "title",
    "desc",
    "level",
    "readingFormat",
    "educationForm",
    "specialization",
  ],
  courses: ["title", "desc"],
  groups: ["title", "desc"],
  rooms: ["title", "desc"],
  positions: ["title"],
  countries: ["title"],
  divisions: ["title", "desc"],
  academiclevels: ["title"],
  educationforms: ["title"],
  readingforms: ["title"],
  studyperiods: ["title"],
  specializations: ["title"],
  academicyears: ["title"],
  publicoffers: ["title", "desc"],
  languageofinstructions: ["title"],
  learningprocesses: ["learningProcess.title"],
};

const main = async () => {
  try {
    await mongoose.connect(process.env.MONGO_HOST);
    console.log("✓ MongoDB ulandi\n");
    console.log("=== Multi-lang → String migratsiyasi boshlandi ===");

    const summary = {};
    for (const [coll, fields] of Object.entries(COLLECTIONS)) {
      try {
        summary[coll] = await migrateCollection(coll, fields);
      } catch (err) {
        console.error(`  ✗ ${coll} xatolik:`, err.message);
        summary[coll] = { error: err.message };
      }
    }

    console.log("\n=== Yakuniy hisobot ===");
    let totalUpdated = 0;
    let totalSkipped = 0;
    for (const [coll, res] of Object.entries(summary)) {
      if (res.error) {
        console.log(`  ${coll}: ✗ ${res.error}`);
      } else {
        console.log(`  ${coll}: ${res.updated} yangilandi, ${res.skipped} o'zgarmagan`);
        totalUpdated += res.updated;
        totalSkipped += res.skipped;
      }
    }
    console.log(`\n  JAMI: ${totalUpdated} hujjat yangilandi`);
    console.log("\n=== Migratsiya yakunlandi ===");
    process.exit(0);
  } catch (err) {
    console.error("Migration xatosi:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

main();
