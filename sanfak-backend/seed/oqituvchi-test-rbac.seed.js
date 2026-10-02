"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

const OQITUVCHI_ROLE = ROLES.MALAKA_OQITUVCHI;
const CRUD = [
  ACTIONS.CREATE,
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
  ACTIONS.DELETE,
  ACTIONS.SEARCH,
  ACTIONS.FILTER,
];

const ADD = [
  { section: MODULES.QUAL_ACCESS_TEST, actionKeys: CRUD },
  { section: MODULES.QUAL_EXIT_TEST, actionKeys: CRUD },
  {
    section: MODULES.QUAL_TEST_CONFIG,
    actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.SEARCH, ACTIONS.FILTER, ACTIONS.UPDATE],
  },
];
const ADD_SECTIONS = new Set(ADD.map((p) => p.section));

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("✓ MongoDB:", process.env.MONGO_HOST);

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");
  const role = await RoleModel.findOne({ title: OQITUVCHI_ROLE });
  if (!role) throw new Error(`${OQITUVCHI_ROLE} roli topilmadi`);

  const others = (role.permissions || []).filter((p) => !ADD_SECTIONS.has(p.section));
  role.permissions = [...others, ...ADD];
  await role.save();

  console.log(
    `  ~ rol yangilandi: ${OQITUVCHI_ROLE} ` +
      `(boshqa ${others.length} ta bo'lim saqlandi, +${ADD.length} qo'shildi)`,
  );
  console.log(
    "    · qualAccessTest [create,read,readAll,update,delete,search,filter]\n" +
      "    · qualExitTest   [create,read,readAll,update,delete,search,filter]\n" +
      "    · qualTestConfig [read,readAll,search,filter,update]",
  );
  console.log("\n⚠️ Qayta login SHART EMAS — permit() har so'rovda DB'дан yangi rolni o'qiydi.");

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { ADD, OQITUVCHI_ROLE };

if (require.main === module) {
  main().catch((err) => {
    console.error("\n[OQITUVCHI TEST RBAC SEED ERROR]", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
