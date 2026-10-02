"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("✓ MongoDB:", process.env.MONGO_HOST);

  const RoleModel  = require("../src/modules/4.01-auth/role/role.model");
  const UserModel  = require("../src/modules/4.01-auth/user/user.model");

  console.log("\n── Rollar ──────────────────────────────────────────");

  const rolesDef = [
    {
      title: ROLES.SUPER_ADMIN,
      desc: "Super administrator — barcha modullarga to'liq kirish huquqi (bypass)",
      scopeLevel: "global",
      isSystem: true,
      active: true,
      permissions: [],
    },
    {
      title: ROLES.QABUL_BOLIMI,
      desc: "Xalqaro qabul bo'limi xodimi — arizalar bilan ishlash",
      scopeLevel: "global",
      isSystem: false,
      active: true,
      permissions: [
        {
          section: MODULES.INTERNATIONAL_ADMISSION,
          actionKeys: [
            ACTIONS.CREATE,
            ACTIONS.READ,
            ACTIONS.READ_ALL,
            ACTIONS.UPDATE,
            ACTIONS.CHANGE_STATUS,
            ACTIONS.DELETE,
          ],
        },
        {
          section: MODULES.AUTH,
          actionKeys: [ACTIONS.READ],
        },
      ],
    },
    {
      title: ROLES.REKTOR,
      desc: "Rahbariyat — xalqaro qabul statistikasini ko'rish",
      scopeLevel: "global",
      isSystem: false,
      active: true,
      permissions: [
        {
          section: MODULES.INTERNATIONAL_ADMISSION,
          actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL],
        },
        {
          section: MODULES.AUTH,
          actionKeys: [ACTIONS.READ],
        },
      ],
    },
  ];

  const createdRoles = {};

  for (const def of rolesDef) {
    const existing = await RoleModel.findOne({ title: def.title });
    if (!existing) {
      const role = await RoleModel.create(def);
      createdRoles[def.title] = role._id;
      console.log(`  + yaratildi: ${def.title}`);
    } else {
      existing.desc = def.desc;
      existing.scopeLevel = def.scopeLevel;
      existing.isSystem = def.isSystem;
      existing.active = def.active;
      existing.permissions = def.permissions;
      await existing.save();
      createdRoles[def.title] = existing._id;
      console.log(`  ~ yangilandi: ${def.title}`);
    }
  }

  console.log("\n── Foydalanuvchilar ─────────────────────────────────");

  const usersDef = [
    {
      oneIdPin:  "admin",
      firstName: "Admin",
      lastName:  "Superuser",
      email:     "admin@platform.uz",
      phone:     "+998901234567",
      roleTitle: ROLES.SUPER_ADMIN,
    },
    {
      oneIdPin:  "test_super_admin",
      firstName: "Super",
      lastName:  "Admin",
      email:     "super@platform.uz",
      phone:     "+998901234568",
      roleTitle: ROLES.SUPER_ADMIN,
    },
    {
      oneIdPin:  "qabul_xodim",
      firstName: "Dilnoza",
      lastName:  "Yusupova",
      email:     "dilnoza@platform.uz",
      phone:     "+998901234569",
      roleTitle: ROLES.QABUL_BOLIMI,
    },
    {
      oneIdPin:  "rahbar",
      firstName: "Sardor",
      lastName:  "Xolmatov",
      email:     "sardor@platform.uz",
      phone:     "+998901234570",
      roleTitle: ROLES.REKTOR,
    },
  ];

  for (const def of usersDef) {
    const roleId = createdRoles[def.roleTitle];
    if (!roleId) {
      console.log(`  ✗ ${def.oneIdPin} — rol topilmadi: ${def.roleTitle}`);
      continue;
    }

    const userData = {
      oneIdPin:  def.oneIdPin,
      firstName: def.firstName,
      lastName:  def.lastName,
      email:     def.email,
      phone:     def.phone,
      role:      roleId,
      active:    true,
    };

    const existing = await UserModel.findOne({ oneIdPin: def.oneIdPin });
    if (!existing) {
      await UserModel.create(userData);
      console.log(`  + yaratildi: PIN="${def.oneIdPin}" → ${def.roleTitle}`);
    } else {
      Object.assign(existing, userData);
      await existing.save();
      console.log(`  ~ yangilandi: PIN="${def.oneIdPin}" → ${def.roleTitle}`);
    }
  }

  console.log(`
══════════════════════════════════════════════════════
  SETUP TUGADI — quyidagi PIN'lar bilan login qiling:
══════════════════════════════════════════════════════

  POST http://localhost:4000/api/auth
  Content-Type: application/json

  ┌─────────────────────┬──────────────────────────────────────┐
  │ oneIdPin            │ Rol va ruxsatlar                     │
  ├─────────────────────┼──────────────────────────────────────┤
  │ admin               │ super_admin (HAMMAGA ruxsat, bypass) │
  │ test_super_admin    │ super_admin (HAMMAGA ruxsat, bypass) │
  │ qabul_xodim         │ qabul_bolimi (ariza CRUD + holat)    │
  │ rahbar              │ rahbariyat (faqat ko'rish)           │
  └─────────────────────┴──────────────────────────────────────┘

  Frontend: http://localhost:5173
  Backend:  http://localhost:4000
  Swagger:  http://localhost:4000/api-docs
══════════════════════════════════════════════════════
`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n[SETUP ERROR]", err.message);
  if (err.errors) {
    Object.entries(err.errors).forEach(([field, e]) =>
      console.error(`  - ${field}: ${e.message}`)
    );
  }
  mongoose.disconnect().finally(() => process.exit(1));
});
