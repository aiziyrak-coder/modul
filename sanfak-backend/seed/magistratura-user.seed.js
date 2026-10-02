"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { ROLES } = require("../src/config/constants");

const DRY = process.argv.includes("--dry");

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const FIXTURE = {
  oneIdPin: "40200000000012",
  firstName: "Zarina",
  lastName: "Nurmatova",
  roleTitle: ROLES.MAGISTRATURA_BOLIM,
  note: "o'quv reja zanjirining oxirgi bosqichi",
};

async function main() {
  if (!IS_DEV_ENV) {
    throw new Error(
      `bu seed FAQAT dev/test muhitida ishlaydi (NODE_ENV="${process.env.NODE_ENV || "(o'rnatilmagan)"}").\n` +
        `        Ruxsat etilgan: ${DEV_ENVS.join(", ")}.\n` +
        `        Sabab: PIN ketma-ket va taxmin qilish oson, login esa faqat PIN bilan —\n` +
        `        production'da bu admin backdoor bo'lardi.`,
    );
  }

  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `[MagistraturaUser Seed] MongoDB ga ulandi${DRY ? "  —  🔍 DRY-RUN (hech narsa yozilmaydi)" : ""}\n`,
  );

  const User = require("../src/modules/4.01-auth/user/user.model");
  const Role = require("../src/modules/4.01-auth/role/role.model");

  const role = await Role.findOne({ title: FIXTURE.roleTitle }).select("_id scopeLevel").lean();
  if (!role) {
    console.error(
      `  ✖ TO'XTATILDI: rol topilmadi — "${FIXTURE.roleTitle}".\n` +
        "    Avval: node seed/residency-roles.seed.js",
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const existing = await User.findOne({ oneIdPin: FIXTURE.oneIdPin });
  if (existing) {
    console.log(
      `  ~ SKIP  ${FIXTURE.oneIdPin}  allaqachon bor (${existing.firstName} ${existing.lastName}) — tegilmadi`,
    );
  } else {
    console.log(
      `  + ${DRY ? "YARATILADI" : "YARATILDI"}  ${FIXTURE.oneIdPin}  ${FIXTURE.roleTitle}  ` +
        `${FIXTURE.firstName} ${FIXTURE.lastName}  (global scope)  · ${FIXTURE.note}`,
    );
    if (!DRY) {
      await User.create({
        oneIdPin: FIXTURE.oneIdPin,
        firstName: FIXTURE.firstName,
        lastName: FIXTURE.lastName,
        role: role._id,
        department: null,
        active: true,
        stake: 1,
      });
    }
  }

  console.log(`\nRUN: node seed/magistratura-user.seed.js\n`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[MagistraturaUser Seed] XATO:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
