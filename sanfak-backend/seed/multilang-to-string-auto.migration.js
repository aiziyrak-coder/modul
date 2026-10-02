const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const fs = require("fs");
const mongoose = require("mongoose");

const LANG_KEYS = new Set(["uz", "ru", "eng", "en"]);

const isMultiLangObject = (v) => {
  if (!v || typeof v !== "object") return false;
  if (Array.isArray(v)) return false;
  if (v instanceof Date) return false;
  if (v._bsontype === "ObjectID" || v._bsontype === "ObjectId") return false;
  const keys = Object.keys(v);
  if (keys.length === 0 || keys.length > 4) return false;
  return keys.every((k) => LANG_KEYS.has(k));
};

const toStr = (v) => {
  if (v && typeof v === "object") {
    return v.uz || v.ru || v.eng || v.en || "";
  }
  return v;
};

const collectMultiLangPaths = (obj, currentPath = "") => {
  const updates = {};
  if (!obj || typeof obj !== "object") return updates;

  for (const [k, v] of Object.entries(obj)) {
    if (k === "_id" || k === "__v") continue;
    const fieldPath = currentPath ? `${currentPath}.${k}` : k;

    if (isMultiLangObject(v)) {
      updates[fieldPath] = toStr(v);
    } else if (Array.isArray(v)) {
      v.forEach((item, idx) => {
        if (isMultiLangObject(item)) {
          updates[`${fieldPath}.${idx}`] = toStr(item);
        } else if (item && typeof item === "object") {
          Object.assign(
            updates,
            collectMultiLangPaths(item, `${fieldPath}.${idx}`),
          );
        }
      });
    } else if (v && typeof v === "object" && !(v instanceof Date)) {
      Object.assign(updates, collectMultiLangPaths(v, fieldPath));
    }
  }
  return updates;
};

const migrateCollection = async (collName) => {
  const db = mongoose.connection.db;
  const coll = db.collection(collName);
  const total = await coll.countDocuments();
  if (total === 0) return { collName, total: 0, updated: 0, fields: [] };

  let updated = 0;
  const fieldsTouched = new Set();

  const cursor = coll.find({});
  for await (const doc of cursor) {
    const $set = collectMultiLangPaths(doc);
    if (Object.keys($set).length) {
      Object.keys($set).forEach((f) => fieldsTouched.add(f.replace(/\.\d+/g, "[]")));
      await coll.updateOne({ _id: doc._id }, { $set });
      updated++;
    }
  }

  return { collName, total, updated, fields: [...fieldsTouched] };
};

const main = async () => {
  try {
    await mongoose.connect(process.env.MONGO_HOST);
    console.log("✓ MongoDB ulandi\n");

    const db = mongoose.connection.db;
    const allColls = await db.listCollections().toArray();
    const collNames = allColls
      .map((c) => c.name)
      .filter((n) => !n.startsWith("system."))
      .sort();

    console.log(`=== ${collNames.length} ta collection topildi ===\n`);

    const results = [];
    for (const name of collNames) {
      try {
        const res = await migrateCollection(name);
        results.push(res);
        if (res.updated > 0) {
          console.log(`✓ ${name}: ${res.updated}/${res.total} yangilandi`);
          console.log(`  Field lar: ${res.fields.join(", ")}`);
        } else if (res.total > 0) {
          console.log(`  ${name}: ${res.total} ta hujjat — multi-lang yo'q`);
        }
      } catch (err) {
        console.error(`✗ ${name}: ${err.message}`);
      }
    }

    console.log("\n=== YAKUNIY HISOBOT ===");
    const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
    const totalDocs = results.reduce((s, r) => s + r.total, 0);
    const collsUpdated = results.filter((r) => r.updated > 0).length;

    console.log(`Collection lar: ${collsUpdated}/${collNames.length}`);
    console.log(`Hujjatlar:      ${totalUpdated}/${totalDocs} yangilandi`);
    console.log("\n✓ Migratsiya yakunlandi");

    process.exit(0);
  } catch (err) {
    console.error("Migration xatosi:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

main();
