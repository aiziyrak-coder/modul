"use strict";

const mongoose = require("mongoose");
const { connectDb, log, line } = require("./_lib");

const SHOW_IDS = process.argv.includes("--ids");
const MAX_IDS = 20;

function arrayRefPaths(schema, prefix = "", seen = new Set()) {
  const out = [];
  if (seen.has(schema)) return out;
  seen.add(schema);

  schema.eachPath((name, type) => {
    const full = prefix ? `${prefix}.${name}` : name;
    if (name === "__v") return;

    if (type.instance === "Array" && type.caster && type.caster.instance === "ObjectId") {
      if (type.caster.options && type.caster.options.ref) out.push(full);
      return;
    }
    if (type.schema) out.push(...arrayRefPaths(type.schema, `${full}.$[]`, seen));
  });
  return out;
}

async function run() {
  const { db, dbName } = await connectDb();
  try {
    const fs = require("fs");
    const path = require("path");
    const SRC = path.join(__dirname, "..", "..", "src");
    const failed = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith(".model.js")) {
          try {
            require(full);
          } catch (err) {
            failed.push(`${path.relative(SRC, full)} — ${err.message}`);
          }
        }
      }
    };
    walk(SRC);

    const names = mongoose.modelNames().sort();
    line();
    log(`  Baza    : ${dbName}`);
    log(`  Modellar: ${names.length}`);
    if (failed.length) {
      log(`  🔴 Yuklanmagan model fayllari: ${failed.length} — ular SKANERLANMADI:`);
      for (const f of failed) log(`      ${f}`);
    }
    log("  Rejim   : FAQAT O'QISH (bu skriptda `--write` YO'Q)");
    line();

    let scanned = 0;
    const hits = [];

    for (const name of names) {
      const model = mongoose.model(name);
      const paths = arrayRefPaths(model.schema);
      if (!paths.length) continue;
      const collection = model.collection.collectionName;

      for (const p of paths) {
        if (p.includes("$[]")) continue;
        scanned += 1;
        const q = { [p]: { $exists: true, $not: { $type: "array" } } };
        const count = await db.collection(collection).countDocuments(q);
        if (!count) continue;
        const ids = SHOW_IDS
          ? (await db.collection(collection).find(q).project({ _id: 1 }).limit(MAX_IDS).toArray()).map(
              (d) => String(d._id),
            )
          : [];
        hits.push({ model: name, collection, path: p, count, ids });
      }
    }

    log(`  Tekshirilgan massiv-ref maydonlari: ${scanned}`);
    log(`  🔴 Buzilgan (skalyarga aylangan)  : ${hits.length}\n`);

    for (const h of hits) {
      log(`    🔴 ${h.collection}.${h.path} — ${h.count} ta hujjat  (${h.model})`);
      if (h.ids.length) log(`        ${h.ids.join(", ")}${h.count > MAX_IDS ? " …" : ""}`);
    }

    if (!hits.length) {
      log("    ✅ Bunday yozuv topilmadi.");
    } else {
      log("");
      log("  Keyingi qadam — QO'LDA: to'g'ri massiv qiymati hech qayerda");
      log("  saqlanmagan, shuning uchun bu skript tuzatmaydi. Zaxiralarni");
      log("  ko'ring (`restore-backup.js`) yoki biznes egasidan so'rang.");
    }
    if (!SHOW_IDS && hits.length) log("\n  ℹ️  `--ids` bilan hujjat id larini ham ko'rsatadi");
  } finally {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch((err) => {
    log(`  🔴 XATO: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = { arrayRefPaths };
