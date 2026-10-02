"use strict";

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { connectDb, writeBackup, DEFAULT_BACKUP_DIR, log, line } = require("./_lib");

const SCRIPT_NAME = "dedupe-references";
const SRC_DIR = path.join(__dirname, "..", "..", "src");
const REFERENCES_DIR = path.join(SRC_DIR, "references");

const APOSTROPHE_CHARS = "'‘’ʻʼ`´";
const APOSTROPHE_RE = new RegExp(`[${APOSTROPHE_CHARS}]\\s*`, "g");

const APOSTROPHE_ADJACENT_WS_RE = new RegExp(`[${APOSTROPHE_CHARS}]\\s|\\s[${APOSTROPHE_CHARS}]`);

const SCOPE_FIELD_CANDIDATES = [
  "faculty",
  "department",
  "province",
  "direction",
  "course",
  "academicYear",
  "building",
];

const DISPLAY_CODE_FIELDS = ["code", "scienceCode", "directionCode"];

function normalizeReferenceTitle(raw) {
  if (raw === null || raw === undefined) return "";
  let s = String(raw).toLowerCase();
  s = s.replace(APOSTROPHE_RE, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function discoverReferenceFolders(referencesDir) {
  const entries = fs.readdirSync(referencesDir, { withFileTypes: true });
  const folders = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name === "_services") continue;
    const modelPath = path.join(referencesDir, e.name, `${e.name}.model.js`);
    if (!fs.existsSync(modelPath)) continue;
    folders.push({ folder: e.name, modelPath });
  }
  return folders.sort((a, b) => a.folder.localeCompare(b.folder));
}

function findDuplicateGroups(docs) {
  const byKey = new Map();
  for (const doc of docs) {
    const key = normalizeReferenceTitle(doc.title);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(doc);
  }
  const groups = [];
  for (const [key, group] of byKey) {
    if (group.length > 1) groups.push({ normalizedTitle: key, docs: group });
  }
  return groups.sort((a, b) => a.normalizedTitle.localeCompare(b.normalizedTitle));
}

function pickCanonical(docs, refCountByDocId = new Map()) {
  const scoreOf = (d) => {
    const activeScore = d.active === false ? 0 : 1;
    const refScore = refCountByDocId.get(String(d._id)) || 0;
    return [activeScore, refScore];
  };
  const timeOf = (d) =>
    d._id && typeof d._id.getTimestamp === "function" ? d._id.getTimestamp().getTime() : 0;

  return docs.slice().sort((a, b) => {
    const [aActive, aRefs] = scoreOf(a);
    const [bActive, bRefs] = scoreOf(b);
    if (aActive !== bActive) return bActive - aActive;
    if (aRefs !== bRefs) return bRefs - aRefs;
    return timeOf(a) - timeOf(b);
  })[0];
}

function countTitleWhitespaceIssues(title) {
  const t = String(title || "");
  let issues = 0;
  if (t !== t.trim()) issues += 1;
  if (/\s\s/.test(t)) issues += 1;
  if (APOSTROPHE_ADJACENT_WS_RE.test(t)) issues += 1;
  return issues;
}

function pickBestWrittenTitle(docs) {
  const timeOf = (d) =>
    d && d._id && typeof d._id.getTimestamp === "function" ? d._id.getTimestamp().getTime() : 0;

  const winner = docs.slice().sort((a, b) => {
    const aIssues = countTitleWhitespaceIssues(a.title);
    const bIssues = countTitleWhitespaceIssues(b.title);
    if (aIssues !== bIssues) return aIssues - bIssues;
    const aTime = timeOf(a);
    const bTime = timeOf(b);
    if (aTime !== bTime) return aTime - bTime;
    return String(a.title).localeCompare(String(b.title));
  })[0];

  return winner.title;
}

