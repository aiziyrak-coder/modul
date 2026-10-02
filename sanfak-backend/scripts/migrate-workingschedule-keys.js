"use strict";

require("dotenv").config();
const mongoose = require("mongoose");

const DRY = process.argv.includes("--dry");

(async () => {
  const uri = process.env.MONGO_HOST;
  if (!uri) {
    console.error("XATO: MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const schedules = await db.collection("workingschedules").find({}).toArray();
  console.log(`workingschedules: ${schedules.length} ta`);
  console.log(DRY ? "REJIM: --dry (yozilmaydi)\n" : "REJIM: YOZISH\n");

  let changed = 0;
  let skipped = 0;
  let untouched = 0;

  for (const ws of schedules) {
    const label = `${String(ws._id)}  "${(ws.title || "").slice(0, 45)}"`;

    if (!ws.learningProcess) {
      console.log(`  SKIP  ${label} — learningProcess bog'lanmagan`);
      skipped += 1;
      continue;
    }

    const lp = await db
      .collection("learningprocesses")
      .findOne({ _id: ws.learningProcess });

    if (!lp) {
      console.log(`  SKIP  ${label} — learningProcess topilmadi`);
      skipped += 1;
      continue;
    }

    const sourceKeys = (lp.keys || []).map(({ key, title }) => ({ key, title }));
    const currentKeys = ws.keys || [];
    const missingKeys = sourceKeys.filter(
      (sk) => !currentKeys.some((ck) => ck.key === sk.key),
    );

    const sourceLpKeys = lp.learningProcess?.keys || [];
    const currentLpKeys = ws.learningProcessData?.keys || [];
    const missingLpKeys = sourceLpKeys
      .filter((sk) => !currentLpKeys.some((ck) => ck.key === sk.key))
      .map((k) => ({
        key: k.key,
        title: k.title,
        week: 0,
        semester: k.semester ?? null,
      }));

    if (missingKeys.length === 0 && missingLpKeys.length === 0) {
      untouched += 1;
      continue;
    }

    console.log(`  O'ZGARADI  ${label}`);
    if (missingKeys.length) {
      console.log(
        `      keys: ${currentKeys.length} → ${currentKeys.length + missingKeys.length}` +
          `  (+ ${missingKeys.map((k) => `"${k.key}"=${k.title}`).join(", ")})`,
      );
    }
    if (missingLpKeys.length) {
      console.log(
        `      learningProcessData.keys: ${currentLpKeys.length} → ${currentLpKeys.length + missingLpKeys.length}` +
          `  (+ ${missingLpKeys.map((k) => `"${k.key}" week:0`).join(", ")})`,
      );
    }

    if (!DRY) {
      const set = {};
      if (missingKeys.length) set.keys = [...currentKeys, ...missingKeys];
      if (missingLpKeys.length) {
        set["learningProcessData.keys"] = [...currentLpKeys, ...missingLpKeys];
      }
      await db
        .collection("workingschedules")
        .updateOne({ _id: ws._id }, { $set: set });
    }
    changed += 1;
  }

  console.log(
    `\nXULOSA: o'zgaradi=${changed}  tegilmadi=${untouched}  skip=${skipped}`,
  );
  if (DRY && changed > 0) {
    console.log("Yozish uchun `--dry` siz qayta ishga tushiring (avval zaxira!).");
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
