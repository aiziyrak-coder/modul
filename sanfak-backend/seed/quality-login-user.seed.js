const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

const RoleModel = require("../src/modules/4.01-auth/role/role.model");
const UserModel = require("../src/modules/4.01-auth/user/user.model");

const ROLE_TITLE = "talim_sifati_nazorati";
const LOGIN = {
  oneIdPin: "41200000000012",
  firstName: "Sifat",
  lastName: "Nazoratchi",
  middleName: "Test",
};

async function run() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[QA login] ulandi:", process.env.MONGO_HOST);

  const role = await RoleModel.findOne({ title: ROLE_TITLE });
  if (!role) {
    throw new Error(
      `Rol topilmadi: "${ROLE_TITLE}" — avval: node seed/quality-assurance-roles.seed.js`,
    );
  }

  const existing = await UserModel.findOne({ oneIdPin: LOGIN.oneIdPin });
  if (existing) {
    existing.role = role._id;
    existing.active = true;
    await existing.save();
    console.log(`  [user] mavjud "${LOGIN.oneIdPin}" → rol=${ROLE_TITLE}, active=true`);
  } else {
    await UserModel.create({
      oneIdPin: LOGIN.oneIdPin,
      firstName: LOGIN.firstName,
      lastName: LOGIN.lastName,
      middleName: LOGIN.middleName,
      role: role._id,
      active: true,
    });
    console.log(`  [user] YARATILDI "${LOGIN.oneIdPin}" → ${ROLE_TITLE}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Rol       : ${ROLE_TITLE}`);
  console.log(`  Login PIN : ${LOGIN.oneIdPin}`);
  console.log('  Kirish    : POST /api/auth  →  { "oneIdPin": "41200000000012" }');
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[QA login] XATO:", err);
  process.exit(1);
});
