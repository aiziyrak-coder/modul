"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

const RoleModel = require("../src/modules/4.01-auth/role/role.model");
const UserModel = require("../src/modules/4.01-auth/user/user.model");

const MANAGER_ROLE = {
  title: ROLES.MALAKA_MENEJER,
  desc: "Malaka oshirish menejeri — kurslar, qabul, monitoring, testlar va hisobotlarni boshqaradi",
  scopeLevel: "global",
  isSystem: false,
  active: true,
  permissions: [
    {
      section: MODULES.QUAL_COURSE_TYPE,
      actionKeys: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
      ],
    },
    {
      section: MODULES.QUAL_COURSE,
      actionKeys: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
        ACTIONS.EXPORT,
      ],
    },
    {
      section: MODULES.QUAL_TOPIC,
      actionKeys: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
      ],
    },
    {
      section: MODULES.QUAL_CALENDAR_PLAN,
      actionKeys: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
      ],
    },
    {
      section: MODULES.QUAL_PETITION,
      actionKeys: [
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.APPROVE,
        ACTIONS.REJECT,
        ACTIONS.EXPORT,
      ],
    },
    {
      section: MODULES.QUAL_CONTRACT,
      actionKeys: [
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.DELETE,
        ACTIONS.EXPORT,
      ],
    },
    {
      section: MODULES.QUAL_PAYMENT,
      actionKeys: [
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.EXPORT,
      ],
    },
    {
      section: MODULES.QUAL_COURSE_SUBSCRIPTION,
      actionKeys: [
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.EXPORT,
      ],
    },
    {
      section: MODULES.QUAL_SOURCE,
      actionKeys: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
      ],
    },
    {
      section: MODULES.QUAL_TEACHER,
      actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL],
    },
    {
      section: MODULES.QUAL_NOTIFICATION,
      actionKeys: [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
      ],
    },
    {
      section: MODULES.QUAL_ACCESS_TEST_RESULT,
      actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.EXPORT],
    },
    {
      section: MODULES.QUAL_ACCESS_TEST,
      actionKeys: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE, ACTIONS.DELETE],
    },
    {
      section: MODULES.QUAL_EXIT_TEST,
      actionKeys: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE, ACTIONS.DELETE],
    },
    {
      section: MODULES.QUAL_TEST_CONFIG,
      actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE],
    },
    {
      section: MODULES.QUAL_FINAL_TEST_RESULT,
      actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.EXPORT],
    },
    {
      section: MODULES.QUAL_EXIT_TEST_RESULT,
      actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.EXPORT],
    },
    {
      section: MODULES.QUAL_TOPIC_COMPLETION,
      actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.EXPORT],
    },
  ],
};

const MANAGER_USER = {
  oneIdPin: "11111111111111",
  firstName: "Malaka",
  lastName: "Menejer",
  middleName: "Testovich",
  email: "malaka.menejer@test.uz",
  phone: "+998901112201",
};

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[MalakaManager Seed] MongoDB ga ulandi");
  console.log("[MalakaManager Seed] Idempotent rejim: mavjud rol/user CLOBBER QILINMAYDI\n");

  console.log("── 1. Rol ─────────────────────────────────────────────────────");
  let roleId;
  const existingRole = await RoleModel.findOne({ title: MANAGER_ROLE.title });

  if (existingRole) {
    roleId = existingRole._id;
    existingRole.permissions = MANAGER_ROLE.permissions;
    existingRole.active = true;
    await existingRole.save();
    console.log(
      `  ~ YANGILANDI: "${MANAGER_ROLE.title}" permissionlari kanonik to'plamga tenglandi (${MANAGER_ROLE.permissions.length} section)`,
    );
  } else {
    const created = await RoleModel.create(MANAGER_ROLE);
    roleId = created._id;
    console.log(
      `  + YARATILDI: "${MANAGER_ROLE.title}" (${MANAGER_ROLE.scopeLevel}) — ${MANAGER_ROLE.permissions.length} section`,
    );
  }

  console.log("\n── 2. Test menejer foydalanuvchi ──────────────────────────────");
  const existingUser = await UserModel.findOne({ oneIdPin: MANAGER_USER.oneIdPin });

  if (existingUser) {
    console.log(`  ~ SKIP: "${MANAGER_USER.oneIdPin}" allaqachon bor — o'zgartirilmadi`);
  } else {
    await UserModel.create({
      oneIdPin: MANAGER_USER.oneIdPin,
      firstName: MANAGER_USER.firstName,
      lastName: MANAGER_USER.lastName,
      middleName: MANAGER_USER.middleName,
      email: MANAGER_USER.email,
      phone: MANAGER_USER.phone,
      role: roleId,
      active: true,
    });
    console.log(`  + YARATILDI: "${MANAGER_USER.oneIdPin}" → ${MANAGER_ROLE.title}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Rol       : ${MANAGER_ROLE.title} (${MANAGER_ROLE.permissions.length} section)`);
  console.log(`  Login PIN : ${MANAGER_USER.oneIdPin}`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n🔑 Login: POST /api/auth  →  { \"oneIdPin\": \"11111111111111\" }\n");

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { MANAGER_ROLE };

if (require.main === module) {
  main().catch((err) => {
    console.error("[MalakaManager Seed] XATO:", err.message);
    if (err.errors) {
      Object.entries(err.errors).forEach(([field, e]) =>
        console.error(`  - ${field}: ${e.message}`),
      );
    }
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
