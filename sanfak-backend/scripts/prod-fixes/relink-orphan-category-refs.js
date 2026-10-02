"use strict";

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const {
  connectDb,
  nextBackupNumber,
  parseObjectIdString,
  DEFAULT_BACKUP_DIR,
  log,
  line,
} = require("./_lib");

const SCRIPT_NAME = "relink-orphan-category-refs";

const { EJSON } = mongoose.mongo.BSON;

const SITES = [
  {
    key: "scholarship.categoryIds",
    collection: "scholarships",
    root: "criteria",
    label: "scholarships.criteria[].categoryIds[]",
    collect: (criteria) => {
      const out = [];
      (criteria || []).forEach((c, i) => {
        (c.categoryIds || []).forEach((v, j) => {
          out.push({
            path: `criteria[${i}].categoryIds[${j}]`,
            value: v,
            criteriaId: c.criteria != null ? String(c.criteria) : null,
          });
        });
      });
      return out;
    },
    remapRoot: (criteria, map) =>
      (criteria || []).map((c) => {
        const ids = (c.categoryIds || []).map((v) => map.get(String(v)) ?? v);
        const seen = new Set();
        const deduped = [];
        for (const v of ids) {
          const k = String(v);
          if (seen.has(k)) continue;
          seen.add(k);
          deduped.push(v);
        }
        return { ...c, categoryIds: deduped };
      }),
  },
  {
    key: "scholarship.pointOverrides",
    collection: "scholarships",
    root: "criteria",
    label: "scholarships.criteria[].pointOverrides[].categoryId",
    collect: (criteria) => {
      const out = [];
      (criteria || []).forEach((c, i) => {
        (c.pointOverrides || []).forEach((o, j) => {
          if (o && o.categoryId != null) {
            out.push({
              path: `criteria[${i}].pointOverrides[${j}].categoryId`,
              value: o.categoryId,
              criteriaId: c.criteria != null ? String(c.criteria) : null,
            });
          }
        });
      });
      return out;
    },
    remapRoot: (criteria, map) =>
      (criteria || []).map((c) => ({
        ...c,
        pointOverrides: (c.pointOverrides || []).map((o) =>
          o && o.categoryId != null
            ? { ...o, categoryId: map.get(String(o.categoryId)) ?? o.categoryId }
            : o,
        ),
      })),
  },
  {
    key: "achievement.scoreCategoryId",
    collection: "studentachievements",
    root: "scoreCategoryId",
    label: "studentachievements.scoreCategoryId",
    collect: (v, doc) =>
      v != null
        ? [
            {
              path: "scoreCategoryId",
              value: v,
              criteriaId: doc && doc.scoreCriteria != null ? String(doc.scoreCriteria) : null,
            },
          ]
        : [],
    remapRoot: (v, map) => (v != null ? map.get(String(v)) ?? v : v),
  },
  {
    key: "application.judgeScores",
    collection: "scholarshipapplications",
    root: "judgeScores",
    label: "scholarshipapplications.judgeScores[].scores[].categoryId",
    collect: (judgeScores) => {
      const out = [];
      (judgeScores || []).forEach((js, i) => {
        (js.scores || []).forEach((s, j) => {
          if (s && s.categoryId != null) {
            out.push({
              path: `judgeScores[${i}].scores[${j}].categoryId`,
              value: s.categoryId,
              criteriaId: s.criteria != null ? String(s.criteria) : null,
            });
          }
        });
      });
      return out;
    },
    remapRoot: (judgeScores, map) =>
      (judgeScores || []).map((js) => ({
        ...js,
        scores: (js.scores || []).map((s) =>
          s && s.categoryId != null
            ? { ...s, categoryId: map.get(String(s.categoryId)) ?? s.categoryId }
            : s,
        ),
      })),
  },
];

