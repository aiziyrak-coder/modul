"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const CouncilSpecialty = require("../src/modules/4.06-scientificCouncil/councilSpecialty/councilSpecialty.model");

const SPECIALTIES = [
  { code: "13.00.02", title: "Ta'lim va tarbiya nazariyasi va metodikasi (sohalar bo'yicha)", branch: "Pedagogika fanlari", active: true },
  { code: "14.00.01", title: "Akusherlik va ginekologiya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.02", title: "Morfologiya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.03", title: "Endokrinologiya", branch: "Tibbiyot fanlari, Biologiya fanlari", active: true },
  { code: "14.00.04", title: "Otorinolaringologiya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.05", title: "Ichki kasalliklar", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.06", title: "Kardiologiya", branch: "Tibbiyot fanlari, Biologiya fanlari", active: true },
  { code: "14.00.07", title: "Gigiyena", branch: "Tibbiyot fanlari, Biologiya fanlari", active: true },
  { code: "14.00.08", title: "Oftalmologiya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.09", title: "Pediatriya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.10", title: "Yuqumli kasalliklar", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.11", title: "Dermatologiya va venerologiya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.12", title: "Tibbiy reabilitologiya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.13", title: "Nevrologiya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.14", title: "Onkologiya", branch: "Tibbiyot fanlari, Biologiya fanlari", active: true },
  { code: "14.00.15", title: "Patologik anatomiya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.16", title: "Normal va patologik fiziologiya", branch: "Tibbiyot fanlari, Biologiya fanlari", active: true },
  { code: "14.00.17", title: "Farmakologiya va klinik farmakologiya", branch: "Tibbiyot fanlari, Biologiya fanlari, Farmatsevtika fanlari", active: true },
  { code: "14.00.18", title: "Psixiatriya va narkologiya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.19", title: "Klinik radiologiya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.20", title: "Tibbiy genetika", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.21", title: "Stomatologiya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.22", title: "Travmatologiya va ortopediya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.23", title: "Hamshiralik ishini tashkil etish", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.24", title: "Sud tibbiyoti", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.25", title: "Klinik-laborator va funksional diagnostika", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.26", title: "Ftiziatriya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.27", title: "Xirurgiya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.28", title: "Neyroxirurgiya", branch: "Tibbiyot fanlari", active: true },
  { code: "14.00.29", title: "Gematologiya va transfuziologiya", branch: "Tibbiyot fanlari, Biologiya fanlari", active: true },
  { code: "14.00.44", title: "Raqamli tibbiyot", branch: "Tibbiyot fanlari", active: true },
];

async function seedSpecialties() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[Council Specialties Seed] MongoDBga ulandi");

  let created = 0;
  let updated = 0;

  for (const sp of SPECIALTIES) {
    const exists = await CouncilSpecialty.findOne({ code: sp.code });
    await CouncilSpecialty.findOneAndUpdate(
      { code: sp.code },
      { $set: sp },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (exists) updated++;
    else created++;
  }

  console.log(`[Council Specialties Seed] Qo'shildi: ${created}, Yangilandi: ${updated}`);
  console.log(`[Council Specialties Seed] DBda jami: ${await CouncilSpecialty.countDocuments()}`);

  await mongoose.disconnect();
  process.exit(0);
}

seedSpecialties().catch((err) => {
  console.error("[Council Specialties Seed] XATO:", err);
  process.exit(1);
});
