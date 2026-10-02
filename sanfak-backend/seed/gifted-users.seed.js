"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { MODULE_PIN_PREFIX, modulePin } = require("./_module-pins");

const dry = process.argv.includes("--dry");

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const PREFIX = MODULE_PIN_PREFIX["4.11"];
const P = (slot) => modulePin(PREFIX, slot);

const USERS = [
  [P(1), "Sardor", "Aliyev", "talaba", "Talaba (o'z profili)"],
  [P(2), "Nilufar", "Karimova", "iqtidorli_bolim", "Bo'lim xodimi"],
  [P(3), "Otabek", "Hakamov", "hakam", "Hakam 1 (baholagan)"],
  [P(4), "Zarina", "Hakamova", "hakam", "Hakam 2 (kutmoqda)"],
  [P(5), "Jasur", "Oqituvchiyev", "oqituvchi", "Maslahatchi (advisor)"],
  [P(6), "Bahodir", "Prorektorov", "prorektor", "Rahbariyat (hisobot)"],
  [P(7), "Umid", "Rektorov", "rektor", "Rahbariyat (hisobot)"],
];

async function run() {
  if (!IS_DEV_ENV) {
    throw new Error(
      `bu seed FAQAT dev/test muhitida ishlaydi (NODE_ENV="${process.env.NODE_ENV || "(o'rnatilmagan)"}").\n` +
        `        Ruxsat etilgan: ${DEV_ENVS.join(", ")}.\n` +
        `        Sabab: PIN'lar ketma-ket va taxmin qilish oson, login esa faqat PIN bilan —\n` +
        `        production'da bu backdoor bo'lardi.`,
    );
  }
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;

  const roleDocs = await db
    .collection("roles")
    .find({ title: { $in: [...new Set(USERS.map((u) => u[3]))] } })
    .project({ title: 1 })
    .toArray();
  const roles = new Map(roleDocs.map((d) => [d.title, d._id]));

  if (dry) console.log("  (DRY-RUN — DBga yozilmaydi)\n");
  console.log("PIN".padEnd(16), "F.I.O".padEnd(22), "ROL".padEnd(18), "IZOH");

  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const [pin, firstName, lastName, roleTitle, note] of USERS) {
    const role = roles.get(roleTitle);
    if (!role) {
      console.warn(`  [SKIP] ${pin} — rol topilmadi: "${roleTitle}" (avval gifted-roles.seed.js)`);
      skipped += 1;
      continue;
    }

    const doc = { firstName, lastName, oneIdPin: pin, role, active: true };

    const existing = await db
      .collection("users")
      .findOne({ oneIdPin: pin }, { projection: { _id: 1 } });
    if (!dry) {
      await db
        .collection("users")
        .updateOne(
          { oneIdPin: pin },
          { $set: doc, $setOnInsert: { createdAt: new Date() } },
          { upsert: true },
        );
    }
    existing ? (updated += 1) : (created += 1);

    console.log(
      `  ${pin.padEnd(14)} ${`${lastName} ${firstName}`.padEnd(22)} ${roleTitle.padEnd(18)} ${note}`,
    );
  }

  console.log(
    `\n4.11 sinov foydalanuvchilari: ${created} yaratildi, ${updated} yangilandi` +
      (skipped ? `, ${skipped} o'tkazildi` : "") +
      (dry ? " (DRY — yozilmadi)" : "") +
      ".",
  );
  await mongoose.disconnect();
}

module.exports = { USERS };

if (require.main === module) {
  run().catch((err) => {
    console.error("4.11 sinov foydalanuvchilari seed XATO:", err.message);
    process.exit(1);
  });
}
