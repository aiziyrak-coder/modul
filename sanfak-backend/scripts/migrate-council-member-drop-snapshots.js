"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const DRY = !WRITE;

const COLLECTION = "councilmembers";
const FILTER = {
  $or: [{ position: { $exists: true } }, { academicTitle: { $exists: true } }],
};

const log = (...a) => console.log(...a);
const err = (...a) => console.error("✗", ...a);

async function main() {
  const uri = process.env.MONGO_HOST;
  if (!uri) throw new Error("MONGO_HOST topilmadi (.env)");

  log(
    `\n═══ 4.09: councilMember snapshot maydonlarini tozalash ═══${
      DRY ? "  [DRY-RUN]" : "  [WRITE]"
    }`,
  );

  await mongoose.connect(uri);
  log(`✓ Ulanildi: ${uri}`);
  const coll = mongoose.connection.db.collection(COLLECTION);

  const total = await coll.countDocuments({});
  const affected = await coll.countDocuments(FILTER);
  log(`\nJami a'zolar: ${total}`);
  log(`Eski maydon qolgan hujjatlar: ${affected}`);

  if (affected === 0) {
    log("\n✓ Tozalash kerak emas — hech qaysi hujjatda eski maydon yo'q.");
    await mongoose.disconnect();
    process.exit(0);
  }

  const byTitle = await coll
    .aggregate([
      { $match: { academicTitle: { $exists: true } } },
      { $group: { _id: "$academicTitle", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
  if (byTitle.length) {
    log("\nQolgan `academicTitle` qiymatlari:");
    byTitle.forEach((g) => log(`  - ${JSON.stringify(g._id)}: ${g.count} ta`));
  }

  const byPosition = await coll
    .aggregate([
      { $match: { position: { $exists: true } } },
      { $group: { _id: "$position", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ])
    .toArray();
  if (byPosition.length) {
    log("\nQolgan `position` qiymatlari (eng ko'p 15 ta):");
    byPosition.forEach((g) => log(`  - ${JSON.stringify(g._id)}: ${g.count} ta`));
  }

  const withoutUserTitle = await coll
    .aggregate([
      { $match: { academicTitle: { $exists: true } } },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "u",
        },
      },
      { $match: { "u.academicTitle": { $in: [null, undefined] } } },
      { $count: "n" },
    ])
    .toArray();
  const orphan = withoutUserTitle[0]?.n ?? 0;
  if (orphan > 0) {
    log(
      `\n⚠️  ${orphan} ta a'zoning user profilida ilmiy unvon YO'Q — tozalashdan keyin` +
        `\n    ular jadvalda "—" bo'lib ko'rinadi. Avval Admin → Foydalanuvchilar` +
        `\n    orqali unvonni to'ldiring (eski snapshot qiymati baribir ishonchsiz).`,
    );
  }

  if (DRY) {
    log(
      `\n[DRY-RUN] Bajariladigan amal: db.${COLLECTION}.updateMany(` +
        `${JSON.stringify(FILTER)}, { $unset: { position: "", academicTitle: "" } })`,
    );
    log("Hech narsa yozilmadi. Haqiqiy tozalash uchun: --write");
    await mongoose.disconnect();
    process.exit(0);
  }

  const res = await coll.updateMany(FILTER, {
    $unset: { position: "", academicTitle: "" },
  });
  log(
    `\n✓ Tozalandi — mos kelgan: ${res.matchedCount}, o'zgartirilgan: ${res.modifiedCount}`,
  );

  const left = await coll.countDocuments(FILTER);
  log(`Qolgan hujjatlar: ${left}`);

  await mongoose.disconnect();
  log("\n✓ Tayyor.");
}

main().catch((e) => {
  err("Migratsiya xatosi:", e.message);
  console.error(e);
  process.exit(1);
});
