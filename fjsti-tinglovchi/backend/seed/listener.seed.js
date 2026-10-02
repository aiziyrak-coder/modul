"use strict";

require("dotenv").config();
const mongoose = require("mongoose");
const { LISTENER_ROLE_TITLE } = require("../src/config/constants");

const PIN = process.argv[2] || "77777777777777";
const FULL_NAME = process.argv[3] || "Yo'ldoshev Sanjar Baxtiyorovich";
const LISTENER_ID_ARG = process.argv[4] || null;

const URI = process.env.MONGO_HOST;
const DB = process.env.LISTENER_DB || "listener-db";

function splitName(full) {
  const p = String(full || "").trim().split(/\s+/).filter(Boolean);
  return {
    lastName: p[0] || null,
    firstName: p[1] || null,
    middleName: p.slice(2).join(" ") || null,
  };
}

async function main() {
  if (!/^\d{14}$/.test(PIN)) throw new Error("PIN 14 ta raqamdan iborat bo'lishi kerak");
  if (!URI) throw new Error("MONGO_HOST (.env) sozlanmagan");
  if (LISTENER_ID_ARG && !/^[a-f\d]{24}$/i.test(LISTENER_ID_ARG)) {
    throw new Error("listenerId 24 belgili hex bo'lishi kerak");
  }

  const conn = await mongoose.createConnection(URI).asPromise();
  const db = conn.useDb(DB, { useCache: true }).db;
  const col = db.collection("listeners");

  const mavjud = await col.findOne({ passport: PIN });
  const listenerId =
    LISTENER_ID_ARG || (mavjud && mavjud.listenerId) || String(new mongoose.Types.ObjectId());

  const res = await col.updateOne(
    { passport: PIN },
    {
      $set: {
        passport: PIN,
        fullName: FULL_NAME,
        role: LISTENER_ROLE_TITLE,
        listenerId,
        userId: listenerId,
        active: true,
        ...splitName(FULL_NAME),
        updatedAt: new Date(),
      },
      $setOnInsert: { loginCount: 0, lastLoginAt: null, createdAt: new Date() },
    },
    { upsert: true },
  );

  console.log(`Baza: ${db.databaseName}`);
  console.log(res.upsertedCount ? "+ YARATILDI" : "~ YANGILANDI");
  console.log("═".repeat(56));
  console.log(`  F.I.SH     : ${FULL_NAME}`);
  console.log(`  Login PIN  : ${PIN}`);
  console.log(`  Roli       : ${LISTENER_ROLE_TITLE}`);
  console.log(`  listenerId : ${listenerId}${LISTENER_ID_ARG ? "  (berilgan)" : "  (yangi hosil qilindi)"}`);
  console.log("═".repeat(56));
  console.log(`  Kirish: POST /api/auth  →  { "oneIdPin": "${PIN}" }`);
  console.log("═".repeat(56));

  const jami = await col.countDocuments();
  console.log(`Bazadagi jami tinglovchilar: ${jami}`);

  await conn.close();
}

main().catch((err) => {
  console.error("\n[TINGLOVCHI SEED XATO]", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
