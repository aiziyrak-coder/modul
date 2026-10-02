"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const PermissionGroup = require("../src/modules/4.01-auth/permissionGroup/permissionGroup.model");

const GROUPS = [
  {
    code: "4.1",
    title: "Foydalanuvchilar va RBAC",
    desc: "Auth, foydalanuvchi, rol, ruxsatlar boshqaruvi",
  },
  {
    code: "4.2",
    title: "O'quv yuklamalari",
    desc: "O'quv reja, ishchi reja, yuklama, taqsimot, sillabus, fan dasturi",
  },
  {
    code: "4.3",
    title: "Professor-o'qituvchilar",
    desc: "Profil, shaxsiy ish reja, ilmiy unvon",
  },
  {
    code: "4.4",
    title: "Malaka oshirish",
    desc: "Kurslar, tinglovchilar, sertifikatlar, to'lovlar",
  },
  {
    code: "4.5",
    title: "Magistratura va Klinik ordinatura",
    desc: "Rezidentlar, klinik kundalik, attestatsiya, dissertatsiya",
  },
  {
    code: "4.6",
    title: "Ilmiy kengash (ilmiy ishlar)",
    desc: "Ilmiy ishlar, taqrizlar, qarorlar",
  },
  {
    code: "4.7",
    title: "Topshiriqlar boshqaruvi",
    desc: "Rahbariyat tomonidan biriktirilgan topshiriqlar",
  },
  {
    code: "4.8",
    title: "Xorijiy talabalar online qabuli",
    desc: "Xalqaro abituriyentlar uchun arizalar",
  },
  {
    code: "4.9",
    title: "Institut ilmiy kengashi",
    desc: "Kengash a'zolari, topshiriqlar, ovoz berish, unvonlar",
  },
  {
    code: "4.10",
    title: "Ilmiy bo'lim",
    desc: "Maqolalar, monografiyalar, patentlar, X/Sh shartnomalar",
  },
  {
    code: "4.11",
    title: "Iqtidorli talabalar",
    desc: "Reyting, baholash mezonlari, stipendiya arizalari",
  },
  {
    code: "4.12",
    title: "Ta'lim sifatini ta'minlash",
    desc: "Indikatorlar, professor reytingi",
  },
  {
    code: "4.13",
    title: "Amaliyot",
    desc: "Talaba amaliyoti, hamkor tashkilotlar",
  },
  {
    code: "references",
    title: "Lug'atlar (yo'nalish, kafedra, fan...)",
    desc: "Tizimning asosiy ma'lumotnoma jadvallari",
  },
  {
    code: "system",
    title: "Tizim",
    desc: "Bildirishnomalar, SLA, tasdiqlash zanjiri, hisobotlar",
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[PermissionGroups Seed] Connected");

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const g of GROUPS) {
    const existing = await PermissionGroup.findOne({ code: g.code });

    if (!existing) {
      await PermissionGroup.create({ ...g, active: true });
      created++;
      console.log(`  + ${g.code.padEnd(12)} ${g.title}`);
    } else {
      const needsUpdate =
        existing.title !== g.title ||
        existing.desc !== g.desc ||
        existing.active !== true;

      if (needsUpdate) {
        existing.title = g.title;
        existing.desc = g.desc;
        existing.active = true;
        await existing.save();
        updated++;
        console.log(`  ~ ${g.code.padEnd(12)} ${g.title}`);
      } else {
        unchanged++;
      }
    }
  }

  const total = await PermissionGroup.countDocuments({});
  const activeTotal = await PermissionGroup.countDocuments({ active: true });

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Created:    ${created}`);
  console.log(`  Updated:    ${updated}`);
  console.log(`  Unchanged:  ${unchanged}`);
  console.log("───────────────────────────────────────────");
  console.log(`  DB total:   ${total}`);
  console.log(`  DB active:  ${activeTotal}`);
  console.log(`  Expected:   ${GROUPS.length}`);
  console.log("═══════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[PermissionGroups Seed] ERROR:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});
