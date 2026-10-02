const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { MODULES, ACTIONS, ROLES } = require("../src/config/constants");

const TARGET_ROLES = [ROLES.TALIM_SIFATI_NAZORATI];

const GRANTS = {
  [MODULES.ACADEMIC_YEAR]: [ACTIONS.READ, ACTIONS.READ_ALL],
  [MODULES.FACULTY]: [ACTIONS.READ, ACTIONS.READ_ALL],
  [MODULES.DEPARTMENT]: [ACTIONS.READ, ACTIONS.READ_ALL],
};

async function run() {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  const roles = mongoose.connection.db.collection("roles");

  let total = 0;
  for (const title of TARGET_ROLES) {
    const role = await roles.findOne({ title });
    if (!role) {
      console.warn(`  [SKIP] rol topilmadi: "${title}"`);
      continue;
    }

    const perms = Array.isArray(role.permissions) ? role.permissions : [];
    const bySection = new Map(perms.map((p) => [String(p.section), p]));
    const changes = [];

    for (const [section, wantActions] of Object.entries(GRANTS)) {
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
      total += changes.length;
      console.log(`  [${title}] ${changes.join("  ")}`);
    } else {
      console.log(`  [${title}] o'zgarishsiz (allaqachon to'liq)`);
    }
  }

  console.log(`\nQA reference access seed tugadi — ${total} ta o'zgarish.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[QA reference access] XATO:", err);
  process.exit(1);
});
