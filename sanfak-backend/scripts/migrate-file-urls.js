"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { appendSignature, isPublicImageExt } = require("#shared/fileAccess");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const DRY = !WRITE;
const COLLECTION_ARG = args.find((a) => a.startsWith("--collection="));
const TARGET_COLLECTION = COLLECTION_ARG ? COLLECTION_ARG.split("=")[1] : null;

const MONGO_URI = process.env.MONGO_HOST;
if (!MONGO_URI) {
  console.error("✗ MONGO_HOST env o'zgaruvchisi topilmadi (.env tekshiring).");
  process.exit(1);
}

const log = (...a) => console.log(...a);
const warn = (...a) => console.warn("⚠", ...a);
const err = (...a) => console.error("✗", ...a);

const FILES_MARKER = "/files/";

const EXCLUDED_BY_DEFAULT = new Set(["auditlogs"]);

function isSigned(value) {
  const qIdx = value.indexOf("?");
  if (qIdx === -1) return false;
  const params = new URLSearchParams(value.slice(qIdx + 1));
  return params.has("t") && params.has("e");
}

function needsSigning(value) {
  if (typeof value !== "string") return false;
  const idx = value.indexOf(FILES_MARKER);
  if (idx === -1) return false;
  if (isSigned(value)) return false;

  const relativePath = value.slice(idx + FILES_MARKER.length);
  const dotIdx = relativePath.lastIndexOf(".");
  const ext = dotIdx === -1 ? "" : relativePath.slice(dotIdx).toLowerCase();
  if (isPublicImageExt(ext)) return false;

  return true;
}

function* walkStrings(node, prefix) {
  if (node === null || node === undefined) return;
  if (typeof node === "string") {
    yield { path: prefix, value: node };
    return;
  }
  if (typeof node !== "object") return;
  if (node instanceof Date) return;
  if (Buffer.isBuffer(node)) return;
  if (node._bsontype) return;

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      yield* walkStrings(node[i], prefix ? `${prefix}.${i}` : `${i}`);
    }
    return;
  }

  for (const [k, v] of Object.entries(node)) {
    if (k === "_id") continue;
    yield* walkStrings(v, prefix ? `${prefix}.${k}` : k);
  }
}

async function scanCollection(db, name) {
  const cursor = db.collection(name).find({});
  const changes = [];
  let scannedDocs = 0;

  for await (const doc of cursor) {
    scannedDocs++;
    for (const { path: p, value } of walkStrings(doc, "")) {
      if (!needsSigning(value)) continue;
      const newValue = appendSignature(value);
      if (newValue === value) continue;
      changes.push({ collection: name, _id: doc._id, path: p, oldValue: value, newValue });
    }
  }

  return { scannedDocs, changes };
}

async function applyChanges(db, changes) {
  const grouped = new Map();
  for (const c of changes) {
    const key = `${c.collection}::${c._id}`;
    if (!grouped.has(key)) {
      grouped.set(key, { collection: c.collection, _id: c._id, setOps: {} });
    }
    grouped.get(key).setOps[c.path] = c.newValue;
  }

  let updatedDocs = 0;
  for (const { collection, _id, setOps } of grouped.values()) {
    await db.collection(collection).updateOne({ _id }, { $set: setOps });
    updatedDocs++;
  }
  return updatedDocs;
}

async function main() {
  log(
    `\n═══ Fayl URL imzolash migratsiyasi ═══${DRY ? "  [DRY-RUN]" : "  [WRITE]"}`,
  );
  if (TARGET_COLLECTION) log(`  TARGET kolleksiya: ${TARGET_COLLECTION}`);

  await mongoose.connect(MONGO_URI);
  log(`✓ Ulanishildi: ${MONGO_URI}`);
  const db = mongoose.connection.db;

  const allCollections = await db.listCollections().toArray();
  const names = allCollections
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system."))
    .filter((n) => !TARGET_COLLECTION || n === TARGET_COLLECTION)
    .filter((n) => TARGET_COLLECTION === n || !EXCLUDED_BY_DEFAULT.has(n))
    .sort();

  if (TARGET_COLLECTION && names.length === 0) {
    warn(`"${TARGET_COLLECTION}" nomli kolleksiya topilmadi.`);
  }

  let totalScannedDocs = 0;
  const allChanges = [];
  const perCollection = {};

  for (const name of names) {
    const { scannedDocs, changes } = await scanCollection(db, name);
    totalScannedDocs += scannedDocs;
    if (changes.length > 0) {
      const docIds = new Set(changes.map((c) => String(c._id)));
      perCollection[name] = { docs: docIds.size, fields: changes.length };
      allChanges.push(...changes);
      for (const c of changes) {
        log(`  [${name}] ${c._id} :: ${c.path}`);
      }
    }
  }

  const touchedCollections = Object.keys(perCollection);
  const totalDocs = touchedCollections.reduce((s, n) => s + perCollection[n].docs, 0);

  log(`\n═══ Yakuniy hisobot ═══`);
  log(`  Skanerlangan kolleksiyalar: ${names.length} (${totalScannedDocs} hujjat)`);
  if (touchedCollections.length === 0) {
    log(`  O'zgaradigan havola topilmadi (0 ta) — hammasi allaqachon imzolangan yoki rasm.`);
  } else {
    for (const name of touchedCollections) {
      const s = perCollection[name];
      log(`  ${name}: ${s.docs} hujjat / ${s.fields} maydon`);
    }
  }
  log(
    `  JAMI: ${totalDocs} hujjat / ${allChanges.length} maydon (${touchedCollections.length} kolleksiya)`,
  );

  if (DRY) {
    log(`\n  [DRY-RUN] Hech narsa yozilmadi. Haqiqiy yozish uchun: --write`);
  } else if (allChanges.length === 0) {
    log(`\n  Yozish uchun hech narsa yo'q.`);
  } else {
    const backupDir = path.join(__dirname, "backups");
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(
      backupDir,
      `file-url-migration-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    fs.writeFileSync(
      backupFile,
      JSON.stringify(
        allChanges.map((c) => ({
          collection: c.collection,
          _id: String(c._id),
          path: c.path,
          oldValue: c.oldValue,
          newValue: c.newValue,
        })),
        null,
        2,
      ),
    );
    log(`\n  ✓ Zaxira yozildi: ${backupFile} (${allChanges.length} yozuv)`);

    const updatedDocs = await applyChanges(db, allChanges);
    log(`  ✓ Yozildi: ${updatedDocs} hujjat yangilandi.`);
  }

  await mongoose.disconnect();
  log(`\n✓ Tayyor.`);
}

main().catch((e) => {
  err("Migratsiya xatosi:", e.message);
  console.error(e);
  process.exit(1);
});
