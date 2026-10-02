#!/usr/bin/env node
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const Task = require("../src/modules/4.07-task/task/task.model");
const TaskCategory = require("../src/modules/4.07-task/taskCategory/taskCategory.model");
const User = require("../src/modules/4.01-auth/user/user.model");
const Department = require("../src/references/department/department.model");

const MONGO = process.env.MONGO_HOST || "mongodb://127.0.0.1:27017/institute-test";
const WRITE = process.argv.includes("--write");

const KUN = 86_400_000;
const now = Date.now();
const kun = (n) => new Date(now + n * KUN);

const SHABLON = [
  { k: "001", t: "Kafedra yillik hisobotini topshirish", s: "completed", p: "high", ofset: 150, muddat: 14, yopilgan: 9 },
  { k: "002", t: "Talabalar davomati tahlilini tayyorlash", s: "completed", p: "medium", ofset: 130, muddat: 10, yopilgan: 6 },
  { k: "003", t: "O'quv xonalarini inventarizatsiya qilish", s: "completed", p: "low", ofset: 110, muddat: 21, yopilgan: 15 },
  { k: "004", t: "Ilmiy to'garak rejasini kelishish", s: "completed", p: "medium", ofset: 95, muddat: 12, yopilgan: 7 },
  { k: "005", t: "Malaka oshirish ro'yxatini yangilash", s: "completed", p: "high", ofset: 70, muddat: 7, yopilgan: 4 },
  { k: "006", t: "Kutubxona fondini to'ldirish taklifi", s: "completed", p: "low", ofset: 55, muddat: 20, yopilgan: 12 },
  { k: "007", t: "Amaliyot bazalari bilan shartnomani yangilash", s: "completed", p: "high", ofset: 40, muddat: 15, yopilgan: 11 },
  { k: "008", t: "Xorijiy talabalar uchun qo'llanma tayyorlash", s: "completed", p: "medium", ofset: 25, muddat: 14, yopilgan: 9 },
  { k: "009", t: "Sillabuslarni qayta ko'rib chiqish", s: "completed", p: "medium", ofset: 120, muddat: 10, yopilgan: 19 },
  { k: "010", t: "Elektron jurnalga ma'lumot kiritish", s: "completed", p: "low", ofset: 85, muddat: 7, yopilgan: 16 },
  { k: "011", t: "Konferensiya tezislarini yig'ish", s: "completed", p: "high", ofset: 45, muddat: 12, yopilgan: 21 },
  { k: "012", t: "Kafedra o'quv yuklamasini qayta hisoblash", s: "in_progress", p: "high", ofset: 60, muddat: 20, yopilgan: null },
  { k: "013", t: "Talabalar so'rovnomasini o'tkazish", s: "new", p: "high", ofset: 40, muddat: 15, yopilgan: null },
  { k: "014", t: "Laboratoriya jihozlarini ta'mirlash", s: "in_progress", p: "medium", ofset: 35, muddat: 14, yopilgan: null },
  { k: "015", t: "Ustav hujjatlarini arxivlash", s: "under_review", p: "low", ofset: 30, muddat: 10, yopilgan: null },
  { k: "016", t: "Yotoqxona sharoitini tekshirish", s: "new", p: "high", ofset: 20, muddat: 7, yopilgan: null },
  { k: "017", t: "Yangi o'quv yili taqvimini tasdiqlash", s: "in_progress", p: "high", ofset: 8, muddat: 25, yopilgan: null },
  { k: "018", t: "Professor-o'qituvchilar reytingini yangilash", s: "new", p: "medium", ofset: 5, muddat: 20, yopilgan: null },
  { k: "019", t: "Ilmiy maqolalar bazasini to'ldirish", s: "under_review", p: "medium", ofset: 12, muddat: 30, yopilgan: null },
  { k: "020", t: "Rezidentlar attestatsiyasini rejalashtirish", s: "new", p: "low", ofset: 3, muddat: 28, yopilgan: null },
  { k: "021", t: "Eskirgan mebelni hisobdan chiqarish", s: "rejected", p: "low", ofset: 65, muddat: 10, yopilgan: null },
  { k: "022", t: "Takroriy so'rovnoma o'tkazish", s: "not_needed", p: "low", ofset: 50, muddat: 12, yopilgan: null },
  { k: "023", t: "Qo'shimcha auditoriya ajratish", s: "rejected", p: "medium", ofset: 28, muddat: 9, yopilgan: null },
];

const KATEGORIYALAR = [
  "Ta'lim jarayoni",
  "Ilmiy faoliyat",
  "Moliyaviy-xo'jalik",
  "Ma'muriy",
];

(async () => {
  await mongoose.connect(MONGO);
  console.log(`[TaskDemo] ${WRITE ? "✍ WRITE" : "🔍 DRY-RUN"} · ${MONGO}`);

  const cats = [];
  for (const title of KATEGORIYALAR) {
    let c = await TaskCategory.findOne({ name: title });
    if (!c && WRITE) c = await TaskCategory.create({ name: title });
    cats.push(c || { _id: null, name: title });
  }
  console.log(`  Kategoriyalar: ${cats.filter((c) => c._id).length}/${KATEGORIYALAR.length}`);

  const deps = await Department.find({}).select("_id title").limit(4).lean();
  if (!deps.length) {
    console.warn("  ⚠ Bo'linma (department) topilmadi — bo'linma reytingi bo'sh bo'ladi");
  }

  const assignees = await User.find({ department: { $ne: null } })
    .select("_id department")
    .limit(8)
    .lean();
  if (!assignees.length) {
    console.error("  ✖ TO'XTATILDI — bo'linmasi bor foydalanuvchi yo'q.");
    console.error("    Avval: node seed/task-users.seed.js (yoki boshqa modul seed'lari)");
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`  Ijrochilar: ${assignees.length} ta (${deps.length} bo'linma)`);

  const creator = await User.findOne({}).select("_id").lean();

  let qoshildi = 0;
  let mavjud = 0;

  for (let i = 0; i < SHABLON.length; i += 1) {
    const x = SHABLON[i];
    const code = `DEMO-T-${x.k}`;
    const bor = await Task.findOne({ code });
    if (bor) {
      mavjud += 1;
      continue;
    }

    const createdAt = kun(-x.ofset);
    const deadline = new Date(createdAt.getTime() + x.muddat * KUN);
    const completedAt = x.yopilgan == null ? null : new Date(createdAt.getTime() + x.yopilgan * KUN);
    const assignee = assignees[i % assignees.length];
    const category = cats[i % cats.length];

    if (WRITE) {
      await Task.create({
        code,
        title: x.t,
        description: `Demo topshiriq (${code}) — 4.7 ko'rsatkichlarini sinash uchun.`,
        createdBy: creator._id,
        assignee: assignee._id,
        deadline,
        priority: x.p,
        category: category._id || undefined,
        status: x.s,
        completedAt,
        outcome: x.s === "completed" ? "completed" : x.s === "rejected" ? "rejected" : x.s === "not_needed" ? "not_needed" : null,
        createdAt,
        updatedAt: completedAt || createdAt,
      });
    }
    qoshildi += 1;
  }

  console.log(`  Topshiriqlar: +${qoshildi} yangi · ${mavjud} mavjud (jami shablon: ${SHABLON.length})`);
  console.log(
    WRITE
      ? "\n  ✓ Tayyor. Sinash: GET /api/task-statistics/overview"
      : "\n  Yozish uchun: node seed/task-demo-data.seed.js --write",
  );

  await mongoose.disconnect();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
