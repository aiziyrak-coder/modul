"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

const RoleModel = require("../src/modules/4.01-auth/role/role.model");
const UserModel = require("../src/modules/4.01-auth/user/user.model");

const MALAKA_OQITUVCHI = "malaka_oqituvchi";

const TEACHER_PERMISSIONS = [
  { section: MODULES.QUAL_COURSE, actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL] },
  { section: MODULES.QUAL_TOPIC, actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL] },
  {
    section: MODULES.QUAL_SOURCE,
    actionKeys: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE, ACTIONS.DELETE],
  },
  { section: MODULES.QUAL_COURSE_SUBSCRIPTION, actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL] },
  {
    section: MODULES.QUAL_ACCESS_TEST_RESULT,
    actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.DELETE],
  },
  {
    section: MODULES.QUAL_EXIT_TEST_RESULT,
    actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.DELETE],
  },
  { section: MODULES.QUAL_FINAL_TEST_RESULT, actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL] },
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
    section: MODULES.QUAL_TOPIC_COMPLETION,
    actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE],
  },
  { section: MODULES.QUAL_TEACHER, actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL] },
  {
    section: MODULES.QUAL_TOPIC_LECTURE,
    actionKeys: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE, ACTIONS.DELETE],
  },
  {
    section: MODULES.QUAL_TOPIC_PRACTICAL,
    actionKeys: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE, ACTIONS.DELETE],
  },
  {
    section: MODULES.QUAL_TOPIC_VIDEO,
    actionKeys: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE, ACTIONS.DELETE],
  },
  {
    section: MODULES.QUAL_TOPIC_SCENARIO,
    actionKeys: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE, ACTIONS.DELETE],
  },
  {
    section: MODULES.QUAL_TOPIC_FINAL_TEST,
    actionKeys: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE, ACTIONS.DELETE],
  },
  {
    section: MODULES.CHAT,
    actionKeys: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.DELETE],
  },
];

const TEACHER_ROLE = {
  title: MALAKA_OQITUVCHI,
  desc: "Malaka oshirish o'qituvchisi — o'z kurslari, manba, testlar va o'zlashtirishni ko'radi/boshqaradi",
  scopeLevel: "global",
  isSystem: false,
  active: true,
  permissions: TEACHER_PERMISSIONS,
};

const TEACHER_USER = {
  oneIdPin: "22222222222222",
  firstName: "Malaka",
  lastName: "Oqituvchi",
  middleName: "Testovich",
  email: "malaka.oqituvchi@test.uz",
  phone: "+998901112202",
};

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[MalakaTeacher Seed] MongoDB ga ulandi\n");

  console.log("── 1. Rol: malaka_oqituvchi ───────────────────────────────────");
  let role = await RoleModel.findOne({ title: TEACHER_ROLE.title });

  if (!role) {
    role = await RoleModel.create(TEACHER_ROLE);
    console.log(
      `  + YARATILDI: "${TEACHER_ROLE.title}" (${TEACHER_ROLE.scopeLevel}) — ${TEACHER_PERMISSIONS.length} section`,
    );
  } else {
    role.permissions = TEACHER_PERMISSIONS;
    role.active = true;
    await role.save();
    console.log(`  ~ YANGILANDI: "${TEACHER_ROLE.title}" permissionlari kanonik to'plamga tenglandi (${TEACHER_PERMISSIONS.length} section)`);
  }

  console.log("\n── 2. Revert: oqituvchi rolidan 4.04 ruxsatlari ───────────────");
  const teacherSections = new Set(TEACHER_PERMISSIONS.map((p) => p.section));
  const oqituvchi = await RoleModel.findOne({ title: ROLES.OQITUVCHI });

  if (!oqituvchi) {
    console.log("  ~ SKIP: 'oqituvchi' roli topilmadi");
  } else {
    const before = (oqituvchi.permissions || []).length;
    const kept = (oqituvchi.permissions || []).filter((p) => !teacherSections.has(p.section));
    if (kept.length !== before) {
      oqituvchi.permissions = kept;
      await oqituvchi.save();
      console.log(`  - OLIB TASHLANDI: ${before - kept.length} ta 4.04 section 'oqituvchi' rolidan (endi ${kept.length} section)`);
    } else {
      console.log("  ~ SKIP: 'oqituvchi' rolida 4.04 section yo'q — toza");
    }
  }

  console.log("\n── 3. Test o'qituvchi foydalanuvchi ───────────────────────────");
  const existingUser = await UserModel.findOne({ oneIdPin: TEACHER_USER.oneIdPin });

  if (!existingUser) {
    await UserModel.create({
      oneIdPin: TEACHER_USER.oneIdPin,
      firstName: TEACHER_USER.firstName,
      lastName: TEACHER_USER.lastName,
      middleName: TEACHER_USER.middleName,
      email: TEACHER_USER.email,
      phone: TEACHER_USER.phone,
      role: role._id,
      active: true,
    });
    console.log(`  + YARATILDI: "${TEACHER_USER.oneIdPin}" → ${TEACHER_ROLE.title}`);
  } else if (String(existingUser.role) !== String(role._id)) {
    existingUser.role = role._id;
    await existingUser.save();
    console.log(`  ~ ROL YANGILANDI: "${TEACHER_USER.oneIdPin}" → ${TEACHER_ROLE.title}`);
  } else {
    console.log(`  ~ SKIP: "${TEACHER_USER.oneIdPin}" allaqachon ${TEACHER_ROLE.title}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Rol       : ${TEACHER_ROLE.title} (${TEACHER_PERMISSIONS.length} section)`);
  console.log(`  Login PIN : ${TEACHER_USER.oneIdPin}`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log('\n🔑 Login: POST /api/auth  →  { "oneIdPin": "22222222222222" }\n');

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { TEACHER_ROLE, TEACHER_PERMISSIONS };

if (require.main === module) {
  main().catch((err) => {
    console.error("[MalakaTeacher Seed] XATO:", err.message);
    if (err.errors) {
      Object.entries(err.errors).forEach(([field, e]) => console.error(`  - ${field}: ${e.message}`));
    }
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
