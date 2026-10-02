"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { MODULES, ACTIONS, ROLES } = require("../src/config/constants");

const GROUP_CODE = "4.12";
const WRITE = process.argv.includes("--write");

const EQ_CATALOG = [
  {
    section: MODULES.EQ_INDICATOR,
    title: "Ta'lim sifati — Indikatorlar",
    actionKeys: ["read", "create", "update", "delete"],
  },
  {
    section: MODULES.EQ_SUBMISSION,
    title: "Ta'lim sifati — Ma'lumotlar (yuborish/tekshirish)",
    actionKeys: ["read", "create", "readOwn", "review"],
  },
  {
    section: MODULES.EQ_ANNOUNCEMENT,
    title: "Ta'lim sifati — E'lonlar",
    actionKeys: ["read", "readAll", "readOwn", "create", "update", "delete"],
  },
  {
    section: MODULES.EQ_REPORT,
    title: "Ta'lim sifati — Hisobotlar",
    actionKeys: ["read"],
  },
];

const QA_EXACT = {
  [MODULES.EQ_INDICATOR]: ["read", "create", "update", "delete"],
  [MODULES.EQ_SUBMISSION]: ["read", "review"],
  [MODULES.EQ_ANNOUNCEMENT]: ["read", "create", "delete"],
  [MODULES.EQ_REPORT]: ["read"],

  [MODULES.INDICATOR]: [
    ACTIONS.CREATE,
    ACTIONS.READ,
    ACTIONS.READ_ALL,
    ACTIONS.UPDATE,
    ACTIONS.DELETE,
  ],
  [MODULES.INDICATOR_SUBMISSION]: [
    ACTIONS.READ,
    ACTIONS.READ_ALL,
    ACTIONS.UPDATE,
    ACTIONS.EXPORT,
    ACTIONS.APPROVE,
    ACTIONS.REJECT,
  ],

  [MODULES.ACADEMIC_YEAR]: [ACTIONS.READ, ACTIONS.READ_ALL],
  [MODULES.FACULTY]: [ACTIONS.READ, ACTIONS.READ_ALL],
  [MODULES.DEPARTMENT]: [ACTIONS.READ, ACTIONS.READ_ALL],
};

const QA_ROLE = {
  title: ROLES.TALIM_SIFATI_NAZORATI,
  desc: "Ta'lim sifatini nazorat qilish bo'limi xodimi (4.12)",
  scopeLevel: "global",
};

const TEACHER_ADD = {
  [MODULES.EQ_SUBMISSION]: ["create", "readOwn"],
  [MODULES.EQ_ANNOUNCEMENT]: ["readOwn"],
  [MODULES.INDICATOR]: [ACTIONS.READ, ACTIONS.READ_ALL],
  [MODULES.INDICATOR_SUBMISSION]: [ACTIONS.CREATE, ACTIONS.READ],
};

const fmt = (sections) =>
  Object.entries(sections)
    .map(([s, a]) => `${s}:[${a.join(",")}]`)
    .sort()
    .join("\n      ");

const toMap = (role) => {
  const out = {};
  for (const p of role.permissions || []) out[String(p.section)] = [...(p.actionKeys || [])];
  return out;
};

const toArray = (map, prev = {}) =>
  Object.entries(map).map(([section, actionKeys]) => ({
    _id: prev[section] || new mongoose.Types.ObjectId(),
    section,
    actionKeys,
  }));

const idsBySection = (role) => {
  const out = {};
  for (const p of role?.permissions || []) if (p._id) out[String(p.section)] = p._id;
  return out;
};

function diffExact(have, want) {
  const changes = [];
  for (const [section, actions] of Object.entries(want)) {
    const cur = have[section];
    if (!cur) {
      changes.push(`      + ${section}:[${actions.join(",")}]`);
      continue;
    }
    const add = actions.filter((a) => !cur.includes(a));
    const drop = cur.filter((a) => !actions.includes(a));
    if (add.length) changes.push(`      ~ ${section} + [${add.join(",")}]`);
    if (drop.length) changes.push(`      ~ ${section} − [${drop.join(",")}]`);
  }
  for (const section of Object.keys(have)) {
    if (!want[section]) {
      changes.push(`      − ${section}:[${have[section].join(",")}]  (BUTUNLAY O'CHADI)`);
    }
  }
  return changes;
}

function mergeAdditive(have, want) {
  const next = { ...have };
  const changes = [];
  for (const [section, actions] of Object.entries(want)) {
    const cur = next[section];
    if (!cur) {
      next[section] = [...actions];
      changes.push(`      + ${section}:[${actions.join(",")}]`);
      continue;
    }
    const missing = actions.filter((a) => !cur.includes(a));
    if (missing.length) {
      next[section] = [...cur, ...missing];
      changes.push(`      ~ ${section} + [${missing.join(",")}]`);
    }
  }
  return { next, changes };
}