function extractModelRefInfo(model) {
  const refFields = [];
  const visit = (schema, prefix, ctx) => {
    schema.eachPath((pathName, schemaType) => {
      const fullPath = prefix ? `${prefix}.${pathName}` : pathName;
      const directRef = schemaType && schemaType.options && schemaType.options.ref;
      const casterRef =
        schemaType && schemaType.caster && schemaType.caster.options && schemaType.caster.options.ref;
      const shape = {
        leafIsArray: !directRef && !!casterRef,
        arrayLevels: ctx.arrayLevels.slice(),
        viaMap: ctx.viaMap || fullPath.includes("$*"),
      };
      if (directRef) refFields.push({ field: fullPath, ref: directRef, ...shape });
      else if (casterRef) refFields.push({ field: fullPath, ref: casterRef, ...shape });
      if (schemaType && schemaType.schema && schemaType.schema !== schema) {
        const isDocArray = !!schemaType.$isMongooseDocumentArray;
        const isMap = !!schemaType.$isSchemaMap || schemaType.instance === "Map";
        visit(schemaType.schema, fullPath, {
          arrayLevels: isDocArray ? [...ctx.arrayLevels, fullPath] : ctx.arrayLevels,
          viaMap: ctx.viaMap || isMap || fullPath.includes("$*"),
        });
      }
    });
  };
  visit(model.schema, "", { arrayLevels: [], viaMap: false });
  return {
    modelName: model.modelName,
    collectionName: model.collection.name,
    refFields,
  };
}

function buildRefMap(modelInfos) {
  const map = new Map();
  for (const info of modelInfos) {
    for (const rf of info.refFields) {
      if (!map.has(rf.ref)) map.set(rf.ref, []);
      map.get(rf.ref).push({
        collection: info.collectionName,
        field: rf.field,
        model: info.modelName,
        leafIsArray: !!rf.leafIsArray,
        arrayLevels: rf.arrayLevels || [],
        viaMap: !!rf.viaMap,
      });
    }
  }
  return map;
}

function buildPositionalPath(field, arrayLevels) {
  const levels = arrayLevels || [];
  if (!levels.length) return { path: field, rests: [] };
  let out = "";
  let consumed = 0;
  const rests = [];
  levels.forEach((lvl, i) => {
    const seg = consumed ? lvl.slice(consumed + 1) : lvl;
    out += (out ? "." : "") + seg + ".$[el" + i + "]";
    consumed = lvl.length;
    rests.push(field.slice(consumed + 1));
  });
  return { path: out + "." + field.slice(consumed + 1), rests };
}

function buildRedirectOps(rc, dupId, canonicalId) {
  if (rc.viaMap) return null;
  const filter = { [rc.field]: dupId };
  const { path, rests } = buildPositionalPath(rc.field, rc.arrayLevels);
  const options = rests.length
    ? { arrayFilters: rests.map((rest, i) => ({ [`el${i}.${rest}`]: dupId })) }
    : {};
  if (rc.leafIsArray) {
    return [
      { filter, update: { $addToSet: { [path]: canonicalId } }, options },
      { filter, update: { $pull: { [path]: dupId } }, options },
    ];
  }
  return [{ filter, update: { $set: { [path]: canonicalId } }, options }];
}

function classifyTarget(folder, model) {
  const titlePath = model.schema.path("title");
  const hasTitle = !!titlePath && titlePath.instance === "String";
  const scopeFields = SCOPE_FIELD_CANDIDATES.filter((f) => !!model.schema.path(f));
  return {
    folder,
    modelName: model.modelName,
    collectionName: model.collection.name,
    hasTitle,
    reason: hasTitle
      ? null
      : `"${model.modelName}" sxemasida String turidagi "title" maydoni yo'q — bu skript qamrovidan tashqarida.`,
    scoped: scopeFields.length > 0,
    scopeFields,
  };
}

function isMongooseModel(x) {
  return typeof x === "function" && !!x.schema && typeof x.modelName === "string";
}

