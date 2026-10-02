"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const SlaConfig = require("../src/references/slaConfig/slaConfig.model");

const CONFIGS = [
  {
    role: "rektor",
    slaDays: 3,
    warningDaysBefore: 1,
    escalateToRole: null,
    desc: "Rektor tasdiqlash — yakuniy bosqich",
  },
  {
    role: "prorektor",
    slaDays: 5,
    warningDaysBefore: 1,
    escalateToRole: "rektor",
    escalateAfterDays: 3,
    desc: "Prorektor tasdiqlash",
  },
  {
    role: "dekan",
    slaDays: 5,
    warningDaysBefore: 1,
    escalateToRole: "prorektor",
    escalateAfterDays: 3,
    desc: "Fakultet dekani tasdiqlash",
  },
  {
    role: "kafedra_mudiri",
    slaDays: 5,
    warningDaysBefore: 1,
    escalateToRole: "dekan",
    escalateAfterDays: 3,
    desc: "Kafedra mudiri tasdiqlash",
  },
  {
    role: "oquv_uslubiy_boshqarma",
    slaDays: 5,
    warningDaysBefore: 1,
    escalateToRole: "prorektor",
    escalateAfterDays: 3,
    desc: "O'quv-uslubiy boshqarma kelishish",
  },
  {
    role: "reja_moliya",
    slaDays: 5,
    warningDaysBefore: 1,
    escalateToRole: "prorektor",
    escalateAfterDays: 3,
    desc: "Reja-moliya bo'limi kelishish",
  },
  {
    role: "arm",
    slaDays: 7,
    warningDaysBefore: 2,
    escalateToRole: "prorektor",
    escalateAfterDays: 5,
    desc: "Axborot-resurs markazi (ARM) tekshiruvi",
  },
  {
    role: "oquv_metodik",
    slaDays: 7,
    warningDaysBefore: 2,
    escalateToRole: "prorektor",
    escalateAfterDays: 5,
    desc: "O'quv-metodik ta'minot bo'limi tekshiruvi",
  },
  {
    role: "external",
    slaDays: 10,
    warningDaysBefore: 3,
    escalateToRole: null,
    desc: "Tashqi tasdiqlash (hamkor tashkilot)",
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[SLA Seed] Connected");

  let created = 0;
  let updated = 0;

  for (const cfg of CONFIGS) {
    const existing = await SlaConfig.findOne({
      role: cfg.role,
      documentType: null,
    });
    await SlaConfig.findOneAndUpdate(
      { role: cfg.role, documentType: null },
      { $set: { ...cfg, active: true, documentType: null } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (existing) updated++;
    else created++;
  }

  console.log(`[SLA Seed] Created: ${created}, Updated: ${updated}`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[SLA Seed] ERROR:", err);
  process.exit(1);
});
