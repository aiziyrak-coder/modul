"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { MODULES, ACTIONS } = require("../src/config/constants");

const RoleModel = require("../src/modules/4.01-auth/role/role.model");
const UserModel = require("../src/modules/4.01-auth/user/user.model");

const MALAKA_TINGLOVCHI = "malaka_tinglovchi";

const R = [ACTIONS.READ, ACTIONS.READ_ALL];
const CRU = [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE];

const TINGLOVCHI_PERMISSIONS = [
  { section: MODULES.QUAL_LISTENER_PORTAL, actionKeys: [ACTIONS.READ] },
  { section: MODULES.QUAL_COURSE, actionKeys: R },
  { section: MODULES.QUAL_PETITION, actionKeys: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL] },
  { section: MODULES.PROVINCE, actionKeys: R },
  { section: MODULES.REGION, actionKeys: R },
  { section: MODULES.QUAL_CALENDAR_PLAN, actionKeys: R },
  { section: MODULES.QUAL_NOTIFICATION, actionKeys: R },
  { section: MODULES.QUAL_COURSE_SUBSCRIPTION, actionKeys: [ACTIONS.READ] },
  { section: MODULES.QUAL_CONTRACT, actionKeys: R },
  { section: MODULES.QUAL_PAYMENT, actionKeys: [ACTIONS.CREATE, ACTIONS.READ] },
  { section: MODULES.QUAL_SOURCE, actionKeys: R },
  { section: MODULES.QUAL_TOPIC, actionKeys: R },
  { section: MODULES.QUAL_TOPIC_LECTURE, actionKeys: R },
  { section: MODULES.QUAL_TOPIC_PRACTICAL, actionKeys: R },
  { section: MODULES.QUAL_TOPIC_VIDEO, actionKeys: R },
  { section: MODULES.QUAL_TOPIC_SCENARIO, actionKeys: R },
  { section: MODULES.QUAL_TOPIC_FINAL_TEST, actionKeys: R },
  { section: MODULES.QUAL_ACCESS_TEST_RESULT, actionKeys: CRU },
  { section: MODULES.QUAL_FINAL_TEST_RESULT, actionKeys: CRU },
  { section: MODULES.QUAL_EXIT_TEST_RESULT, actionKeys: CRU },
  { section: MODULES.QUAL_TOPIC_COMPLETION, actionKeys: CRU },
  { section: MODULES.QUAL_COURSE_TYPE, actionKeys: [ACTIONS.READ_ALL] },
  {
    section: MODULES.CHAT,
    actionKeys: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.DELETE],
  },
];

const TINGLOVCHI_ROLE = {
  title: MALAKA_TINGLOVCHI,
  desc: "Malaka oshirish tinglovchisi — kursga yoziladi, o'qiydi, testlarni topshiradi, manba/shartnomani ko'radi",
  scopeLevel: "global",
  isSystem: false,
  active: true,
  permissions: TINGLOVCHI_PERMISSIONS,
};

const TINGLOVCHI_USER = {
  oneIdPin: "33333333333333",
  firstName: "Malaka",
  lastName: "Tinglovchi",
  middleName: "Testovich",
  email: "malaka.tinglovchi@test.uz",
  phone: "+998901112203",
};

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[MalakaTinglovchi Seed] MongoDB ga ulandi\n");

  console.log("── 1. Rol: malaka_tinglovchi ──────────────────────────────────");
  let role = await RoleModel.findOne({ title: TINGLOVCHI_ROLE.title });

  if (!role) {
    role = await RoleModel.create(TINGLOVCHI_ROLE);
    console.log(
      `  + YARATILDI: "${TINGLOVCHI_ROLE.title}" (${TINGLOVCHI_ROLE.scopeLevel}) — ${TINGLOVCHI_PERMISSIONS.length} section`,
    );
  } else {
    role.permissions = TINGLOVCHI_PERMISSIONS;
    role.active = true;
    await role.save();
    console.log(
      `  ~ YANGILANDI: "${TINGLOVCHI_ROLE.title}" permissionlari kanonik to'plamga tenglandi (${TINGLOVCHI_PERMISSIONS.length} section)`,
    );
  }

  console.log("\n── 2. Test tinglovchi foydalanuvchi ───────────────────────────");
  const existingUser = await UserModel.findOne({ oneIdPin: TINGLOVCHI_USER.oneIdPin });

  if (!existingUser) {
    await UserModel.create({
      oneIdPin: TINGLOVCHI_USER.oneIdPin,
      firstName: TINGLOVCHI_USER.firstName,
      lastName: TINGLOVCHI_USER.lastName,
      middleName: TINGLOVCHI_USER.middleName,
      email: TINGLOVCHI_USER.email,
      phone: TINGLOVCHI_USER.phone,
      role: role._id,
      active: true,
    });
    console.log(`  + YARATILDI: "${TINGLOVCHI_USER.oneIdPin}" → ${TINGLOVCHI_ROLE.title}`);
  } else if (String(existingUser.role) !== String(role._id)) {
    existingUser.role = role._id;
    await existingUser.save();
    console.log(`  ~ ROL YANGILANDI: "${TINGLOVCHI_USER.oneIdPin}" → ${TINGLOVCHI_ROLE.title}`);
  } else {
    console.log(`  ~ SKIP: "${TINGLOVCHI_USER.oneIdPin}" allaqachon ${TINGLOVCHI_ROLE.title}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Rol       : ${TINGLOVCHI_ROLE.title} (${TINGLOVCHI_PERMISSIONS.length} section)`);
  console.log(`  Login PIN : ${TINGLOVCHI_USER.oneIdPin}`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log('\n🔑 Login: POST /api/auth  →  { "oneIdPin": "33333333333333" }\n');

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { TINGLOVCHI_ROLE, TINGLOVCHI_PERMISSIONS };

if (require.main === module) {
  main().catch((err) => {
    console.error("[MalakaTinglovchi Seed] XATO:", err.message);
    if (err.errors) {
      Object.entries(err.errors).forEach(([field, e]) => console.error(`  - ${field}: ${e.message}`));
    }
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
