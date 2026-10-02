"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

const line = (c = "─") => console.log(c.repeat(63));

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;

  console.log(`\n[4.13 Manzil migratsiyasi] rejim: ${APPLY ? "APPLY (yoziladi)" : "DRY-RUN (yozilmaydi)"}`);
  line("═");

  const names = (await db.listCollections().toArray()).map((c) => c.name);
  const srcProv = names.includes("practiceregions") ? db.collection("practiceregions") : null;
  const srcDist = names.includes("practicedistricts") ? db.collection("practicedistricts") : null;
  const dstProv = db.collection("provinces");
  const dstDist = db.collection("regions");

  if (!srcProv && !srcDist) {
    console.log("  Manba collection'lar topilmadi — migratsiya kerak emas.\n");
    await mongoose.disconnect();
    return;
  }

  const provinces = srcProv ? await srcProv.find({}).toArray() : [];
  let provInsert = 0;
  let provSkip = 0;
  for (const p of provinces) {
    if (await dstProv.findOne({ _id: p._id })) {
      provSkip += 1;
      continue;
    }
    provInsert += 1;
    if (APPLY) {
      await dstProv.insertOne({
        _id: p._id,
        title: p.title,
        active: p.active !== false,
        createdAt: p.createdAt ?? new Date(),
        updatedAt: p.updatedAt ?? new Date(),
      });
    }
  }
  console.log(`  Viloyat (practiceregions → provinces)`);
  console.log(`    manba: ${provinces.length} · ko'chiriladi: ${provInsert} · mavjud (skip): ${provSkip}`);

  const districts = srcDist ? await srcDist.find({}).toArray() : [];
  const provIds = new Set(provinces.map((p) => String(p._id)));
  let distInsert = 0;
  let distSkip = 0;
  const orphans = [];
  for (const d of districts) {
    if (!d.region || !provIds.has(String(d.region))) {
      orphans.push(`${d.title} (region=${d.region})`);
      continue;
    }
    if (await dstDist.findOne({ _id: d._id })) {
      distSkip += 1;
      continue;
    }
    distInsert += 1;
    if (APPLY) {
      await dstDist.insertOne({
        _id: d._id,
        title: d.title,
        province: d.region,
        active: d.active !== false,
        createdAt: d.createdAt ?? new Date(),
        updatedAt: d.updatedAt ?? new Date(),
      });
    }
  }
  console.log(`  Shahar/Tuman (practicedistricts → regions)`);
  console.log(`    manba: ${districts.length} · ko'chiriladi: ${distInsert} · mavjud (skip): ${distSkip}`);
  if (orphans.length) {
    console.log(`    ⚠ viloyatsiz (o'tkazib yuborildi): ${orphans.length}`);
    orphans.slice(0, 5).forEach((o) => console.log(`      - ${o}`));
  }

  line();
  console.log("  Ref yaxlitligi tekshiruvi (migratsiyadan KEYIN kutilgan holat):");
  const afterProv = new Set([...provIds]);
  const afterDist = new Set(districts.map((d) => String(d._id)));

  for (const [label, col, fRegion, fDistrict] of [
    ["Amaliyot bazalari", "medicalorganizations", "region", "district"],
    ["Talabalar", "practicestudents", "region", "district"],
  ]) {
    if (!names.includes(col)) continue;
    const docs = await db.collection(col).find({}).project({ [fRegion]: 1, [fDistrict]: 1 }).toArray();
    const badR = docs.filter((x) => x[fRegion] && !afterProv.has(String(x[fRegion]))).length;
    const badD = docs.filter((x) => x[fDistrict] && !afterDist.has(String(x[fDistrict]))).length;
    const mark = badR + badD === 0 ? "✅" : "❌";
    console.log(`    ${mark} ${label}: ${docs.length} ta · yechilmaydigan viloyat: ${badR}, tuman: ${badD}`);
  }

  line("═");
  if (!APPLY) {
    console.log("  DRY-RUN — hech narsa yozilmadi.");
    console.log("  Yozish uchun: node seed/practice-address-migration.js --apply\n");
  } else {
    console.log(`  ✅ Yozildi: ${provInsert} viloyat, ${distInsert} shahar/tuman.`);
    console.log("  Manba collection'lar (practiceregions/practicedistricts) TEGILMADI.\n");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[4.13 Manzil migratsiyasi] XATO:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
