#!/usr/bin/env node
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const Resident = require("../src/modules/4.05-residency/resident/resident.model");
const Attendance = require("../src/modules/4.05-residency/attendance/attendance.model");
const Attestation = require("../src/modules/4.05-residency/residencyAttestation/residencyAttestation.model");
const AttestationResult = require("../src/modules/4.05-residency/residencyAttestation/residencyAttestationResult.model");
const ActivityPlan = require("../src/modules/4.05-residency/activityPlan/activityPlan.model");
const DissertationPlan = require("../src/modules/4.05-residency/dissertationPlan/dissertationPlan.model");
const { MODULE_PIN_PREFIX, DEMO_SLOT_START, modulePin } = require("./_module-pins");

const PREFIX = MODULE_PIN_PREFIX["4.5"];

const MONGO = process.env.MONGO_HOST || "mongodb://127.0.0.1:27017/institute-test";
const WRITE = process.argv.includes("--write");

const KUN = 86_400_000;
const kun = (n) => new Date(Date.now() + n * KUN);
const YIL = "2025/2026";
const YIL_IMLOLARI = [YIL, YIL.replace("/", "-")];

const MUTAXASSISLIK = [
  "Terapiya",
  "Jarrohlik",
  "Pediatriya",
  "Akusherlik va ginekologiya",
];

const REZIDENTLAR = [
  { ism: "Aziza Karimova", prog: "magistratura", mol: "byudjet", mut: 0, soat: 0 },
  { ism: "Bobur Sattorov", prog: "magistratura", mol: "shartnoma", mut: 1, soat: 4 },
  { ism: "Charos Umarova", prog: "magistratura", mol: "byudjet", mut: 2, soat: 0 },
  { ism: "Doniyor Rashidov", prog: "magistratura", mol: "shartnoma", mut: 3, soat: 12 },
  { ism: "Elnora Yusupova", prog: "magistratura", mol: "byudjet", mut: 0, soat: 0 },
  { ism: "Farrux Tolipov", prog: "ordinatura", mol: "byudjet", mut: 1, soat: 8 },
  { ism: "Gulnora Ismoilova", prog: "ordinatura", mol: "shartnoma", mut: 2, soat: 0 },
  { ism: "Hasan Nazarov", prog: "ordinatura", mol: "byudjet", mut: 3, soat: 78 },
  { ism: "Iroda Qodirova", prog: "ordinatura", mol: "shartnoma", mut: 0, soat: 0 },
  { ism: "Jahongir Ergashev", prog: "ordinatura", mol: "byudjet", mut: 1, soat: 20 },
  { ism: "Kamola Xolmatova", prog: "ordinatura", mol: "shartnoma", mut: 2, soat: 0 },
  { ism: "Lola Mirzayeva", prog: "ordinatura", mol: "byudjet", mut: 3, soat: 90 },
];

const BALLAR = [95, 92, 88, 84, 79, 76, 73, 68, 64, 58, 52, 45];

const REJA_HOLATLARI = [
  "bajarilgan", "bajarilgan", "bajarilgan",
  "jarayonda", "jarayonda", "jarayonda", "jarayonda",
  "yuborilgan", "yuborilgan",
  "yangi",
  "rad_etilgan",
  "bajarilgan",
];

