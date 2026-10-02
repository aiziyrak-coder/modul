"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { MODULE_PIN_PREFIX, modulePin } = require("./_module-pins");

const dry = process.argv.includes("--dry");

const PREFIX = MODULE_PIN_PREFIX["4.7"];
const P = (slot) => modulePin(PREFIX, slot);

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const phoneByPin = new Map();
process.argv.forEach((arg, i) => {
  const raw = arg === "--phone" ? process.argv[i + 1] : arg.startsWith("--phone=") ? arg.slice(8) : null;
  if (!raw) return;
  const sep = raw.indexOf("=");
  if (sep < 1) return;
  const pin = raw.slice(0, sep).trim();
  const phone = raw.slice(sep + 1).trim();
  if (pin && phone) phoneByPin.set(pin, phone);
});

const KAFEDRA_1 = "Biologik kimyo va mikrobiologiya kafedrasi";
const KAFEDRA_2 = "Tillar kafedrasi";

const RAHBAR = "Rahbar";
const RAHBAR_XODIM = "Rahbar + Xodim";
const XODIM = "Xodim (ijrochi)";
const ADMINISTRATOR = "Administrator";

const USERS = [
  [P(1), "Alisher", "Adminov", "admin", null, null, ADMINISTRATOR],
  [P(2), "Rustam", "Rektorov", "rektor", null, "Rektor", RAHBAR],
  [P(3), "Dilshod", "Prorektorov", "prorektor", null, "Prorektor", RAHBAR_XODIM],
  [P(4), "Nodira", "Boshqarmayeva", "oquv_uslubiy_boshqarma", null, null, RAHBAR_XODIM],
  [P(5), "Sardor", "Dekanov", "dekan", KAFEDRA_1, "Dekan", RAHBAR_XODIM],
  [P(6), "Aziza", "Mudirova", "kafedra_mudiri", KAFEDRA_1, "Kafedra mudiri", RAHBAR_XODIM],
  [P(7), "Jasur", "Oqituvchiyev", "oqituvchi", KAFEDRA_1, "Dotsent", XODIM],
  [P(8), "Malika", "Oqituvchiyeva", "oqituvchi", KAFEDRA_1, "Assistent", XODIM],
  [P(9), "Bekzod", "Tilchiyev", "oqituvchi", KAFEDRA_2, "Katta o'qituvchi", XODIM],
];

async function run() {
  if (!IS_DEV_ENV) {
    throw new Error(
      `bu seed FAQAT dev/test muhitida ishlaydi (NODE_ENV="${process.env.NODE_ENV || "(o'rnatilmagan)"}").\n` +
        `        Ruxsat etilgan: ${DEV_ENVS.join(", ")}.\n` +
        `        Sabab: PIN'lar ketma-ket va taxmin qilish oson, login esa faqat PIN bilan —\n` +
        `        production'da bu admin backdoor bo'lardi.`,
    );
  }
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;

  const byTitle = async (col, titles) => {
    const docs = await db
      .collection(col)
      .find({ title: { $in: [...new Set(titles.filter(Boolean))] } })
      .project({ title: 1 })
      .toArray();
    return new Map(docs.map((d) => [d.title, d._id]));
  };

  const roles = await byTitle("roles", USERS.map((u) => u[3]));
  const depts = await byTitle("departments", USERS.map((u) => u[4]));
  const positions = await byTitle("positions", USERS.map((u) => u[5]));

  if (dry) console.log("  (DRY-RUN — DBga yozilmaydi)\n");
  console.log(
    "PIN".padEnd(16),
    "F.I.O".padEnd(22),
    "AKTYOR".padEnd(16),
    "ROL".padEnd(24),
    "KAFEDRA",
  );

  let created = 0;
  let updated = 0;
  for (const [pin, firstName, lastName, roleTitle, deptTitle, posTitle, actor] of USERS) {
    const role = roles.get(roleTitle);
    if (!role) {
      console.warn(`  [SKIP] ${pin} — rol topilmadi: "${roleTitle}"`);
      continue;
    }
    if (deptTitle && !depts.get(deptTitle)) {
      console.warn(`  [SKIP] ${pin} — kafedra topilmadi: "${deptTitle}"`);
      continue;
    }

    const doc = {
      firstName,
      lastName,
      oneIdPin: pin,
      role,
      active: true,
      ...(deptTitle ? { department: depts.get(deptTitle) } : {}),
      ...(posTitle && positions.get(posTitle) ? { position: positions.get(posTitle) } : {}),
      ...(phoneByPin.has(pin) ? { phone: phoneByPin.get(pin) } : {}),
    };

    const existing = await db.collection("users").findOne({ oneIdPin: pin }, { projection: { _id: 1 } });
    if (!dry) {
      await db.collection("users").updateOne(
        { oneIdPin: pin },
        { $set: doc, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
    }
    existing ? updated++ : created++;

    console.log(
      `  ${pin.padEnd(14)} ${`${lastName} ${firstName}`.padEnd(22)} ${actor.padEnd(16)} ` +
        `${roleTitle.padEnd(24)} ${deptTitle || "—"}` +
        (phoneByPin.has(pin) ? `  [tel: ${phoneByPin.get(pin)}]` : ""),
    );
  }

  console.log(
    `\n4.7 sinov foydalanuvchilari: ${created} yaratildi, ${updated} yangilandi` +
      (dry ? " (DRY — yozilmadi)" : "") +
      ".",
  );
  if (!phoneByPin.size) {
    console.log(
      "Telegram uchun: `node seed/task-users.seed.js --phone 47000000000007=998XXXXXXXX`\n" +
        "so'ng botga /start → \"Telefon raqamni yuborish\".",
    );
  }
  await mongoose.disconnect();
}

module.exports = { USERS };

if (require.main === module) {
  run().catch((err) => {
    console.error("4.7 sinov foydalanuvchilari seed XATO:", err.message);
    process.exit(1);
  });
}