function walkFiles(dir, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === "node_modules") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(full, onFile);
    else if (e.isFile()) onFile(full);
  }
}

function requireAllModels(srcDir) {
  const loaded = [];
  const failures = [];
  walkFiles(srcDir, (file) => {
    if (!file.endsWith(".model.js")) return;
    try {
      const exported = require(file);
      loaded.push({ file, exported });
    } catch (err) {
      failures.push({ file, error: err.message });
    }
  });
  return { loaded, failures };
}

async function countInboundRefs(db, refSources, docId) {
  let total = 0;
  const perSource = [];
  for (const src of refSources) {
    const n = await db.collection(src.collection).countDocuments({ [src.field]: docId });
    if (n > 0) perSource.push({ ...src, count: n });
    total += n;
  }
  return { total, perSource };
}

async function processCollection({ db, target, refSources, write, backup, backupDir, dbName }) {
  if (!target.hasTitle) {
    return {
      folder: target.folder,
      collectionName: target.collectionName,
      applicable: false,
      reason: target.reason,
      scoped: target.scoped,
      scopeFields: target.scopeFields,
      totalDocs: 0,
      groups: [],
      merged: [],
      titleFixes: [],
    };
  }

  const docs = await db.collection(target.collectionName).find({}).toArray();
  const rawGroups = findDuplicateGroups(docs);

  const groups = [];
  for (const g of rawGroups) {
    const refCountByDocId = new Map();
    const refDetailByDocId = new Map();
    for (const doc of g.docs) {
      const { total, perSource } = await countInboundRefs(db, refSources, doc._id);
      refCountByDocId.set(String(doc._id), total);
      refDetailByDocId.set(String(doc._id), perSource);
    }
    const canonical = pickCanonical(g.docs, refCountByDocId);
    const duplicates = g.docs.filter((d) => d !== canonical);
    const bestTitle = pickBestWrittenTitle(g.docs);
    const titleRepair = bestTitle !== canonical.title ? bestTitle : null;
    groups.push({
      normalizedTitle: g.normalizedTitle,
      allDocs: g.docs,
      canonical,
      duplicates,
      refCountByDocId,
      refDetailByDocId,
      titleRepair,
    });
  }

  const unsupportedSources = (refSources || []).filter((s) => s.viaMap);
  const result = {
    folder: target.folder,
    collectionName: target.collectionName,
    applicable: true,
    scoped: target.scoped,
    scopeFields: target.scopeFields,
    totalDocs: docs.length,
    groups,
    merged: [],
    titleFixes: [],
    unsupportedSources,
  };

  if (!write || target.scoped || !groups.length) return result;
  const mergeAllowed = unsupportedSources.length === 0;
  if (!mergeAllowed) {
    result.mergeRefused = {
      reason: "MAP_PATH_UNSUPPORTED",
      sources: unsupportedSources.map((s) => `${s.collection}.${s.field}`),
    };
  }

  for (const g of groups) {
    for (const dup of mergeAllowed ? g.duplicates : []) {
      const perSource = g.refDetailByDocId.get(String(dup._id));

      let backupFile = null;
      try {
        if (backup) {
          const refSnapshots = {};
          for (const rc of perSource) {
            const rows = await db
              .collection(rc.collection)
              .find({ [rc.field]: dup._id })
              .project({ _id: 1 })
              .toArray();
            refSnapshots[`${rc.collection}.${rc.field}`] = {
              collection: rc.collection,
              field: rc.field,
              leafIsArray: !!rc.leafIsArray,
              ids: rows.map((r) => r._id),
            };
          }
          backupFile = writeBackup(backupDir, SCRIPT_NAME, {
            createdAt: new Date().toISOString(),
            db: dbName,
            script: SCRIPT_NAME,
            collection: target.collectionName,
            canonical: { _id: g.canonical._id, title: g.canonical.title },
            duplicate: dup,
            refSnapshots,
          });
        }

        for (const rc of perSource) {
          const ops = buildRedirectOps(rc, dup._id, g.canonical._id);
          if (!ops) continue;
          for (const op of ops) {
            await db.collection(rc.collection).updateMany(op.filter, op.update, op.options);
          }
        }

        let remaining = 0;
        for (const src of refSources) {
          remaining += await db.collection(src.collection).countDocuments({ [src.field]: dup._id });
        }

        if (remaining > 0) {
          result.merged.push({ dup, canonical: g.canonical, deleted: false, remaining, backupFile });
          continue;
        }
        await db.collection(target.collectionName).deleteOne({ _id: dup._id });
        result.merged.push({ dup, canonical: g.canonical, deleted: true, remaining: 0, backupFile });
      } catch (err) {
        result.merged.push({
          dup,
          canonical: g.canonical,
          deleted: false,
          remaining: null,
          error: err && err.message ? err.message : String(err),
          backupFile,
        });
      }
    }

    if (g.titleRepair) {
      let titleBackupFile = null;
      if (backup) {
        titleBackupFile = writeBackup(backupDir, SCRIPT_NAME, {
          createdAt: new Date().toISOString(),
          db: dbName,
          script: SCRIPT_NAME,
          collection: target.collectionName,
          action: "title-repair",
          docId: g.canonical._id,
          titleBefore: g.canonical.title,
          titleAfter: g.titleRepair,
        });
      }
      await db
        .collection(target.collectionName)
        .updateMany({ _id: g.canonical._id }, { $set: { title: g.titleRepair } });
      result.titleFixes.push({
        docId: g.canonical._id,
        from: g.canonical.title,
        to: g.titleRepair,
        backupFile: titleBackupFile,
      });
    }
  }

  return result;
}