function parseMappings(args) {
  const pairs = [];
  const errors = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== "--map") continue;
    const raw = args[i + 1];
    if (!raw || raw.startsWith("--")) {
      errors.push("--map dan keyin <eski>=<yangi> berilmagan");
      continue;
    }
    const parts = raw.split("=");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      errors.push(`--map "${raw}" — kutilgan shakl: <eski24hex>=<yangi24hex>`);
      continue;
    }
    const [from, to] = parts;
    let bad = false;
    if (!parseObjectIdString(from)) {
      errors.push(`--map: "${from}" 24-hex ObjectId emas`);
      bad = true;
    }
    if (!parseObjectIdString(to)) {
      errors.push(`--map: "${to}" 24-hex ObjectId emas`);
      bad = true;
    }
    if (!bad && from.toLowerCase() === to.toLowerCase()) {
      errors.push(`--map: eski va yangi bir xil (${from})`);
      bad = true;
    }
    if (!bad) pairs.push({ from: from.toLowerCase(), to: to.toLowerCase() });
  }
  const byFrom = new Map();
  for (const p of pairs) {
    const prev = byFrom.get(p.from);
    if (prev && prev !== p.to) errors.push(`--map: "${p.from}" ikki xil nishonga ko'rsatilgan`);
    byFrom.set(p.from, p.to);
  }
  return { pairs, errors };
}

function buildCatalog(criteriaDocs) {
  const map = new Map();
  for (const c of criteriaDocs || []) {
    for (const cat of c.categories || []) {
      map.set(String(cat._id), {
        categoryId: String(cat._id),
        criteriaId: String(c._id),
        criteriaName: c.name,
        name: cat.name,
        points: cat.points,
        active: cat.active !== false,
        parentDeleted: c.deletedAt != null,
      });
    }
  }
  return map;
}

function categoryFromLabel(label) {
  if (typeof label !== "string") return null;
  const m = /\(([^()]*)\)\s*$/.exec(label.trim());
  return m ? m[1].trim() || null : null;
}

function catalogByName(catalog, name) {
  if (!name) return [];
  const norm = String(name).trim().toLowerCase();
  return [...catalog.values()].filter((c) => String(c.name).trim().toLowerCase() === norm);
}

const KNOWN_FLAGS = new Set(["--write", "--audit", "--map"]);
const KNOWN_PREFIXES = ["--db=", "--backup-dir="];

function unknownArgs(args) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (!a.startsWith("--")) continue;
    if (KNOWN_FLAGS.has(a)) {
      if (a === "--map") i += 1;
      continue;
    }
    if (KNOWN_PREFIXES.some((p) => a.startsWith(p))) continue;
    out.push(a);
  }
  return out;
}

function anyIdForms(hex) {
  const oid = parseObjectIdString(hex);
  return oid ? [hex, oid] : [hex];
}

function remapRootValue(collection, root, value, map) {
  let out = value;
  for (const site of SITES) {
    if (site.collection === collection && site.root === root) {
      out = site.remapRoot(out, map);
    }
  }
  return out;
}

async function scan(db) {
  const criteriaDocs = await db.collection("evaluationcriterias").find({}).toArray();
  const catalog = buildCatalog(criteriaDocs);

  const orphans = [];
  const typeCounts = {};

  const byCollection = new Map();
  for (const site of SITES) {
    if (!byCollection.has(site.collection)) byCollection.set(site.collection, []);
    byCollection.get(site.collection).push(site);
  }

  for (const [collection, sites] of byCollection) {
    const docs = await db.collection(collection).find({}).toArray();
    for (const site of sites) typeCounts[site.key] = { objectId: 0, string: 0, other: 0 };
    for (const doc of docs) {
      for (const site of sites) {
        for (const hit of site.collect(doc[site.root], doc)) {
          const t = typeCounts[site.key];
          if (hit.value instanceof mongoose.Types.ObjectId) t.objectId += 1;
          else if (typeof hit.value === "string") t.string += 1;
          else t.other += 1;
          if (catalog.has(String(hit.value))) continue;
          orphans.push({
            site: site.key,
            label: site.label,
            collection,
            root: site.root,
            _id: doc._id,
            path: hit.path,
            value: String(hit.value),
            criteriaId: hit.criteriaId,
            badFormat: parseObjectIdString(String(hit.value)) === null,
            labelHint: categoryFromLabel(doc.scoreLabel),
            title: doc.name || doc.title || null,
          });
        }
      }
    }
  }

  return { catalog, orphans, typeCounts, criteriaCount: criteriaDocs.length };
}

