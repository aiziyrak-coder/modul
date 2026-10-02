"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[Migrate group→groups] Connected");

  const collection = mongoose.connection.db.collection("permissions");

  const haveOldGroup = await collection.countDocuments({
    group: { $exists: true, $ne: null },
  });

  console.log(`[Migrate] Eski "group" field'i bor: ${haveOldGroup} ta`);

  if (haveOldGroup === 0) {
    console.log("[Migrate] Migratsiya kerak emas — barcha yozuvlar tayyor");
    await mongoose.disconnect();
    process.exit(0);
  }

  const cursor = collection.find({
    group: { $exists: true, $ne: null },
  });

  let migrated = 0;
  let skipped = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();

    const existingGroups = (doc.groups || []).map((g) => String(g));
    const oldGroupStr = String(doc.group);

    if (existingGroups.includes(oldGroupStr)) {
      await collection.updateOne(
        { _id: doc._id },
        { $unset: { group: "" } },
      );
      skipped++;
    } else {
      await collection.updateOne(
        { _id: doc._id },
        {
          $addToSet: { groups: doc.group },
          $unset: { group: "" },
        },
      );
      migrated++;
    }
  }

  const stillHaveOldGroup = await collection.countDocuments({
    group: { $exists: true },
  });
  const haveGroupsArray = await collection.countDocuments({
    groups: { $exists: true, $ne: [] },
  });

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  Migrated:        ${migrated}`);
  console.log(`  Skipped (mavjud): ${skipped}`);
  console.log(`  Eski group qoldi: ${stillHaveOldGroup}`);
  console.log(`  Yangi groups[] bor: ${haveGroupsArray}`);
  console.log("═══════════════════════════════════════════════════\n");

  if (stillHaveOldGroup === 0) {
    console.log("✅ Migratsiya muvaffaqiyatli yakunlandi");
  } else {
    console.warn(`⚠ Hali ${stillHaveOldGroup} ta yozuvda eski "group" field qoldi`);
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error("[Migrate] ERROR:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});