async function dedupeReferences({
  db,
  targets,
  refMap,
  write = false,
  backup = true,
  backupDir = DEFAULT_BACKUP_DIR,
  dbName = "",
  only = null,
}) {
  const filtered = only && only.length ? targets.filter((t) => only.includes(t.folder)) : targets;
  const results = [];
  for (const target of filtered) {
    const refSources = refMap.get(target.modelName) || [];
    // eslint-disable-next-line no-await-in-loop
    const result = await processCollection({ db, target, refSources, write, backup, backupDir, dbName });
    results.push(result);
  }
  return results;
}

function formatDocRow(target, doc, { isCanonical = false } = {}) {
  const bits = [`_id=${doc._id}`, `active=${doc.active !== false}`];
  for (const f of DISPLAY_CODE_FIELDS) {
    if (doc[f] !== undefined && doc[f] !== null && doc[f] !== "") bits.push(`${f}=${doc[f]}`);
  }
  for (const f of target.scopeFields) {
    if (doc[f] !== undefined && doc[f] !== null) bits.push(`${f}=${doc[f]}`);
  }
  const mark = isCanonical ? "★ SAQLANADI" : "🗑 DUBLIKAT";
  return `     "${doc.title}"  ${bits.join(" ")}  → ${mark}`;
}

function printReport(results, { dry, dbName, failures = [], ignoredCount = 0 }) {
  log();
  line("═");
  log(`  DEDUPE-REFERENCES — src/references/* dublikat title topuvchi   rejim: ${dry ? "DRY-RUN (yozilmaydi)" : "WRITE"}`);
  log(`  Baza: ${dbName}`);
  line("═");

  if (failures.length) {
    log();
    log(`  ⚠️  OGOHLANTIRISH — ${failures.length} ta model fayli require qilinmadi (referens sanog'i TO'LIQ bo'lmasligi mumkin):`);
    for (const f of failures) log(`     ${f.file} — ${f.error}`);
  }
  if (ignoredCount) {
    log(`  (${ignoredCount} ta ".model.js" fayl mongoose Model eksport qilmadi — o'tkazib yuborildi)`);
  }

  const applicable = results.filter((r) => r.applicable);
  const notApplicable = results.filter((r) => !r.applicable);
  const withGroups = applicable.filter((r) => r.groups.length > 0);

  log();
  log(`  Tekshirilgan kolleksiyalar: ${results.length}   (title maydoni bor: ${applicable.length}, qamrov emas: ${notApplicable.length})`);
  log(`  Dublikat guruh topilgan kolleksiya: ${withGroups.length}`);

  for (const r of results) {
    log();
    line();
    log(`  ${r.folder}  (kolleksiya: ${r.collectionName})`);
    if (!r.applicable) {
      log(`     ⏭  QAMROV EMAS — ${r.reason}`);
      continue;
    }
    if (r.scoped) {
      log(`     ⚠️  SCOPED — parent bo'yicha qamrovlangan bo'lishi mumkin (${r.scopeFields.join(", ")}).`);
      log(`         --write rejimida AVTO-MERGE QILINMAYDI — faqat hisobot (qo'lda ko'rib chiqing).`);
    }
    log(`     jami hujjat: ${r.totalDocs}    dublikat guruh: ${r.groups.length}`);
    if (r.unsupportedSources && r.unsupportedSources.length) {
      log(`     ⛔ AVTO-BIRLASHTIRISH O'CHIRILGAN — Map (\`$*\`) ichidagi referens yo'li:`);
      for (const s of r.unsupportedSources) log(`        · ${s.collection}.${s.field}`);
      log(`        Sabab: bunday yo'lni MongoDB so'rovida statik yozib bo'lmaydi —`);
      log(`        filtr jimgina 0 topadi, "referens qoldimi?" tekshiruvi ham 0 beradi,`);
      log(`        ya'ni dublikat TIRIK HAVOLALAR bilan o'chirilardi.`);
      log(`        Avval shu kolleksiya uchun maqsadli migratsiya yozilsin.`);
      log(`        (Nom tuzatish — \`titleRepair\` — bloklanmaydi, u ishlayveradi.)`);
      log(`        ⚠️ Quyidagi referens sonlari shu sabab TO'LIQ EMAS.`);
    }
    if (!r.groups.length) continue;

    r.groups.forEach((g, i) => {
      log(`     ── Guruh ${i + 1}  normallashtirilgan="${g.normalizedTitle}" ──`);
      log(formatDocRow(r, g.canonical, { isCanonical: true }));
      if (g.titleRepair) log(`        ✎ nomi tuzatiladi: "${g.canonical.title}" → "${g.titleRepair}"`);
      const detail = g.refDetailByDocId.get(String(g.canonical._id)) || [];
      for (const d of detail) log(`        └ ${d.collection}.${d.field}: ${d.count}`);
      for (const dup of g.duplicates) {
        log(formatDocRow(r, dup, { isCanonical: false }));
        const dDetail = g.refDetailByDocId.get(String(dup._id)) || [];
        for (const d of dDetail) log(`        └ ${d.collection}.${d.field}: ${d.count}`);
        if (!dDetail.length) log(`        └ (hech qanday collection'da referens topilmadi)`);
      }
    });

    if (r.merged.length || (r.titleFixes && r.titleFixes.length)) {
      log(`     --- YOZISH NATIJASI ---`);
      for (const m of r.merged) {
        if (m.deleted) {
          log(`     ✅ "${m.dup.title}" (${m.dup._id}) → "${m.canonical.title}" (${m.canonical._id}) — birlashtirildi, o'chirildi.`);
        } else if (m.error) {
          log(`     ❌ "${m.dup.title}" (${m.dup._id}) — XATO, o'chirilmadi: ${m.error}`);
          log(`        Referenslar QISMAN ko'chirilgan bo'lishi mumkin. Skriptni qayta`);
          log(`        ishga tushirish xavfsiz (operatsiyalar idempotent), lekin avval`);
          log(`        xato sababini hal qiling (masalan unique indeks to'qnashuvi).`);
        } else {
          log(`     ⛔ "${m.dup.title}" (${m.dup._id}) — O'CHIRILMADI, qayta tekshiruvda ${m.remaining} ta referens QOLDI.`);
        }
      }
      for (const tf of r.titleFixes || []) {
        log(`     ✅ nomi tuzatildi: "${tf.from}" → "${tf.to}"  (${tf.docId})`);
      }
    }
  }

  log();
  line("═");
  const totalGroups = applicable.reduce((sum, r) => sum + r.groups.length, 0);
  const scopedWithGroups = withGroups.filter((r) => r.scoped).length;
  const totalDeleted = results.reduce((sum, r) => sum + r.merged.filter((m) => m.deleted).length, 0);
  const totalRefused = results.reduce((sum, r) => sum + r.merged.filter((m) => m.deleted === false).length, 0);
  log(`  JAMI: ${results.length} kolleksiya tekshirildi, ${totalGroups} ta dublikat guruh (shundan ${scopedWithGroups} ta SCOPED kolleksiyada — avto-merge qilinmadi)`);
  if (dry) {
    log(`  DRY-RUN — hech narsa yozilmadi/o'chirilmadi.`);
    log(`  Yozish: node scripts/prod-fixes/dedupe-references.js --write`);
  } else {
    log(`  BIRLASHTIRILDI: ${totalDeleted}    RAD ETILDI (referens qoldi): ${totalRefused}`);
  }
  line("═");
  log();
}

