"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const OrgType = require("../src/modules/4.13-practice/orgType/orgType.model");
const Region = require("../src/references/province/province.model");
const District = require("../src/references/region/region.model");

const ORG_TYPES = [
  "Tibbiyot birlashmasi",
  "Sanitariya-epidemiologik osoyishtalik markazi",
  "Ko'p tarmoqli klinika",
  "Tuman markaziy shifoxonasi",
  "Ixtisoslashtirilgan markaz",
];

const REGIONS = [
  "Toshkent shahri",
  "Qoraqalpog'iston Respublikasi",
  "Andijon viloyati",
  "Buxoro viloyati",
  "Farg'ona viloyati",
  "Jizzax viloyati",
  "Xorazm viloyati",
  "Namangan viloyati",
  "Navoiy viloyati",
  "Qashqadaryo viloyati",
  "Samarqand viloyati",
  "Sirdaryo viloyati",
  "Surxondaryo viloyati",
  "Toshkent viloyati",
];

const DISTRICTS = {
  "Farg'ona viloyati": [
    "Farg'ona shahri",
    "Marg'ilon shahri",
    "Quvasoy shahri",
    "Oltiariq tumani",
    "Bag'dod tumani",
    "Beshariq tumani",
    "Buvayda tumani",
    "Dang'ara tumani",
    "Furqat tumani",
    "Qo'shtepa tumani",
    "Rishton tumani",
    "So'x tumani",
    "Toshloq tumani",
    "Uchko'prik tumani",
    "O'zbekiston tumani",
    "Yozyovon tumani",
  ],
  "Toshkent shahri": [
    "Bektemir tumani",
    "Chilonzor tumani",
    "Yashnobod tumani",
    "Mirobod tumani",
    "Mirzo Ulug'bek tumani",
    "Sergeli tumani",
    "Shayxontohur tumani",
    "Olmazor tumani",
    "Uchtepa tumani",
    "Yakkasaroy tumani",
    "Yunusobod tumani",
    "Yangihayot tumani",
  ],
};

const upsertByTitle = async (Model, title, extra = {}) => {
  const found = await Model.findOne({ title });
  if (found) return { doc: found, created: false };
  const doc = await Model.create({ title, ...extra });
  return { doc, created: true };
};

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[PracticeRefs Seed] MongoDB ga ulandi\n");

  let created = 0;
  let skipped = 0;

  for (const t of ORG_TYPES) {
    const { created: c } = await upsertByTitle(OrgType, t);
    c ? created++ : skipped++;
  }
  console.log(`  OrgType: ${ORG_TYPES.length} ko'rib chiqildi`);

  const regionByTitle = new Map();
  for (const t of REGIONS) {
    const { doc, created: c } = await upsertByTitle(Region, t);
    regionByTitle.set(t, doc._id);
    c ? created++ : skipped++;
  }
  console.log(`  Region: ${REGIONS.length} ko'rib chiqildi`);

  let districtCount = 0;
  for (const [regionTitle, list] of Object.entries(DISTRICTS)) {
    const regionId = regionByTitle.get(regionTitle);
    if (!regionId) continue;
    for (const t of list) {
      const found = await District.findOne({ title: t, province: regionId });
      if (found) {
        skipped++;
      } else {
        await District.create({ title: t, province: regionId });
        created++;
      }
      districtCount++;
    }
  }
  console.log(`  District: ${districtCount} ko'rib chiqildi`);

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  Yaratildi : ${created}`);
  console.log(`  O'tkazildi: ${skipped} (allaqachon mavjud)`);
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[PracticeRefs Seed] XATO:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
