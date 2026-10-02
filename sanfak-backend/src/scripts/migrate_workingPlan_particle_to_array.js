const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({
  path: path.resolve(__dirname, "..", "..", ".env"),
});

const PARTICLE_ORDER = [
  { slug: "soat",        title: "Soat" },
  { slug: "foiz",        title: "Foiz" },
  { slug: "jami",        title: "Jami" },
  { slug: "maruza",      title: "Ma'ruza" },
  { slug: "amaliy",      title: "Amaliy" },
  { slug: "laboratoriya", title: "Laboratoriya" },
  { slug: "seminar",     title: "Seminar" },
  { slug: "kurs_ishi",   title: "Kurs ishi" },
  { slug: "mustaqil",    title: "Mustaqil ta'lim" },
];

const KEY_TO_SLUG = {
  hour:        "soat",
  percent:     "foiz",
  total:       "jami",
  lecture:     "maruza",
  practical:   "amaliy",
  laboratory:  "laboratoriya",
  seminar:     "seminar",
  courseWork:  "kurs_ishi",
  independent: "mustaqil",
};

const isOldObjectFormat = (p) => {
  if (!p) return false;
  if (Array.isArray(p)) return false;
  return typeof p === "object";
};

const convertToArray = (oldObj) => {
  const result = [];
  for (const { slug, title } of PARTICLE_ORDER) {
    const oldKey = Object.keys(KEY_TO_SLUG).find((k) => KEY_TO_SLUG[k] === slug);
    const value = Number(oldObj?.[oldKey] ?? 0) || 0;
    result.push({ slug, title, value });
  }
  return result;
};

async function run() {
  const DRY_RUN = !!process.env.DRY_RUN;
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("[migrate] MONGODB_URI yoki MONGO_URI .env da topilmadi.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`[migrate] Bazaga ulandi${DRY_RUN ? " (DRY RUN)" : ""}.`);

  const coll = mongoose.connection.db.collection("workingplans");

  const total = await coll.countDocuments({});
  console.log(`[migrate] Jami workingPlan hujjatlari: ${total}`);

  let blocksTouched = 0;
  let sciencesTouched = 0;
  let docsUpdated = 0;

  const cursor = coll.find({});
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    let changed = false;

    if (Array.isArray(doc.blocks)) {
      for (const block of doc.blocks) {
        if (isOldObjectFormat(block.particle)) {
          block.particle = convertToArray(block.particle);
          blocksTouched += 1;
          changed = true;
        }
        if (Array.isArray(block.sciences)) {
          for (const sc of block.sciences) {
            if (isOldObjectFormat(sc.particle)) {
              sc.particle = convertToArray(sc.particle);
              sciencesTouched += 1;
              changed = true;
            }
          }
        }
      }
    }

    if (changed) {
      docsUpdated += 1;
      if (!DRY_RUN) {
        await coll.updateOne(
          { _id: doc._id },
          { $set: { blocks: doc.blocks } },
        );
      }
      console.log(
        `[migrate] ${DRY_RUN ? "[DRY] " : ""}doc ${doc._id} — blocks/sciences o'zgartirildi`,
      );
    }
  }

  console.log("------------------------------------------------------------");
  console.log(`[migrate] Yakun: ${docsUpdated}/${total} hujjat yangilandi`);
  console.log(`[migrate]       blocks.particle   → Array: ${blocksTouched}`);
  console.log(`[migrate]       sciences.particle → Array: ${sciencesTouched}`);
  if (DRY_RUN) {
    console.log("[migrate] DRY_RUN=1 — hech narsa yozilmadi.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[migrate] XATO:", err);
  process.exit(1);
});
