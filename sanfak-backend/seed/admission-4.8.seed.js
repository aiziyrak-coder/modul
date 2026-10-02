"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const CRUD = [
  ACTIONS.CREATE,
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
  ACTIONS.DELETE,
  ACTIONS.SEARCH,
  ACTIONS.FILTER,
];

const ADMISSION_SECTIONS = [
  {
    section: MODULES.INTERNATIONAL_ADMISSION,
    actionKeys: [...CRUD, ACTIONS.APPROVE, ACTIONS.REJECT, ACTIONS.EXPORT],
  },
  { section: MODULES.ADMISSION_SEASON, actionKeys: [...CRUD, ACTIONS.CHANGE_STATUS] },
  { section: MODULES.ADMISSION_DIRECTION, actionKeys: CRUD },
  { section: MODULES.ADMISSION_EDUCATION_FORM, actionKeys: CRUD },
  { section: MODULES.ADMISSION_EDUCATION_LANGUAGE, actionKeys: CRUD },
  { section: MODULES.ADMISSION_COUNTRY, actionKeys: CRUD },
  {
    section: MODULES.ADMISSION_OFFER,
    actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE],
  },
  {
    section: MODULES.ADMISSION_MESSAGE,
    actionKeys: [
      ACTIONS.CREATE,
      ACTIONS.READ,
      ACTIONS.READ_ALL,
      ACTIONS.SEARCH,
      ACTIONS.FILTER,
      ACTIONS.EXPORT,
    ],
  },
];

const SUPPORT_SECTIONS = [
  { section: MODULES.AUTH, actionKeys: [ACTIONS.READ] },
  {
    section: MODULES.ACADEMIC_YEAR,
    actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL],
  },
];

const MANAGED_SECTION_NAMES = new Set(
  [...ADMISSION_SECTIONS, ...SUPPORT_SECTIONS].map((s) => s.section),
);

const TEST_USER = {
  oneIdPin: "qabul_xodim",
  firstName: "Dilnoza",
  lastName: "Yusupova",
  email: "dilnoza@platform.uz",
  phone: "+998901234569",
};

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("✓ MongoDB:", process.env.MONGO_HOST);

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");
  const UserModel = require("../src/modules/4.01-auth/user/user.model");

  let role = await RoleModel.findOne({ title: ROLES.QABUL_BOLIMI });

  if (!role) {
    role = await RoleModel.create({
      title: ROLES.QABUL_BOLIMI,
      desc: "Xalqaro qabul bo'limi xodimi — arizalarni ko'rib chiqish (4.8)",
      scopeLevel: "global",
      isSystem: false,
      active: true,
      permissions: [...ADMISSION_SECTIONS, ...SUPPORT_SECTIONS],
    });
    console.log(`  + rol yaratildi: ${ROLES.QABUL_BOLIMI}`);
  } else {
    const others = (role.permissions || []).filter(
      (p) => !MANAGED_SECTION_NAMES.has(p.section),
    );
    role.permissions = [...others, ...ADMISSION_SECTIONS, ...SUPPORT_SECTIONS];
    role.active = true;
    await role.save();
    console.log(
      `  ~ rol yangilandi: ${ROLES.QABUL_BOLIMI} ` +
        `(boshqa ${others.length} ta bo'lim saqlandi)`,
    );
  }

  if (!IS_DEV_ENV) {
    console.log(
      `  ~ SKIP sinov foydalanuvchisi — NODE_ENV="${process.env.NODE_ENV || "(o'rnatilmagan)"}" ` +
        `${DEV_ENVS.join("/")} ro'yxatida yo'q (kutilgan: production'da user yaratilmaydi).`,
    );
  } else {
    const existing = await UserModel.findOne({ oneIdPin: TEST_USER.oneIdPin });
    if (!existing) {
      await UserModel.create({ ...TEST_USER, role: role._id, active: true });
      console.log(`  + user yaratildi: PIN="${TEST_USER.oneIdPin}"`);
    } else {
      existing.role = role._id;
      existing.active = true;
      await existing.save();
      console.log(`  ~ user yangilandi: PIN="${TEST_USER.oneIdPin}"`);
    }
  }

  console.log(`
══════════════════════════════════════════════════════
  4.8 TAYYOR — sinov uchun:

  POST /api/auth   { "oneIdPin": "${TEST_USER.oneIdPin}" }

  Rol:      ${ROLES.QABUL_BOLIMI}
  Ruxsat:
${ADMISSION_SECTIONS.map((s) => `    · ${s.section.padEnd(30)} ${s.actionKeys.join(", ")}`).join("\n")}
══════════════════════════════════════════════════════
`);

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { ADMISSION_SECTIONS, SUPPORT_SECTIONS, MANAGED_SECTION_NAMES, TEST_USER };

if (require.main === module) {
  main().catch((err) => {
    console.error("\n[4.8 SEED ERROR]", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