(async () => {
  await mongoose.connect(MONGO);
  console.log(`[ResidencyDemo] ${WRITE ? "✍ WRITE" : "🔍 DRY-RUN"} · ${MONGO}`);

  const residents = [];
  let yangiRez = 0;
  for (let i = 0; i < REZIDENTLAR.length; i += 1) {
    const x = REZIDENTLAR[i];
    const jshshir = modulePin(PREFIX, DEMO_SLOT_START + i);
    let doc = await Resident.findOne({ jshshir });
    if (!doc && WRITE) {
      doc = await Resident.create({
        program: x.prog,
        fullName: x.ism,
        jshshir,
        fundingType: x.mol,
        specialtyTitle: MUTAXASSISLIK[x.mut],
        academicYear: YIL,
        courseNumber: (i % 3) + 1,
        studyPeriod: x.prog === "magistratura" ? 2 : 3,
        totalUnexcusedHours: x.soat,
        warningIssued: x.soat >= 6,
        warningIssuedAt: x.soat >= 6 ? kun(-30) : null,
        expulsionOrderCreated: x.soat >= 72,
        expulsionOrderCreatedAt: x.soat >= 72 ? kun(-10) : null,
        active: true,
      });
      yangiRez += 1;
    }
    residents.push(doc);
  }
  console.log(`  Rezidentlar: +${yangiRez} yangi (jami shablon: ${REZIDENTLAR.length})`);

  if (!WRITE || residents.some((r) => !r)) {
    console.log(
      WRITE ? "\n  ⚠ Rezidentlar to'liq emas — qolgani o'tkazildi" : "\n  Yozish uchun: --write",
    );
    await mongoose.disconnect();
    return;
  }

  let yangiDav = 0;
  const mavjudDav = await Attendance.countDocuments({});
  if (mavjudDav === 0) {
    const rows = [];
    for (let oy = 0; oy < 6; oy += 1) {
      for (let i = 0; i < residents.length; i += 1) {
        for (let k = 0; k < 4; k += 1) {
          const x = REZIDENTLAR[i];
          const seed = (oy * 7 + i * 3 + k) % 10;
          let status = "present";
          if (x.soat >= 72) status = seed < 5 ? "absent" : seed < 7 ? "excused" : "present";
          else if (x.soat >= 6) status = seed < 2 ? "absent" : seed < 4 ? "excused" : "present";
          else if (seed === 0) status = "excused";

          rows.push({
            resident: residents[i]._id,
            date: kun(-(oy * 30 + k * 6)),
            status,
            hours: 2,
            scienceTitle: "Klinik amaliyot",
            active: true,
          });
        }
      }
    }
    await Attendance.insertMany(rows);
    yangiDav = rows.length;
  }
  console.log(`  Davomat: +${yangiDav} yozuv (mavjud edi: ${mavjudDav})`);

  let att = await Attestation.findOne({
    academicYear: { $in: YIL_IMLOLARI },
    groupTitle: "Demo guruh",
  });
  if (!att) {
    att = await Attestation.create({
      groupTitle: "Demo guruh",
      academicYear: YIL,
      type: "magistratura",
      date: kun(-15),
      scienceTitle: "Klinik amaliyot",
      active: true,
    });
  }
  let yangiNat = 0;
  for (let i = 0; i < residents.length; i += 1) {
    const bor = await AttestationResult.findOne({ attestation: att._id, resident: residents[i]._id });
    if (bor) continue;
    await AttestationResult.create({
      attestation: att._id,
      resident: residents[i]._id,
      residentName: residents[i].fullName,
      score: BALLAR[i],
      included: true,
      active: true,
    });
    yangiNat += 1;
  }
  console.log(`  Attestatsiya natijalari: +${yangiNat} (ballar 45..95)`);

  let yangiRej = 0;
  for (let i = 0; i < residents.length; i += 1) {
    for (const [Model, nom] of [[ActivityPlan, "faoliyat"], [DissertationPlan, "dissertatsiya"]]) {
      const bor = await Model.findOne({ resident: residents[i]._id });
      if (bor) continue;
      const holat = nom === "faoliyat"
        ? REJA_HOLATLARI[i]
        : REJA_HOLATLARI[(i + 4) % REJA_HOLATLARI.length];
      await Model.create({
        resident: residents[i]._id,
        title: `${nom === 'faoliyat' ? 'Faoliyat' : 'Dissertatsiya'} rejasi — ${residents[i].fullName}`,
        status: holat,
        academicYear: YIL,
        active: true,
      });
      yangiRej += 1;
    }
  }
  console.log(`  Ish rejalari: +${yangiRej} (faoliyat + dissertatsiya)`);

  console.log("\n  ✓ Tayyor. Sinash: GET /api/residency-statistics/overview");
  await mongoose.disconnect();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
