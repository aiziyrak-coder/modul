"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

const DRY = process.argv.includes("--dry");

const STATUS = { PENDING: 1, APPROVED: 2 };

const RECTOR_ACTIONS = [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE];

async function grantRector(RoleModel) {
  const role = await RoleModel.findOne({ title: ROLES.REKTOR });
  if (!role) {
    console.log(`  ! "${ROLES.REKTOR}" roli topilmadi — grant o'tkazib yuborildi`);
    return;
  }

  const perms = [...(role.permissions || [])];
  const idx = perms.findIndex((p) => p.section === MODULES.QUAL_CERTIFICATE);
  const before = idx >= 0 ? [...(perms[idx].actionKeys || [])] : [];
  const missing = RECTOR_ACTIONS.filter((a) => !before.includes(a));

  if (!missing.length) {
    console.log(`  = "${ROLES.REKTOR}" da grant allaqachon bor — o'zgarish yo'q`);
    return;
  }

  if (idx >= 0) perms[idx] = { section: MODULES.QUAL_CERTIFICATE, actionKeys: [...before, ...missing] };
  else perms.push({ section: MODULES.QUAL_CERTIFICATE, actionKeys: RECTOR_ACTIONS });

  if (!DRY) {
    role.permissions = perms;
    await role.save();
  }
  console.log(
    `  + "${ROLES.REKTOR}" ← ${MODULES.QUAL_CERTIFICATE}: ${missing.join(", ")}` +
      `   (rolning qolgan ${perms.length - 1} section'i tegilmadi)`,
  );
}

async function backfillStatus(CertModel) {
  const withoutStatus = { status: { $exists: false } };

  const [withFile, withoutFile] = await Promise.all([
    CertModel.countDocuments({ ...withoutStatus, file: { $nin: [null, ""] } }),
    CertModel.countDocuments({
      ...withoutStatus,
      $or: [{ file: { $exists: false } }, { file: null }, { file: "" }],
    }),
  ]);

  if (!withFile && !withoutFile) {
    console.log("  = statussiz hujjat yo'q — backfill kerak emas");
    return;
  }

  if (!DRY) {
    if (withFile) {
      await CertModel.updateMany(
        { ...withoutStatus, file: { $nin: [null, ""] } },
        { $set: { status: STATUS.APPROVED } },
      );
    }
    if (withoutFile) {
      await CertModel.updateMany(
        {
          ...withoutStatus,
          $or: [{ file: { $exists: false } }, { file: null }, { file: "" }],
        },
        { $set: { status: STATUS.PENDING } },
      );
    }
  }

  console.log(`  + TASDIQLANGAN (fayli bor): ${withFile} ta`);
  console.log(`  + KUTILMOQDA (fayli yo'q):  ${withoutFile} ta`);
}

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `[QualCertApproval Seed] MongoDB ga ulandi${DRY ? " (DRY-RUN, yozilmaydi)" : ""}\n`,
  );

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");
  const CertModel = require("../src/modules/4.04-qualification/_shared/qualEarnedCertificate.model");

  console.log("── 1) Rektor granti ───────────────────────────────────────────");
  await grantRector(RoleModel);

  console.log("\n── 2) Mavjud hujjatlarga status ───────────────────────────────");
  await backfillStatus(CertModel);

  const pending = await CertModel.countDocuments({ status: STATUS.PENDING });
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(
    `  Tasdiq kutayotgan hujjat: ${pending} ta${DRY ? "   (DRY — DB o'zgarmadi)" : ""}`,
  );
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { RECTOR_ACTIONS, STATUS, grantRector, backfillStatus };

if (require.main === module) {
  main().catch((err) => {
    console.error("[QualCertApproval Seed] XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
