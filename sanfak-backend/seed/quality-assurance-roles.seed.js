const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

const NEW_ROLES = [
  {
    title: "talim_sifati_nazorati",
    desc: "Ta'lim sifatini nazorat qilish bo'limi xodimi (4.12)",
    scopeLevel: "global",
  },
];

const QA_GRANTS = {
  indicator: ["create", "read", "readAll", "update", "delete"],
  indicatorSubmission: [
    "read",
    "readAll",
    "update",
    "export",
    "approve",
    "reject",
  ],
};

const GRANTS = {
  talim_sifati_nazorati: QA_GRANTS,
  oqituvchi: {
    indicator: ["read", "readAll"],
    indicatorSubmission: ["create", "read"],
  },
};

async function run() {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  const roles = mongoose.connection.db.collection("roles");

  for (const r of NEW_ROLES) {
    const existing = await roles.findOne({ title: r.title });
    if (!existing) {
      await roles.insertOne({
        title: r.title,
        desc: r.desc,
        scopeLevel: r.scopeLevel,
        permissions: [],
        active: true,
      });
      console.log(`  [+role] "${r.title}" yaratildi (scopeLevel=${r.scopeLevel})`);
    } else {
      console.log(`  [role] "${r.title}" allaqachon mavjud`);
    }
  }

  let totalAdded = 0;
  for (const [title, sections] of Object.entries(GRANTS)) {
    const role = await roles.findOne({ title });
    if (!role) {
      console.warn(`  [SKIP] rol topilmadi: "${title}"`);
      continue;
    }
    const perms = Array.isArray(role.permissions) ? role.permissions : [];
    const bySection = new Map(perms.map((p) => [String(p.section), p]));
    const changes = [];

    for (const [section, wantActions] of Object.entries(sections)) {
      const existing = bySection.get(section);
      if (!existing) {
        perms.push({ section, actionKeys: [...wantActions] });
        changes.push(`+${section}[${wantActions.join(",")}]`);
      } else {
        const have = new Set(existing.actionKeys || []);
        const missing = wantActions.filter((a) => !have.has(a));
        if (missing.length) {
          existing.actionKeys = [...(existing.actionKeys || []), ...missing];
          changes.push(`${section}+[${missing.join(",")}]`);
        }
      }
    }

    if (changes.length) {
      await roles.updateOne({ _id: role._id }, { $set: { permissions: perms } });
      totalAdded += changes.length;
      console.log(`  [${title}] ${changes.join("  ")}`);
    } else {
      console.log(`  [${title}] o'zgarishsiz (allaqachon to'liq)`);
    }
  }

  console.log(`\nQuality Assurance RBAC seed tugadi — ${totalAdded} ta section/action qo'shildi.`);
  await mongoose.disconnect();
}

module.exports = { GRANTS };

if (require.main === module) {
  run().catch((err) => {
    console.error("Quality Assurance RBAC seed XATO:", err.message);
    process.exit(1);
  });
}
