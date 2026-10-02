#!/usr/bin/env node
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const ScientificWork = require("../src/modules/4.06-scientificCouncil/scientificWork/scientificWork.model");
const User = require("../src/modules/4.01-auth/user/user.model");

const MONGO = process.env.MONGO_HOST || "mongodb://127.0.0.1:27017/institute-test";
const WRITE = process.argv.includes("--write");

const KUN = 86_400_000;
const kun = (n) => new Date(Date.now() + n * KUN);

const ISHLAR = [
  { t: "Yurak-qon tomir kasalliklarini erta aniqlash usullari", holat: "closed", muallif: "internal", seminar: "defended", ofset: 210 },
  { t: "Bolalarda immunitet shakllanishining klinik jihatlari", holat: "closed", muallif: "internal", seminar: "defended", ofset: 180 },
  { t: "Endokrin buzilishlarning diagnostikasi", holat: "closed", muallif: "external", seminar: "defended", ofset: 165 },
  { t: "Onkologik bemorlarda reabilitatsiya dasturi", holat: "seminar", muallif: "internal", seminar: "not_defended", ofset: 140 },
  { t: "Jamoat salomatligi monitoringi modeli", holat: "seminar", muallif: "external", seminar: null, ofset: 120 },
  { t: "Antibiotiklarga chidamlilik dinamikasi", holat: "approved", muallif: "internal", seminar: null, ofset: 100 },
  { t: "Tibbiy ta'limda simulyatsion texnologiyalar", holat: "approved", muallif: "external", seminar: null, ofset: 85 },
  { t: "Farmakologik preparatlar samaradorligi tahlili", holat: "pending", muallif: "internal", seminar: null, ofset: 60 },
  { t: "Yuqumli kasalliklar epidemiologiyasi", holat: "pending", muallif: "external", seminar: null, ofset: 45 },
  { t: "Stomatologik xizmat sifatini baholash", holat: "pending", muallif: "internal", seminar: null, ofset: 30 },
  { t: "Ona va bola salomatligi ko'rsatkichlari", holat: "revision", muallif: "internal", seminar: null, ofset: 55 },
  { t: "Ish joyidagi kasb kasalliklari profilaktikasi", holat: "rejected", muallif: "external", seminar: null, ofset: 90 },
  { t: "Sport tibbiyotida yuklama nazorati", holat: "rejected", muallif: "internal", seminar: null, ofset: 70 },
  { t: "Klinik laboratoriya diagnostikasi standartlari", holat: "new", muallif: "internal", seminar: null, ofset: 12 },
  { t: "Reanimatsiya bo'limida infeksiya nazorati", holat: "new", muallif: "external", seminar: null, ofset: 6 },
  { t: "Nevrologik bemorlarda hayot sifati", holat: "new", muallif: "internal", seminar: null, ofset: 2 },
];

(async () => {
  await mongoose.connect(MONGO);
  console.log(`[SciCouncilDemo] ${WRITE ? "✍ WRITE" : "🔍 DRY-RUN"} · ${MONGO}`);

  const users = await User.find({}).select("_id").limit(6).lean();
  if (!users.length) {
    console.error("  ✖ Foydalanuvchi topilmadi.");
    await mongoose.disconnect();
    process.exit(1);
  }

  let yangi = 0;
  let mavjud = 0;

  for (let i = 0; i < ISHLAR.length; i += 1) {
    const x = ISHLAR[i];
    const bor = await ScientificWork.findOne({ title: x.t });
    if (bor) {
      mavjud += 1;
      continue;
    }
    if (!WRITE) {
      yangi += 1;
      continue;
    }

    await ScientificWork.create({
      title: x.t,
      year: 2026,
      authorType: x.muallif,
      researcher: x.muallif === "internal" ? users[i % users.length]._id : undefined,
      externalAuthor:
        x.muallif === "external"
          ? {
              name: `Tashqi tadqiqotchi ${i + 1}`,
              workplace: "Hamkor ilmiy markaz",
              position: "Katta ilmiy xodim",
            }
          : undefined,
      status: x.holat,
      seminarResult: x.seminar,
      seminarDate: x.seminar ? kun(-(x.ofset - 20)) : null,
      secretary: users[0]._id,
      active: true,
      createdAt: kun(-x.ofset),
      updatedAt: kun(-x.ofset + 5),
    });
    yangi += 1;
  }

  console.log(`  Ilmiy ishlar: +${yangi} yangi · ${mavjud} mavjud (jami shablon: ${ISHLAR.length})`);
  console.log(
    WRITE
      ? "\n  ✓ Tayyor. Sinash: GET /api/scientific-council/statistics/overview"
      : "\n  Yozish uchun: --write",
  );

  await mongoose.disconnect();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
