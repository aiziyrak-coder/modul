#!/usr/bin/env node
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const { MODULES } = require("../src/config/constants");
const { NOTIFICATION_ACTIONS } = require("./_module-permission-lib");
const { loadAll } = require("./_role-seed-inventory");

const WRITE = process.argv.includes("--write");

const NOTIFICATION_SECTION = Object.freeze({
  section: MODULES.NOTIFICATION,
  actionKeys: NOTIFICATION_ACTIONS,
});

function computeMissingRoles() {
  const { grants } = loadAll();
  const notifRoles = new Set(
    grants.filter((g) => g.section === MODULES.NOTIFICATION).map((g) => g.title),
  );
  const anyGrantRoles = new Set(grants.map((g) => g.title));
  return [...anyGrantRoles].filter((t) => !notifRoles.has(t)).sort();
}

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `✓ MongoDB: ${process.env.MONGO_HOST}${
      WRITE ? "" : "  (DRY-RUN — DBga yozilmaydi, --write bilan yoqiladi)"
    }`,
  );

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");

  const targets = computeMissingRoles();
  console.log(`\nHisoblangan nishon rollar (${targets.length}): ${targets.join(", ")}\n`);

  let willGrant = 0;
  let skippedNotFound = 0;
  let skippedInactive = 0;
  let skippedHasIt = 0;

  for (const title of targets) {
    const role = await RoleModel.findOne({ title });
    if (!role) {
      console.log(`  ~ rol DBda topilmadi (o'tkazildi): ${title}`);
      skippedNotFound++;
      continue;
    }
    if (role.active === false) {
      console.log(`  ~ rol FAOLSIZ (o'tkazildi, faqat FAOL rollarga beriladi): ${title}`);
      skippedInactive++;
      continue;
    }
    const already = (role.permissions || []).some(
      (p) => p.section === MODULES.NOTIFICATION,
    );
    if (already) {
      console.log(`  = allaqachon bor (DB'da, o'tkazildi): ${title}`);
      skippedHasIt++;
      continue;
    }

    console.log(`  + notification beriladi: ${title} (${NOTIFICATION_ACTIONS.join(",")})`);
    willGrant++;
    if (WRITE) {
      role.permissions = [...(role.permissions || []), NOTIFICATION_SECTION];
      await role.save();
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  ${WRITE ? "Yozildi" : "Yoziladi (DRY-RUN)"}: ${willGrant}`);
  console.log(`  O'tkazib yuborildi — DBda topilmadi: ${skippedNotFound}`);
  console.log(`  O'tkazib yuborildi — faolsiz: ${skippedInactive}`);
  console.log(`  O'tkazib yuborildi — allaqachon bor: ${skippedHasIt}`);
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n[NOTIFICATION BASELINE SEED ERROR]", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
