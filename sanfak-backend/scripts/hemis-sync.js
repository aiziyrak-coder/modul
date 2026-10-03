// HEMIS sinxronini qo'lda ishga tushirish.
//   node scripts/hemis-sync.js                -> oddiy ro'yxatlar
//   node scripts/hemis-sync.js student group  -> faqat ko'rsatilgan turlar
//   node scripts/hemis-sync.js --heavy        -> og'ir ro'yxat (baholar)
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Service = require("#modules/4.14-hemis/hemis.service");
const { HEAVY_TYPES } = require("#modules/4.14-hemis/hemis.config");

(async () => {
  const args = process.argv.slice(2);
  const types = args.includes("--heavy") ? HEAVY_TYPES : args.filter((a) => !a.startsWith("--"));
  await mongoose.connect(process.env.MONGO_HOST);
  try {
    const res = await Service.syncAll({ ...(types.length ? { types } : {}), trigger: "manual" });
    console.log(JSON.stringify(res, null, 2));
    process.exitCode = res.status === "failed" ? 1 : 0;
  } finally {
    await mongoose.disconnect();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
