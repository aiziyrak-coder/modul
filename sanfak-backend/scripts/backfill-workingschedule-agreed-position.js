"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const WRONG = "Oʻquy ishlari boʻyicha prorektor";
const RIGHT = "Oʻquv ishlari boʻyicha prorektor";

const WRITE = process.argv.includes("--write");
const DRY = !WRITE;

(async () => {
  const uri = process.env.MONGO_HOST;
  if (!uri) {
    console.error("XATO: MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection("workingschedules");

  console.log(
    `REJIM: ${WRITE ? "YOZISH (--write)" : "DRY (yozilmaydi)"}  ·  baza: ${mongoose.connection.name}\n`,
  );

  const filter = { "agreed.position": WRONG };
  const candidates = await col
    .find(filter)
    .project({ _id: 1, status: 1, year: 1, deletedAt: 1 })
    .toArray();
  const total = await col.countDocuments({});

  console.log(`workingschedules jami                    : ${total}`);
  console.log(`  agreed.position = "${WRONG}" (nomzod): ${candidates.length}\n`);

  if (!candidates.length) {
    console.log("Hech narsa tuzatilmaydi — xato matn topilmadi.\n");
    await mongoose.disconnect();
    return;
  }

  for (const ws of candidates) {
    console.log(
      `  ✍ ${DRY ? "YOZILARDI" : "YOZILDI  "} ${String(ws._id)} · ${String(ws.year || "—").padEnd(9)} · ${String(ws.status || "—").padEnd(10)}${ws.deletedAt ? " · (soft-deleted)" : ""}`,
    );
  }

  let modified = 0;
  if (!DRY) {
    const r = await col.updateMany(filter, { $set: { "agreed.position": RIGHT } });
    modified = r.modifiedCount;
  }

  console.log(
    `\nYAKUN: nomzod ${candidates.length} · ${DRY ? "yozilmadi (DRY)" : `yozildi ${modified}`}\n`,
  );
  await mongoose.disconnect();
})().catch((err) => {
  console.error("XATO:", err.message);
  process.exit(1);
});