async function auditEvidence(db, hexes) {
  const out = new Map();
  if (!hexes || hexes.length === 0) return out;
  const exists = await db.listCollections({ name: "auditlogs" }).toArray();
  if (exists.length === 0) return out;
  for (const hex of hexes) {
    const forms = anyIdForms(hex);
    const hits = await db
      .collection("auditlogs")
      .find({
        $or: [
          { "requestBody.scoreCategoryId": { $in: forms } },
          { "requestBody.scores.categoryId": { $in: forms } },
          { "requestBody.criteria.categoryIds": { $in: forms } },
        ],
      })
      .project({ path: 1, method: 1, userName: 1, date: 1 })
      .limit(5)
      .toArray();
    out.set(hex, hits);
  }
  return out;
}

function writeBackupEjson(backupDir, payload) {
  const body = { backupFormat: 2, ...payload };
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const n = nextBackupNumber(fs.readdirSync(backupDir), SCRIPT_NAME);
  const file = path.join(backupDir, `${SCRIPT_NAME}-${n}.json`);
  fs.writeFileSync(file, EJSON.stringify(body, undefined, 2, { relaxed: false }), "utf8");
  return file;
}

async function applyMappings(db, orphans, pairs, backupDir) {
  const map = new Map(pairs.map((p) => [p.from, p.to]));
  const targeted = orphans.filter((o) => map.has(o.value));

  const touched = new Map();
  for (const o of targeted) {
    const k = `${o.collection}#${String(o._id)}`;
    if (!touched.has(k)) touched.set(k, { collection: o.collection, _id: o._id, roots: new Set() });
    touched.get(k).roots.add(o.root);
  }

  const changes = [];
  for (const t of touched.values()) {
    const doc = await db.collection(t.collection).findOne({ _id: t._id });
    if (!doc) continue;
    const before = {};
    for (const r of t.roots) before[r] = doc[r];
    changes.push({ collection: t.collection, _id: t._id, roots: [...t.roots], before });
  }
  const backupFile = writeBackupEjson(backupDir, {
    createdAt: new Date().toISOString(),
    db: db.databaseName,
    script: SCRIPT_NAME,
    mappings: pairs,
    changes,
  });

  const results = [];
  for (const t of touched.values()) {
    const doc = await db.collection(t.collection).findOne({ _id: t._id });
    if (!doc) {
      results.push({ collection: t.collection, _id: t._id, status: "yo'qolgan" });
      continue;
    }
    const set = {};
    const filter = { _id: t._id };
    for (const r of t.roots) {
      set[r] = remapRootValue(t.collection, r, doc[r], map);
      filter[r] = doc[r];
    }
    const res = await db.collection(t.collection).updateOne(filter, { $set: set });
    results.push({
      collection: t.collection,
      _id: t._id,
      status: res.matchedCount === 0 ? "o'zgargan — TEGILMADI" : "qayta bog'landi",
      modified: res.modifiedCount,
    });
  }

  return { backupFile, results, targetedCount: targeted.length };
}

