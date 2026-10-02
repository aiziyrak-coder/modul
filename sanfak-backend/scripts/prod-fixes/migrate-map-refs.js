"use strict";

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const {
  connectDb,
  parseObjectIdString,
  writeBackup,
  DEFAULT_BACKUP_DIR,
  log,
  line,
} = require("./_lib");

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => {
  const i = argv.indexOf(f);
  return i === -1 ? null : argv[i + 1];
};

const WRITE = has("--write");
const LIST_ONLY = has("--paths");
const REF_NAME = val("--ref");
const FROM = val("--from");
const TO = val("--to");

function loadModels() {
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
  return failed;
}

function mapRefPaths(schema, prefix = "", seen = new Set(), out = []) {
  if (seen.has(schema)) return out;
  const next = new Set(seen);
  next.add(schema);

  schema.eachPath((name, type) => {
    if (name === "_id" || name === "__v") return;
    if (name.includes("$*")) return;
    const full = prefix ? `${prefix}.${name}` : name;

    if (type.instance === "Map") {
      const of = type.options && type.options.of;
      if (of && of.paths) {
        mapRefPaths(of, `${full}.$*`, next, out);
        return;
      }
      const ofItem = Array.isArray(of) ? of[0] : of;
      const ofRef = ofItem && ofItem.ref;
      if (ofRef) out.push({ path: `${full}.$*`, ref: ofRef });
      return;
    }
    const refOf = (t) => t && t.options && t.options.ref;
    if (type.instance === "ObjectId" && refOf(type)) {
      if (full.includes("$*")) out.push({ path: full, ref: type.options.ref });
      return;
    }
    if (
      type.instance === "Array" &&
      type.caster &&
      type.caster.instance === "ObjectId" &&
      refOf(type.caster)
    ) {
      if (full.includes("$*")) out.push({ path: full, ref: type.caster.options.ref });
      return;
    }
    if (type.schema) {
      mapRefPaths(type.schema, `${full}${type.instance === "Array" ? ".$[]" : ""}`, next, out);
    }
  });
  return out;
}

function collectTargets() {
  const byCollection = new Map();
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    const paths = mapRefPaths(model.schema);
    if (!paths.length) continue;
    const collection = model.collection.collectionName;
    const seenPaths = byCollection.get(collection) || new Map();
    for (const p of paths) seenPaths.set(p.path, p.ref);
    byCollection.set(collection, seenPaths);
  }
  return byCollection;
}

function rewrite(node, segments, from, to) {
  if (node === null || node === undefined) return 0;
  if (!segments.length) return 0;

  const [head, ...rest] = segments;

  if (head === "$*" || head === "$[]") {
    const children =
      head === "$[]"
        ? Array.isArray(node)
          ? node
          : []
        : typeof node === "object"
          ? Object.values(node)
          : [];
    let n = 0;
    for (const child of children) n += rewrite(child, rest, from, to);
    return n;
  }

  if (!rest.length) {
    const cur = node[head];
    if (Array.isArray(cur)) {
      let n = 0;
      for (let i = 0; i < cur.length; i += 1) {
        if (cur[i] && String(cur[i]) === String(from)) {
          cur[i] = to;
          n += 1;
        }
      }
      return n;
    }
    if (cur && String(cur) === String(from)) {
      node[head] = to;
      return 1;
    }
    return 0;
  }

  return rewrite(node[head], rest, from, to);
}

async function run() {
  const { db, dbName } = await connectDb();
  try {
    const failed = loadModels();
    const targets = collectTargets();

    line();
    log(`  Baza  : ${dbName}`);
    log(`  Rejim : ${LIST_ONLY ? "--paths (faqat ro'yxat)" : WRITE ? "--write (YOZADI)" : "dry-run"}`);
    if (failed.length) {
      log(`  🔴 Yuklanmagan model fayllari: ${failed.length} — ular QAMRALMADI:`);
      for (const f of failed) log(`      ${f}`);
    }
    line();

    if (LIST_ONLY || !REF_NAME) {
      let total = 0;
      for (const [collection, paths] of targets) {
        log(`  ${collection}: ${paths.size} ta Map-ichi ref yo'li`);
        for (const [p, ref] of paths) log(`     ${p}  ->  ${ref}`);
        total += paths.size;
      }
      log(`\n  JAMI: ${total}`);
      if (!LIST_ONLY) {
        log("\n  Ishlatish: --ref <modelNomi> --from <dupId> --to <canonicalId> [--write]");
      }
      return;
    }

    if (!FROM || !TO) {
      log("  🔴 `--from` va `--to` SHART.");
      process.exitCode = 1;
      return;
    }
    const fromId = parseObjectIdString(FROM);
    const toId = parseObjectIdString(TO);
    if (!fromId || !toId) {
      log("  🔴 `--from`/`--to` 24-belgili hex ObjectId bo'lishi kerak.");
      process.exitCode = 1;
      return;
    }
    if (String(fromId) === String(toId)) {
      log("  🔴 `--from` va `--to` bir xil — hech narsa qilinmaydi.");
      process.exitCode = 1;
      return;
    }

    const refModel = mongoose.modelNames().includes(REF_NAME) ? mongoose.model(REF_NAME) : null;
    if (!refModel) {
      log(`  🔴 "${REF_NAME}" nomli model topilmadi.`);
      process.exitCode = 1;
      return;
    }
    const canonicalExists = await db
      .collection(refModel.collection.collectionName)
      .countDocuments({ _id: toId });
    if (!canonicalExists) {
      log(`  🔴 canonical (#${toId}) "${refModel.collection.collectionName}" da TOPILMADI.`);
      process.exitCode = 1;
      return;
    }

    let touchedDocs = 0;
    let replacements = 0;

    for (const [collection, paths] of targets) {
      const mine = [...paths.entries()].filter(([, ref]) => ref === REF_NAME).map(([p]) => p);
      if (!mine.length) continue;

      const roots = [...new Set(mine.map((p) => p.split(".")[0]))];
      const projection = { _id: 1 };
      for (const r of roots) projection[r] = 1;

      const cursor = db.collection(collection).find({}, { projection });
      for await (const doc of cursor) {
        let n = 0;
        for (const p of mine) n += rewrite(doc, p.split("."), fromId, toId);
        if (!n) continue;
        touchedDocs += 1;
        replacements += n;
        log(`    · ${collection}#${doc._id} — ${n} ta havola`);
        if (WRITE) {
          if (touchedDocs === 1) {
            writeBackup(DEFAULT_BACKUP_DIR, "migrate-map-refs", {
              createdAt: new Date().toISOString(),
              db: dbName,
              script: "migrate-map-refs",
              note: "Map-ichi referens qayta yo'naltirish — TIKLASH QO'LDA",
              ref: REF_NAME,
              from: fromId,
              to: toId,
            });
          }
          const $set = {};
          for (const r of roots) $set[r] = doc[r];
          await db.collection(collection).updateOne({ _id: doc._id }, { $set });
        }
      }
    }

    log(`\n  Hujjat  : ${touchedDocs}`);
    log(`  Havola  : ${replacements}`);
    if (!WRITE && touchedDocs) log("\n  ℹ️  Dry-run — yozish uchun `--write` bering");
    if (WRITE && touchedDocs) log("\n  ✅ Yozildi");
    if (!touchedDocs) log("\n  ✅ Bu id bo'yicha Map ichida havola topilmadi.");
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

module.exports = { mapRefPaths, rewrite };