async function ensureCatalog(db) {
  const group = await db.collection("permissiongroups").findOne({ code: GROUP_CODE });
  if (!group) {
    throw new Error(
      `"${GROUP_CODE}" permissionGroup topilmadi — avval permissionGroups seedini ishga tushiring`,
    );
  }
  console.log(`\n── 1. Ruxsat katalogi (guruh "${GROUP_CODE}" — ${group.title})`);

  const perms = db.collection("permissions");
  for (const p of EQ_CATALOG) {
    const cur = await perms.findOne({ section: p.section });
    const inGroup = cur && (cur.groups || []).some((g) => String(g) === String(group._id));
    const same = cur && String(cur.actionKeys) === String(p.actionKeys) && inGroup;
    if (same) {
      console.log(`   = ${p.section} o'zgarishsiz`);
      continue;
    }
    console.log(`   ${cur ? "~" : "+"} ${p.section} → [${p.actionKeys.join(",")}] + guruh ${GROUP_CODE}`);
    if (!WRITE) continue;
    await perms.updateOne(
      { section: p.section },
      {
        $set: { title: p.title, actionKeys: p.actionKeys, active: true },
        $addToSet: { groups: group._id },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
}

async function applyQa(db) {
  const roles = db.collection("roles");
  let role = await roles.findOne({ title: QA_ROLE.title });

  console.log(`\n── 2. QA roli: "${QA_ROLE.title}"  (AVTORITAR — ortiqchasi o'chadi)`);
  if (!role) {
    console.log(`   + rol mavjud emas → yaratiladi (scopeLevel=${QA_ROLE.scopeLevel})`);
    if (!WRITE) return;
    await roles.insertOne({ ...QA_ROLE, permissions: toArray(QA_EXACT), active: true });
    console.log("   ✓ rol yaratildi va to'liq ruxsat berildi");
    return;
  }

  console.log(`   ESKI HOLAT (tiklash uchun saqlang):\n      ${fmt(toMap(role))}`);

  const changes = diffExact(toMap(role), QA_EXACT);
  console.log(changes.length ? `   O'ZGARISHLAR:\n${changes.join("\n")}` : "   = o'zgarishsiz (allaqachon aynan mos)");

  if (role.scopeLevel !== QA_ROLE.scopeLevel) {
    console.log(`   ~ scopeLevel: "${role.scopeLevel}" → "${QA_ROLE.scopeLevel}"`);
  }
  if (!WRITE) return;
  await roles.updateOne(
    { _id: role._id },
    {
      $set: {
        permissions: toArray(QA_EXACT, idsBySection(role)),
        scopeLevel: QA_ROLE.scopeLevel,
        active: true,
      },
    },
  );
  console.log("   ✓ yozildi");
}

async function applyTeacher(db) {
  const roles = db.collection("roles");
  const role = await roles.findOne({ title: ROLES.OQITUVCHI });

  console.log(`\n── 3. O'qituvchi roli: "${ROLES.OQITUVCHI}"  (FAQAT QO'SHISH)`);
  if (!role) {
    console.warn(`   [SKIP] rol topilmadi — o'qituvchi roli boshqa seed mulki, bu yerda YARATILMAYDI`);
    return;
  }

  if (role.scopeLevel !== "self") {
    console.warn(
      `   ⚠️  DIQQAT: scopeLevel="${role.scopeLevel}" (kutilgan "self"). ` +
        "Bunda o'qituvchi BOSHQALARNING yuborilmalarini ham ko'rishi mumkin — leadga yetkazing.",
    );
  }

  const { next, changes } = mergeAdditive(toMap(role), TEACHER_ADD);
  console.log(changes.length ? `   O'ZGARISHLAR:\n${changes.join("\n")}` : "   = o'zgarishsiz (3 sahifa allaqachon ochiq)");
  console.log(`   (rolning qolgan ${Object.keys(toMap(role)).length - changes.length} + section'i tegilmadi)`);

  if (!WRITE || !changes.length) return;
  await roles.updateOne(
    { _id: role._id },
    { $set: { permissions: toArray(next, idsBySection(role)) } },
  );
  console.log("   ✓ yozildi");
}

async function verify(db) {
  console.log("\n── 4. Yakuniy tekshiruv (bazadan qayta o'qildi)");
  const roles = db.collection("roles");
  for (const [title, want, exact] of [
    [QA_ROLE.title, QA_EXACT, true],
    [ROLES.OQITUVCHI, TEACHER_ADD, false],
  ]) {
    const role = await roles.findOne({ title });
    if (!role) {
      console.warn(`   [SKIP] ${title}`);
      continue;
    }
    const have = toMap(role);
    const missing = Object.entries(want).flatMap(([s, acts]) =>
      acts.filter((a) => !(have[s] || []).includes(a)).map((a) => `${s}:${a}`),
    );
    const extra = exact ? Object.keys(have).filter((s) => !want[s]) : [];
    const ok = !missing.length && !extra.length;
    console.log(`   ${ok ? "✓" : "✗"} ${title} — ${Object.keys(have).length} section`
      + (missing.length ? `  || YETISHMAYDI: ${missing.join(", ")}` : "")
      + (extra.length ? `  || ORTIQCHA: ${extra.join(", ")}` : ""));
  }
}

async function run() {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;

  console.log("═".repeat(78));
  console.log("  4.12 TA'LIM SIFATI — rol menyu ruxsati");
  console.log(`  REJIM: ${WRITE ? "YOZUV (--write)" : "DRY-RUN — hech narsa yozilmaydi"}`);
  console.log("═".repeat(78));

  await ensureCatalog(db);
  await applyQa(db);
  await applyTeacher(db);
  if (WRITE) await verify(db);

  console.log(
    WRITE
      ? "\nTAYYOR. Backend ruxsatni HAR SO'ROVDA bazadan o'qiydi — \n" +
        "chiqib-kirish SHART EMAS, API darhol yangilanadi.\n" +
        "Sidebar uchun brauzerda sahifani YANGILASH (F5) yetarli: ilova " +
        "yuklanganda profil qayta so'raladi (`app/providers` → `bootstrap()`)."
      : "\nDRY-RUN tugadi. Yozish uchun: node seed/quality-role-access.seed.js --write",
  );
  await mongoose.disconnect();
}

module.exports = { QA_EXACT, TEACHER_ADD, EQ_CATALOG, QA_ROLE };

if (require.main === module) {
  run().catch((err) => {
    console.error("\n[4.12 rol ruxsati] XATO:", err.message);
    process.exit(1);
  });
}