function buildGuardErrors({ write, pairs, scanResult, expectedDb, dbName }) {
  const errors = [];
  if (!write) return errors;

  if (!expectedDb) {
    errors.push("--db=<nom> berilmagan (yozish uchun MAJBURIY — noto'g'ri bazaga yozishning oldini oladi)");
  } else if (expectedDb !== dbName) {
    errors.push(`--db="${expectedDb}", lekin .env "${dbName}" ga ulandi — MOS EMAS`);
  }
  if (pairs.length === 0) {
    errors.push("--map <eski>=<yangi> berilmagan — skript o'zi moslashtirmaydi (qaror odamniki)");
  }

  for (const p of pairs) {
    if (scanResult.catalog.has(p.from)) {
      errors.push(`--map: "${p.from}" katalogda TIRIK kategoriya — yetim emas, tegilmaydi`);
      continue;
    }
    const affected = scanResult.orphans.filter((o) => o.value === p.from);
    if (affected.length === 0) {
      errors.push(`--map: "${p.from}" skanda YETIM sifatida topilmadi — tegishli hech narsa yo'q`);
      continue;
    }

    const target = scanResult.catalog.get(p.to);
    if (!target) {
      errors.push(`--map: nishon "${p.to}" katalogda YO'Q — yetimni yetimga bog'lab bo'lmaydi`);
      continue;
    }

    if (target.parentDeleted) {
      errors.push(
        `--map: nishon "${p.to}" («${target.name}») O'CHIRILGAN mezon («${target.criteriaName}») ichida — ball hisoblanmaydi`,
      );
      continue;
    }
    if (target.active === false) {
      errors.push(`--map: nishon "${p.to}" («${target.name}») NOFAOL kategoriya`);
      continue;
    }

    const mismatched = affected.filter(
      (o) => o.criteriaId != null && String(o.criteriaId) !== String(target.criteriaId),
    );
    if (mismatched.length > 0) {
      const where = mismatched.map((o) => `${o.collection}#${String(o._id)} → ${o.path}`).join(", ");
      errors.push(
        `--map: nishon "${p.to}" «${target.criteriaName}» mezoniga tegishli, lekin ${mismatched.length} ta havola BOSHQA mezonga ishora qiladi (${where}) — ball hisoblanmaydi`,
      );
      continue;
    }
    const unknown = affected.filter((o) => o.criteriaId == null);
    if (unknown.length > 0) {
      errors.push(
        `--map: ${unknown.length} ta havolada mezon ref i YO'Q (${unknown.map((o) => o.path).join(", ")}) — moslikni tekshirib bo'lmaydi, QO'LDA tekshiring`,
      );
    }
  }
  return errors;
}

const toPosix = (p) => String(p).split("\\").join("/");

async function touchedPairs(db, applied) {
  const out = [];
  for (const r of applied.results) {
    if (r.status !== "qayta bog'landi") continue;
    const doc = await db.collection(r.collection).findOne({ _id: r._id });
    if (!doc) continue;
    for (const site of SITES) {
      if (site.collection !== r.collection) continue;
      for (const hit of site.collect(doc[site.root], doc)) {
        if (hit.criteriaId == null) continue;
        out.push({
          where: `${r.collection}#${String(r._id)} → ${hit.path}`,
          criteriaId: String(hit.criteriaId),
          categoryId: String(hit.value),
        });
      }
    }
  }
  return out;
}

