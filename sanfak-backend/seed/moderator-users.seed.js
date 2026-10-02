"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

const { ROLES } = require("../src/config/constants");

const dry = process.argv.includes("--dry");

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const MODERATOR_USER = {
  oneIdPin: "40100000000001",
  firstName: "Tizim",
  lastName: "Moderatori",
};

async function run() {
  if (!IS_DEV_ENV) {
    throw new Error(
      `bu seed FAQAT dev/test muhitida ishlaydi (NODE_ENV="${process.env.NODE_ENV || "(o'rnatilmagan)"}").\n` +
        `        Ruxsat etilgan: ${DEV_ENVS.join(", ")}.\n` +
        `        Sabab: PIN repoda ochiq va login faqat PIN bilan — production'da bu\n` +
        `        grant-administrator (moderator) uchun admin backdoor bo'lardi.`,
    );
  }
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");

  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `[Moderator Users Seed] MongoDB ga ulandi${dry ? "  (DRY-RUN — DBga yozilmaydi)" : ""}\n`,
  );

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");
  const UserModel = require("../src/modules/4.01-auth/user/user.model");

  const role = await RoleModel.findOne({ title: ROLES.MODERATOR });
  if (!role) {
    throw new Error(
      `"${ROLES.MODERATOR}" roli topilmadi — avval: node seed/moderator-role.seed.js`,
    );
  }

  const existing = await UserModel.findOne({ oneIdPin: MODERATOR_USER.oneIdPin });
  if (existing) {
    console.log(`  ~ SKIP       user PIN=${MODERATOR_USER.oneIdPin} allaqachon mavjud`);
  } else {
    console.log(
      `  + ${dry ? "YARATILARDI" : "YARATILDI  "} user PIN=${MODERATOR_USER.oneIdPin}  ` +
        `${MODERATOR_USER.lastName} ${MODERATOR_USER.firstName}`,
    );
    if (!dry) {
      await UserModel.create({ ...MODERATOR_USER, role: role._id, active: true });
    }
  }

  console.log(
    `\n[Moderator Users Seed] ${dry ? "DRY-RUN tugadi — hech narsa yozilmadi." : "Tayyor."}\n` +
      `  Kirish: 14 xonali PIN "${MODERATOR_USER.oneIdPin}"\n`,
  );

  await mongoose.disconnect();
}

module.exports = { MODERATOR_USER };

if (require.main === module) {
  run().catch((err) => {
    console.error("[Moderator Users Seed] XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
