"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[CouncilSample Seed] MongoDB ga ulandi\n");

  const User = require("../src/modules/4.01-auth/user/user.model");
  const Department = require("../src/references/department/department.model");
  const Member = require("../src/modules/4.09-instituteCouncil/councilMember/councilMember.model");
  const Task = require("../src/modules/4.09-instituteCouncil/councilTask/councilTask.model");
  const RankApp = require("../src/modules/4.09-instituteCouncil/rankApplication/rankApplication.model");
  const Voting = require("../src/modules/4.09-instituteCouncil/votingSession/votingSession.model");
  const Announcement = require("../src/modules/4.09-instituteCouncil/announcement/announcement.model");

  const existing = await Member.countDocuments();
  if (existing > 0) {
    console.log(`  ~ SKIP: ${existing} ta councilMember allaqachon bor — namuna data qo'shilmadi`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const pin = async (p) => User.findOne({ oneIdPin: p }).select("_id firstName lastName").lean();
  const kotib = await pin("20000000000001");
  const azo = await pin("20000000000002");
  const oqituvchi = await pin("20000000000003");
  const rektor = await pin("20000000000004");

  if (!kotib || !azo || !oqituvchi) {
    console.warn("  ⚠ Council userlar topilmadi — avval council-users.seed.js ni ishga tushiring");
    await mongoose.disconnect();
    process.exit(1);
  }

  const dept = await Department.findOne({ active: true }).select("_id").lean();
  const deptId = dept ? dept._id : undefined;
  const fio = (u) => (u ? `${u.lastName} ${u.firstName}` : "");

  await Member.insertMany(
    [
      { user: kotib._id, department: deptId, position: "Kotib", academicTitle: "dotsent", canVote: true },
      { user: azo._id, department: deptId, position: "Professor", academicTitle: "professor", canVote: true },
      { user: oqituvchi._id, department: deptId, position: "Dotsent", academicTitle: "dotsent", canVote: true },
      rektor ? { user: rektor._id, department: deptId, position: "Rektor", academicTitle: "professor", canVote: true } : null,
    ].filter(Boolean),
  );

  const now = new Date();
  const plus = (d) => new Date(now.getTime() + d * 864e5);
  await Task.insertMany([
    { title: "Yillik ilmiy hisobotni tayyorlash", assignee: azo._id, createdBy: kotib._id, deadline: plus(7), status: "new", history: [{ actor: fio(kotib), action: "Topshiriq yaratildi" }] },
    { title: "Kafedra ilmiy seminarini tashkil qilish", assignee: azo._id, createdBy: kotib._id, deadline: plus(14), status: "in_progress", history: [{ actor: fio(kotib), action: "Topshiriq yaratildi" }] },
    { title: "Konferensiya materiallarini yig'ish", assignee: azo._id, createdBy: kotib._id, deadline: plus(-2), status: "done", resultFiles: ["hisobot.pdf"], history: [{ actor: fio(azo), action: "Natija yuklandi" }] },
  ]);

  const rankDocs = [
    { name: "Ariza" }, { name: "Diplom nusxasi" }, { name: "Ilmiy ishlar ro'yxati" },
  ];
  await RankApp.insertMany([
    { applicant: oqituvchi._id, rankType: "dotsent", category: "rank", department: deptId, submittedDocs: rankDocs, status: "new", submittedAt: now, history: [{ actor: fio(oqituvchi), action: "Ariza topshirildi" }] },
    { applicant: oqituvchi._id, rankType: "professor", category: "rank", department: deptId, submittedDocs: rankDocs, status: "accepted", officialDocs: { organizationLetter: "tashkilot.pdf", guaranteeLetter: "kafolat.pdf", councilApproval: "tasdiq.pdf" }, submittedAt: now, history: [{ actor: fio(kotib), action: "Qabul qilindi" }] },
  ]);

  await Voting.create({
    title: `${fio(oqituvchi)} — professor unvoni`,
    department: deptId,
    rankType: "professor",
    mode: "single",
    candidates: [{ user: oqituvchi._id, diplomaFile: "diplom.pdf", diplomaDate: now }],
    startDate: now,
    endDate: plus(5),
    passingPercent: 60,
    status: "active",
    createdBy: kotib._id,
  });

  await Announcement.insertMany([
    { title: "Navbatdagi kengash yig'ilishi", content: "Kengash yig'ilishi 15-sanada soat 14:00 da bo'lib o'tadi.", recipientGroup: "all", recipientCount: 45, createdBy: kotib._id },
    { title: "Professorlar uchun eslatma", content: "Ilmiy hisobotlarni topshirish muddati yaqinlashmoqda.", recipientGroup: "professors", recipientCount: 12, createdBy: kotib._id },
  ]);

  console.log("  + 4 a'zo, 3 topshiriq, 2 unvon arizasi, 1 so'rovnoma, 2 e'lon yaratildi");
  console.log("\n═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[CouncilSample Seed] XATO:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