function report({ dbName, write, scanResult, audit, applied, pairs, guardErrors }) {
  const { orphans, typeCounts, catalog, criteriaCount } = scanResult;
  line("═");
  log(`  4.11 — YETIM baholash-kategoriya havolalari  ${write ? "[YOZISH]" : "[DRY — hech narsa yozilmadi]"}`);
  log(`  Baza: ${dbName}`);
  line("═");

  log();
  log(`  Katalog: ${criteriaCount} ta mezon, ${catalog.size} ta kategoriya`);
  log();
  log("  BSON tip taqsimoti (aralash tip yolg'on «topilmadi» beradi):");
  for (const site of SITES) {
    const t = typeCounts[site.key] || { objectId: 0, string: 0, other: 0 };
    log(`    ${site.label}`);
    log(`      objectId: ${t.objectId}  ·  string: ${t.string}  ·  boshqa: ${t.other}`);
  }

  line();
  if (orphans.length === 0) {
    log("  ✅ Yetim havola YO'Q.");
  } else {
    log(`  🔴 YETIM HAVOLALAR: ${orphans.length} ta`);
    log();
    const byValue = new Map();
    for (const o of orphans) {
      if (!byValue.has(o.value)) byValue.set(o.value, []);
      byValue.get(o.value).push(o);
    }
    for (const [value, list] of byValue) {
      const bad = list[0].badFormat ? "   ⛔ NOTO'G'RI FORMAT (24-hex emas)" : "";
      log(`  ── ${value}${bad}   — ${list.length} ta havola`);
      for (const o of list) {
        log(`       ${o.collection}#${String(o._id)} → ${o.path}${o.title ? `   («${o.title}»)` : ""}`);
      }
      const wantedCriteria = [...new Set(list.map((o) => o.criteriaId).filter(Boolean))];
      if (wantedCriteria.length > 0) {
        log(`     🔗 Havolalarning mezoni: ${wantedCriteria.join(", ")}`);
      }
      const hints = [...new Set(list.map((o) => o.labelHint).filter(Boolean))];
      if (hints.length > 0) {
        log(`     📌 Snapshot dalili (scoreLabel): ${hints.map((h) => `«${h}»`).join(", ")}`);
        for (const h of hints) {
          const cands = catalogByName(catalog, h);
          if (cands.length === 0) {
            log("        → katalogda bu nom TOPILMADI (kategoriya qayta nomlangan bo'lishi mumkin)");
            continue;
          }
          const usable = cands.filter(
            (c) =>
              !c.parentDeleted &&
              c.active !== false &&
              (wantedCriteria.length === 0 || wantedCriteria.includes(String(c.criteriaId))),
          );
          const mark = (c) => {
            const flags = [];
            if (wantedCriteria.length > 0 && !wantedCriteria.includes(String(c.criteriaId))) {
              flags.push("⚠ BOSHQA MEZON — ball hisoblanmaydi");
            }
            if (c.parentDeleted) flags.push("⛔ mezon O'CHIRILGAN");
            if (c.active === false) flags.push("⛔ nofaol");
            return flags.length > 0 ? `   ${flags.join(" · ")}` : "   ✅ mos mezon";
          };
          if (usable.length === 1 && cands.length === 1) {
            const c = usable[0];
            log(`        → katalogda AYNAN BITTA mos: ${c.categoryId}  («${c.name}», ${c.points} ball, mezon: «${c.criteriaName}»)`);
          } else {
            log(`        → ${cands.length} ta nomzod (foydalanish mumkin: ${usable.length}) — QO'LDA tanlang:`);
            cands.forEach((c) =>
              log(`           ${c.categoryId}  («${c.name}», ${c.points} ball, mezon: «${c.criteriaName}»)${mark(c)}`),
            );
          }
        }
      } else {
        log("     📌 Snapshot dalili YO'Q (bu maydonda nom saqlanmaydi)");
      }
      if (audit && audit.has(value)) {
        const hits = audit.get(value);
        log(`     📜 auditlogs: ${hits.length} ta so'rovda uchraydi`);
        hits.slice(0, 3).forEach((h) => log(`        ${h.method} ${h.path}  ·  ${h.userName || "?"}  ·  ${h.date || ""}`));
      }
      log();
    }
  }

  if (guardErrors && guardErrors.length > 0) {
    line();
    log("  ⛔ YOZISH RAD ETILDI:");
    guardErrors.forEach((e) => log(`     ${e}`));
  }

  if (applied) {
    line();
    log(`  Zaxira: ${applied.backupFile}`);
    log(`  Moslashtirish: ${pairs.map((p) => `${p.from} → ${p.to}`).join(", ")}`);
    log();
    applied.results.forEach((r) =>
      log(`     ${r.status === "qayta bog'landi" ? "✅" : "⚠️"} ${r.collection}#${String(r._id)} — ${r.status}`),
    );
    log();
    log("  TIKLASH (zaxiradagi `before` dan):");
    log("     🔴 Zaxira KANONIK EJSON — fayldagi `before` ni to'g'ridan-to'g'ri");
    log("        mongosh `$set` ga QO'YMANG: u yerda `{\"$oid\":…}` / `{\"$numberInt\":…}`");
    log("        turadi va Mongo 5+ ularni ODDIY maydon sifatida yozib yuboradi");
    log("        (ball son emas, obyekt bo'lib qoladi — ma'lumot buziladi).");
    log("     Ishlaydigan buyruq (EJSON.parse bilan):");
    log(`        node -e "const {EJSON}=require('mongoose').mongo.BSON,fs=require('fs');`);
    log(`          const b=EJSON.parse(fs.readFileSync('${toPosix(applied.backupFile)}','utf8'),{relaxed:false});`);
    log("          (async()=>{const {connectDb}=require('./scripts/prod-fixes/_lib');");
    log("            const {mongoose:m,db}=await connectDb();");
    log("            for(const c of b.changes) await db.collection(c.collection).updateOne({_id:c._id},{$set:c.before});");
    log("            await m.disconnect();})()\"");
  }

  line();
  if (!write && orphans.length > 0) {
    log("  Keyingi qadam — dalilni ko'rib chiqing, so'ng ANIQ moslashtirish bilan:");
    log(`     node scripts/prod-fixes/${SCRIPT_NAME}.js --audit`);
    log(`     node scripts/prod-fixes/${SCRIPT_NAME}.js --map <eski>=<yangi> --write --db=${dbName}`);
  }
  line("═");
}