function computeExitCode(results) {
  const anyGroups = results.some((r) => r.groups && r.groups.length > 0);
  const anyRefused = results.some((r) => r.merged && r.merged.some((m) => m.deleted === false));
  return anyGroups || anyRefused ? 1 : 0;
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const backupDirArg = args.find((a) => a.startsWith("--backup-dir="));
  const backupDir = backupDirArg ? backupDirArg.split("=")[1] : DEFAULT_BACKUP_DIR;
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const only = onlyArg
    ? onlyArg
        .split("=")[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  const { db, dbName } = await connectDb();
  try {
    const targetFolders = discoverReferenceFolders(REFERENCES_DIR);
    const { loaded, failures } = requireAllModels(SRC_DIR);

    const modelInfos = [];
    let ignoredCount = 0;
    for (const { exported } of loaded) {
      if (isMongooseModel(exported)) modelInfos.push(extractModelRefInfo(exported));
      else ignoredCount += 1;
    }
    const refMap = buildRefMap(modelInfos);

    const targets = targetFolders.map((t) => classifyTarget(t.folder, require(t.modelPath)));

    if (only) {
      const known = new Set(targets.map((t) => t.folder));
      const unknown = only.filter((f) => !known.has(f));
      if (unknown.length) {
        console.error(`XATO: Noma'lum --only nomi: ${unknown.join(", ")}`);
        console.error(`Mavjud kolleksiyalar: ${[...known].sort().join(", ")}`);
        process.exitCode = 1;
        return;
      }
    }

    const results = await dedupeReferences({ db, targets, refMap, write, backupDir, dbName, only });
    printReport(results, { dry: !write, dbName, failures, ignoredCount });
    process.exitCode = computeExitCode(results);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error("XATO:", e.message);
    process.exit(1);
  });
}

module.exports = {
  normalizeReferenceTitle,
  discoverReferenceFolders,
  findDuplicateGroups,
  pickCanonical,
  countTitleWhitespaceIssues,
  pickBestWrittenTitle,
  extractModelRefInfo,
  buildRefMap,
  buildPositionalPath,
  buildRedirectOps,
  classifyTarget,
  isMongooseModel,
  requireAllModels,
  countInboundRefs,
  processCollection,
  dedupeReferences,
  printReport,
  computeExitCode,
  SCOPE_FIELD_CANDIDATES,
  DISPLAY_CODE_FIELDS,
};