async function run() {
  const args = process.argv.slice(2);
  const unknown = unknownArgs(args);
  if (unknown.length > 0) {
    line("═");
    log("  ⛔ NOMA'LUM ARGUMENT:");
    unknown.forEach((a) => log(`     ${a}`));
    log();
    log("  Ruxsat etilganlar: --write · --audit · --map <eski>=<yangi> · --db=<nom> · --backup-dir=<yo'l>");
    log("  ⚠️ `--map` BO'SHLIQ bilan beriladi (`--map a=b`), `--map=a=b` EMAS.");
    line("═");
    process.exitCode = 1;
    return;
  }
  const write = args.includes("--write");
  const wantAudit = args.includes("--audit");
  const backupDirArg = args.find((a) => a.startsWith("--backup-dir="));
  const backupDir = backupDirArg ? backupDirArg.split("=")[1] : DEFAULT_BACKUP_DIR;
  const dbArg = args.find((a) => a.startsWith("--db="));
  const expectedDb = dbArg ? dbArg.split("=")[1] : null;

  const { mongoose: mg, db, dbName } = await connectDb();
  try {
    const scanResult = await scan(db);
    const { pairs, errors } = parseMappings(args);
    const guardErrors = [...errors];

    guardErrors.push(...buildGuardErrors({ write, pairs, scanResult, expectedDb, dbName }));

    const audit = wantAudit
      ? await auditEvidence(db, [...new Set(scanResult.orphans.map((o) => o.value))])
      : null;

    let applied = null;
    if (write && guardErrors.length === 0) {
      applied = await applyMappings(db, scanResult.orphans, pairs, backupDir);
    }

    report({ dbName, write, scanResult, audit, applied, pairs, guardErrors });

    if (applied) {
      const after = await scan(db);
      const remaining = after.orphans.filter((o) => pairs.some((p) => p.from === o.value));
      if (remaining.length > 0) {
        log(`  ⛔ QAYTA TEKSHIRUV: ${remaining.length} ta havola HAMON yetim — tuzatish TO'LIQ EMAS.`);
        remaining.forEach((o) => log(`     ${o.collection}#${String(o._id)} → ${o.path}`));
        process.exitCode = 1;
      } else {
        log("  ✅ QAYTA TEKSHIRUV: moslashtirilgan id bo'yicha yetim QOLMADI.");
      }

      const dead = [];
      for (const o of await touchedPairs(db, applied)) {
        const cat = after.catalog.get(o.categoryId);
        if (!cat || String(cat.criteriaId) !== String(o.criteriaId) || cat.parentDeleted) {
          dead.push(o);
        }
      }
      if (dead.length > 0) {
        log(`  ⛔ QAYTA TEKSHIRUV: ${dead.length} ta juftlikda ball HAMON hisoblanmaydi:`);
        dead.forEach((o) => log(`     ${o.where}   (mezon ${o.criteriaId} · kategoriya ${o.categoryId})`));
        process.exitCode = 1;
      } else {
        log("  ✅ QAYTA TEKSHIRUV: tegilgan har juftlik uchun ball hisoblanadi (mezon ↔ kategoriya mos).");
      }
      log(`  Qolgan boshqa yetimlar: ${after.orphans.length}`);
      line("═");
    }

    if (guardErrors.length > 0) process.exitCode = 1;
  } finally {
    await mg.disconnect();
  }
}

module.exports = {
  SITES,
  parseMappings,
  buildGuardErrors,
  unknownArgs,
  touchedPairs,
  buildCatalog,
  categoryFromLabel,
  catalogByName,
  anyIdForms,
  remapRootValue,
  scan,
  applyMappings,
};

if (require.main === module) {
  run().catch((err) => {
    log(`  ⛔ XATO: ${err.message}`);
    process.exitCode = 1;
  });
}
