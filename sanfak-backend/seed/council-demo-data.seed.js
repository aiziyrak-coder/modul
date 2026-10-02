"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const days = (n) => new Date(NOW + n * DAY);

const line = (c = "─") => console.log(c.repeat(74));

const REAL_FILE = "http://localhost:4000/files/images/council-tasks/17854785946310.png";
const fileUrl = (name) => `http://localhost:4000/files/images/council-tasks/${name}`;

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(`\n[council-demo-data] ${APPLY ? "APPLY" : "DRY-RUN"}`);
  line("═");

  const User = require("../src/modules/4.01-auth/user/user.model");
  const Department = require("../src/references/department/department.model");
  const Member = require("../src/modules/4.09-instituteCouncil/councilMember/councilMember.model");
  const Task = require("../src/modules/4.09-instituteCouncil/councilTask/councilTask.model");
  const RankApp = require("../src/modules/4.09-instituteCouncil/rankApplication/rankApplication.model");
  const Voting = require("../src/modules/4.09-instituteCouncil/votingSession/votingSession.model");
  const Vote = require("../src/modules/4.09-instituteCouncil/anonymousVote/anonymousVote.model");
  const Announcement = require("../src/modules/4.09-instituteCouncil/announcement/announcement.model");
  const Notification = require("../src/system/notification/notification.model");

  const pin = (p) => User.findOne({ oneIdPin: p }).select("_id firstName lastName").lean();
  const kotib = await pin("20000000000001");
  const azo = await pin("20000000000002");
  const oqituvchi = await pin("20000000000003");
  const rektor = await pin("20000000000004");
  const extra1 = await pin("10000000000002");
  const extra2 = await pin("10000000000003");
  const extra3 = await pin("10000000000004");

  if (!kotib || !azo || !oqituvchi || !rektor) {
    console.error("  ⚠ Kengash userlari topilmadi — avval council-users.seed.js ni ishga tushiring\n");
    await mongoose.disconnect();
    process.exit(1);
  }

  const depts = await Department.find({ active: true }).select("_id title name").lean();
  if (depts.length === 0) {
    console.error("  ⚠ Kafedra (department) topilmadi — avval council-structure.seed.js ni ishga tushiring\n");
    await mongoose.disconnect();
    process.exit(1);
  }
  const d = (i) => depts[i % depts.length]._id;
  const fio = (u) => `${u.lastName} ${u.firstName}`;

  const plan = [];
  const record = (what, n) => plan.push({ what, n });

  const nullDept = await Member.find({
    $or: [{ department: null }, { department: { $exists: false } }],
  })
    .select("_id")
    .lean();
  if (nullDept.length && APPLY) {
    for (let i = 0; i < nullDept.length; i += 1) {
      await Member.updateOne({ _id: nullDept[i]._id }, { $set: { department: d(i) } });
    }
  }
  record(`Mavjud a'zolarda bo'sh kafedra to'ldirildi`, nullDept.length);

  const newMembers = [
    { user: extra1, position: "Professor", academicTitle: "professor", canVote: true, dept: 1 },
    { user: extra2, position: "Kafedra mudiri", academicTitle: "dotsent", canVote: true, dept: 2 },
    { user: extra3, position: "Assistent", academicTitle: "katta_oqituvchi", canVote: false, dept: 3 },
  ].filter((m) => m.user);

  let membersAdded = 0;
  for (const m of newMembers) {
    if (await Member.exists({ user: m.user._id })) continue;
    if (APPLY) {
      await Member.create({
        user: m.user._id,
        department: d(m.dept),
        position: m.position,
        academicTitle: m.academicTitle,
        canVote: m.canVote,
        startDate: days(-120),
        active: true,
      });
    }
    membersAdded += 1;
  }
  record("Yangi kengash a'zosi", membersAdded);

  const eligible = APPLY
    ? await Member.countDocuments({ canVote: true, active: true })
    : (await Member.countDocuments({ canVote: true, active: true })) +
      newMembers.filter((m) => m.canVote).length;

  const h = (actor, action, at, reason) => ({ at, actor, action, ...(reason ? { reason } : {}) });
  const created = (at) => h(fio(kotib), "Topshiriq yaratildi", at);

  const tasks = [
    { title: "Kengash yig'ilishi bayonnomasini rasmiylashtirish", desc: "Iyul oyidagi yig'ilish bayonnomasi.", status: "new", deadline: days(5), history: [created(days(-1))] },
    { title: "Yosh olimlar konferensiyasi ro'yxatini tayyorlash", desc: "Ishtirokchilar va mavzular ro'yxati.", status: "new", deadline: days(12), history: [created(days(-2))] },
    { title: "Kafedra ilmiy to'garagi rejasini taqdim etish", status: "new", deadline: days(20), history: [created(days(-3))] },

    { title: "Ilmiy maqolalar reyestrini yangilash", desc: "Scopus va Web of Science maqolalari.", status: "in_progress", deadline: days(9), history: [created(days(-8)), h(fio(azo), "delete-result", days(-2))] },
    { title: "Xalqaro hamkorlik shartnomasi loyihasini ko'rib chiqish", status: "in_progress", deadline: days(16), history: [created(days(-6))] },

    { title: "Klinik tadqiqot natijalari hisoboti", desc: "I-bosqich natijalari.", status: "done", deadline: days(-3), resultFiles: [REAL_FILE], history: [created(days(-20)), h(fio(azo), "submit-result", days(-2))] },
    { title: "Magistrlik dissertatsiyalari ro'yxati", status: "done", deadline: days(4), resultFiles: [fileUrl("17854790001.pdf"), fileUrl("17854790002.docx")], history: [created(days(-15)), h(fio(azo), "submit-result", days(-1))] },

    { title: "Ilmiy-tadqiqot ishlari yillik rejasi", desc: "2026-yil uchun reja.", status: "approved", deadline: days(-25), resultFiles: [fileUrl("17854790003.pdf")], approvedBy: kotib._id, completedAt: days(-18), history: [created(days(-40)), h(fio(azo), "submit-result", days(-20)), h(fio(kotib), "approve", days(-18))] },
    { title: "Patent va mualliflik guvohnomalari ro'yxati", status: "approved", deadline: days(-12), resultFiles: [fileUrl("17854790004.pdf")], approvedBy: kotib._id, completedAt: days(-9), history: [created(days(-30)), h(fio(azo), "submit-result", days(-11)), h(fio(kotib), "approve", days(-9))] },

    { title: "Kafedra ilmiy salohiyati tahlili", status: "rejected", deadline: days(-10), resultFiles: [fileUrl("17854790005.pdf")], rejectReason: "Tahlilda 2025-yil ko'rsatkichlari yo'q — to'ldirib qayta yuklang.", rejectedBy: kotib._id, history: [created(days(-28)), h(fio(azo), "submit-result", days(-8)), h(fio(kotib), "reject", days(-6), "Tahlilda 2025-yil ko'rsatkichlari yo'q — to'ldirib qayta yuklang.")] },
    { title: "Talabalar ilmiy to'garagi hisoboti", status: "rejected", deadline: days(-5), resultFiles: [fileUrl("17854790006.docx")], rejectReason: "Hisobot eskirgan shaklda tayyorlangan, yangi shablonda qayta topshiring.", rejectedBy: kotib._id, history: [created(days(-22)), h(fio(azo), "submit-result", days(-4)), h(fio(kotib), "reject", days(-3), "Hisobot eskirgan shaklda tayyorlangan, yangi shablonda qayta topshiring.")] },

    { title: "Ilmiy jurnal uchun taqriz tayyorlash", desc: "«Tibbiyot axboroti» jurnali uchun.", status: "overdue", deadline: days(-6), overdueNotifiedAt: new Date(), history: [created(days(-24))] },
    { title: "Grant loyihasi hujjatlarini topshirish", status: "overdue", deadline: days(-14), overdueNotifiedAt: new Date(), history: [created(days(-35))] },
  ];

  let tasksAdded = 0;
  for (const t of tasks) {
    if (await Task.exists({ title: t.title })) continue;
    if (APPLY) {
      await Task.create({ ...t, assignee: azo._id, createdBy: kotib._id, active: true, resultFiles: t.resultFiles || [] });
    }
    tasksAdded += 1;
  }
  record("Topshiriq (6 status)", tasksAdded);

  const DOC_NAMES = ["Ariza", "Diplom nusxasi", "Mehnat daftarchasi", "Ilmiy ishlar ro'yxati", "Dissertatsiya avtoreferati", "Boshqa qo'shimcha"];
  const submittedDocs = (tag) => DOC_NAMES.map((name, i) => ({ name, fileUrl: fileUrl(`${tag}-${i + 1}.pdf`) }));
  const officialDocs = (tag) => ({
    organizationLetter: fileUrl(`${tag}-tashkilot-xati.pdf`),
    guaranteeLetter: fileUrl(`${tag}-kafolat-xati.pdf`),
    councilApproval: fileUrl(`${tag}-kengash-qarori.pdf`),
  });

  const rankApps = [
    { applicant: oqituvchi, rankType: "Dotsent", department: d(6), status: "new", submittedAt: days(-4), tag: "dots-a" },
    { applicant: oqituvchi, rankType: "Katta ilmiy xodim", department: d(6), status: "new", submittedAt: days(-9), tag: "kix-a" },
    { applicant: extra1, rankType: "Professor", department: d(1), status: "new", submittedAt: days(-2), tag: "prof-a" },

    { applicant: oqituvchi, rankType: "Professor", department: d(6), status: "accepted", submittedAt: days(-45), official: true, tag: "prof-b" },
    { applicant: extra2, rankType: "Dotsent", department: d(2), status: "accepted", submittedAt: days(-60), official: true, tag: "dots-b" },

    { applicant: oqituvchi, rankType: "Dotsent", department: d(6), status: "returned", submittedAt: days(-70), returnReason: "Ilmiy ishlar ro'yxati tasdiqlanmagan — kafedra muhri bilan qayta topshiring.", tag: "dots-c" },
    { applicant: extra1, rankType: "Katta ilmiy xodim", department: d(1), status: "returned", submittedAt: days(-52), returnReason: "Dissertatsiya avtoreferati yuklanmagan.", tag: "kix-b" },

    { applicant: azo, rankType: "Dotsent", department: d(3), status: "new", submittedAt: days(-1), tag: "dots-d" },
    { applicant: extra2, rankType: "Professor", department: d(2), status: "new", submittedAt: days(-6), tag: "prof-c" },
    { applicant: extra3, rankType: "Katta ilmiy xodim", department: d(4), status: "new", submittedAt: days(-11), tag: "kix-c" },
    { applicant: extra1, rankType: "Dotsent", department: d(1), status: "new", submittedAt: days(-14), tag: "dots-e" },
  ].filter((a) => a.applicant);

  let rankAdded = 0;
  for (const a of rankApps) {
    if (await RankApp.exists({ applicant: a.applicant._id, rankType: a.rankType, status: a.status })) continue;
    if (APPLY) {
      const hist = [h(fio(a.applicant), "Ariza topshirildi", a.submittedAt)];
      if (a.status === "accepted") hist.push(h(fio(kotib), "accept", days(-30)));
      if (a.status === "returned") hist.push(h(fio(kotib), "return", days(-40), a.returnReason));
      await RankApp.create({
        applicant: a.applicant._id,
        rankType: a.rankType,
        category: "rank",
        department: a.department,
        submittedDocs: submittedDocs(a.tag),
        ...(a.official ? { officialDocs: officialDocs(a.tag) } : {}),
        status: a.status,
        ...(a.returnReason ? { returnReason: a.returnReason } : {}),
        submittedAt: a.submittedAt,
        history: hist,
        active: true,
      });
    }
    rankAdded += 1;
  }
  record("Unvon arizasi (new/accepted/returned)", rankAdded);

  const cand = (u, n) => ({ user: u._id, diplomaFile: fileUrl(`diplom-${n}.pdf`), diplomaDate: days(-400) });

  const sessions = [
    {
      title: "Tursunov Bahodir — dotsentlik unvoni", rankType: "Dotsent", department: d(6),
      mode: "single", candidates: [cand(oqituvchi, 1)],
      startDate: days(-2), endDate: days(10), status: "active",
    },
    {
      title: "Professorlik unvoni — nomzodlar orasida tanlov", desc: "Uch nomzoddan biri tanlanadi.",
      rankType: "Professor", department: d(1),
      mode: "choice", candidates: [cand(azo, 2), cand(extra1, 3), cand(extra2, 4)].filter((c) => c.user),
      startDate: days(-1), endDate: days(14), status: "active",
    },

    {
      title: "Nazarova Dilnoza — professorlik unvoni", rankType: "Professor", department: d(3),
      mode: "single", candidates: [cand(azo, 5)],
      startDate: days(-40), endDate: days(-33), status: "approved",
      results: { for: 5, against: 1, abstain: Math.max(eligible - 6, 0), winner: azo._id, passed: true },
    },
    {
      title: "Katta ilmiy xodim unvoni — ikki nomzod", rankType: "Katta ilmiy xodim", department: d(2),
      mode: "choice", candidates: [cand(oqituvchi, 6), cand(extra1, 7)].filter((c) => c.user),
      startDate: days(-25), endDate: days(-18), status: "approved",
      results: { for: 4, against: 2, abstain: Math.max(eligible - 6, 0), winner: oqituvchi._id, passed: true },
    },

    {
      title: "Yo'ldoshev Bobur — dotsentlik unvoni", rankType: "Dotsent", department: d(4),
      mode: "single", candidates: [cand(extra2, 8)].filter((c) => c.user),
      startDate: days(-60), endDate: days(-53), status: "rejected",
      results: { for: 2, against: 4, abstain: Math.max(eligible - 6, 0), winner: null, passed: false },
    },

    {
      title: "Nazarova Dilnoza — katta ilmiy xodim unvoni", rankType: "Katta ilmiy xodim", department: d(3),
      mode: "single", candidates: [cand(azo, 9)],
      startDate: days(-3), endDate: days(21), status: "active",
    },
    {
      title: "Dotsentlik unvoni — ikki nomzod tanlovi", desc: "Farmatsevtika va Pediatriya kafedralaridan.",
      rankType: "Dotsent", department: d(2),
      mode: "choice", candidates: [cand(oqituvchi, 10), cand(extra3, 11)].filter((c) => c.user),
      startDate: days(-4), endDate: days(18), status: "active",
    },
  ].filter((s) => s.candidates.length > 0);

  let votingAdded = 0;
  const activeSessionIds = [];
  for (const s of sessions) {
    const found = await Voting.findOne({ title: s.title }).select("_id status").lean();
    if (found) {
      if (found.status === "active") activeSessionIds.push({ id: found._id, mode: s.mode, candidates: s.candidates });
      continue;
    }
    if (APPLY) {
      const doc = await Voting.create({ ...s, passingPercent: 60, createdBy: kotib._id, active: true });
      if (s.status === "active") activeSessionIds.push({ id: doc._id, mode: s.mode, candidates: s.candidates });
    }
    votingAdded += 1;
  }
  record("So'rovnoma (faol/tasdiqlangan/rad etilgan)", votingAdded);

  const voters = [kotib, oqituvchi, rektor].filter(Boolean);
  let votesAdded = 0;
  for (const s of activeSessionIds) {
    for (let i = 0; i < voters.length; i += 1) {
      const voter = String(voters[i]._id);
      if (await Vote.exists({ session: s.id, voter })) continue;
      if (APPLY) {
        await Vote.create({
          session: s.id,
          voter,
          ...(s.mode === "choice" ? { candidate: s.candidates[i % s.candidates.length].user } : {}),
          choice: s.mode === "choice" ? "for" : i === voters.length - 1 ? "against" : "for",
          active: true,
        });
      }
      votesAdded += 1;
    }
  }
  record("Anonim ovoz (faol so'rovnomalarga)", votesAdded);

  const RECIPIENT_COUNT = { all: 45, professors: 12, dotsents: 18, deptHeads: 8 };
  const announcements = [
    { title: "Ilmiy kengashning navbatdan tashqari yig'ilishi", content: "Hurmatli kengash a'zolari! Navbatdan tashqari yig'ilish 5-avgust kuni soat 14:00 da katta majlislar zalida o'tkaziladi. Kun tartibi: unvon arizalarini ko'rib chiqish va yillik reja tasdig'i.", recipientGroup: "all" },
    { title: "Dotsentlik unvoni uchun hujjat qabuli", content: "Dotsentlik unvoniga hujjat topshirish muddati 20-avgustgacha uzaytirildi. Hujjatlar ro'yxati «Unvonlar» bo'limida keltirilgan.", recipientGroup: "dotsents" },
    { title: "Kafedra mudirlari uchun hisobot shakli", content: "Kafedralar bo'yicha yarim yillik ilmiy faoliyat hisoboti yangi shaklda topshiriladi. Shablon kengash kotibiyatidan olinadi.", recipientGroup: "deptHeads" },

    { title: "Professorlik unvoniga nomzodlar ovoz berishi", content: "Professorlik unvoni bo'yicha yashirin ovoz berish ochildi. Ovoz berish huquqiga ega a'zolar «Ovoz berish» bo'limida ishtirok etishlari mumkin. Ovoz berish 14 kun davom etadi.", recipientGroup: "professors" },
    { title: "Ilmiy ishlar reyestrini yangilash to'g'risida", content: "Barcha kafedralar 2026-yil birinchi yarim yilligi bo'yicha Scopus va Web of Science bazalaridagi maqolalar ro'yxatini yangilashi so'raladi.", recipientGroup: "all" },
  ];

  let annAdded = 0;
  for (const a of announcements) {
    if (await Announcement.exists({ title: a.title })) continue;
    if (APPLY) {
      await Announcement.create({
        ...a,
        recipientCount: RECIPIENT_COUNT[a.recipientGroup],
        createdBy: kotib._id,
        active: true,
      });
    }
    annAdded += 1;
  }
  record("E'lon (3 xil qabul qiluvchi guruhi)", annAdded);

  const notif = (user, eventType, title, body, link, code, read) => ({
    user: user._id,
    eventType,
    title,
    body,
    link,
    metadata: { code },
    read: !!read,
    readAt: read ? days(-1) : null,
    channels: ["inApp"],
    deliveryStatus: { inApp: { delivered: true } },
    active: true,
  });

  const notifications = [
    notif(kotib, "task_completed", 'T: "Klinik tadqiqot natijalari hisoboti" bajarildi', "Nazarova Dilnoza natija yukladi — tasdiqlashingiz kutilmoqda.", "/kengash/topshiriqlar", "T", false),
    notif(kotib, "task_completed", 'T: "Magistrlik dissertatsiyalari ro\'yxati" bajarildi', "Natija fayllari yuklandi (2 ta).", "/kengash/topshiriqlar", "T", false),
    notif(kotib, "council_rank_new", 'U: Tursunov Bahodir — "Dotsent" unvoni arizasi', "Yangi ariza topshirildi, hujjatlar ko'rib chiqilishi kerak.", "/kengash/unvonlar/hujjatlar", "U", true),

    notif(azo, "task_assigned", 'T: "Kengash yig\'ilishi bayonnomasini rasmiylashtirish" topshiriq sizga biriktirildi', "Muddat: 5 kundan keyin.", "/kengash/topshiriqlar", "T", false),
    notif(azo, "council_task_overdue", 'T: "Grant loyihasi hujjatlarini topshirish" muddati o\'tdi', "Topshiriq muddati tugadi, natija hali yuklanmagan.", "/kengash/topshiriqlar", "T", false),
    notif(azo, "council_voting_started", 'V: "Tursunov Bahodir — dotsentlik unvoni" ovoz berish boshlandi', "Ovoz berish 10 kun davom etadi.", "/kengash/ovoz-berish", "V", false),
    notif(azo, "announcement_new", "E: Ilmiy kengashning navbatdan tashqari yig'ilishi", "Yig'ilish 5-avgust kuni soat 14:00 da.", "/kengash/elonlar", "E", true),

    notif(oqituvchi, "council_rank_accepted", 'U: "Professor" unvoni arizangiz qabul qilindi', "Ariza kengash ko'rigiga o'tkazildi.", "/kengash/unvonlar/arxiv", "U", false),
    notif(oqituvchi, "council_rank_returned", 'U: "Dotsent" unvoni arizangiz qaytarildi', "Sabab: Ilmiy ishlar ro'yxati tasdiqlanmagan.", "/kengash/unvonlar/arxiv", "U", false),
    notif(oqituvchi, "announcement_new", "E: Dotsentlik unvoni uchun hujjat qabuli", "Muddat 20-avgustgacha uzaytirildi.", "/kengash/elonlar", "E", true),

    notif(rektor, "council_voting_finished", 'V: "Nazarova Dilnoza — professorlik unvoni" yakunlandi', "Natija: tasdiqlandi (5 yoqlab, 1 qarshi).", "/kengash/hisobotlar", "V", false),
    notif(rektor, "council_voting_finished", 'V: "Yo\'ldoshev Bobur — dotsentlik unvoni" yakunlandi', "Natija: rad etildi (2 yoqlab, 4 qarshi).", "/kengash/hisobotlar", "V", true),
    notif(rektor, "council_task_overdue", 'T: "Ilmiy jurnal uchun taqriz tayyorlash" muddati o\'tdi', "Kengash topshirig'i muddatida bajarilmadi.", "/kengash/topshiriqlar", "T", false),

    notif(kotib, "council_rank_new", 'U: Nazarova Dilnoza — "Dotsent" unvoni arizasi', "Yangi ariza — hujjatlar ko'rib chiqilishi kerak.", "/kengash/unvonlar/hujjatlar", "U", false),
    notif(kotib, "council_voting_started", 'V: "Dotsentlik unvoni — ikki nomzod tanlovi" ochildi', "Ovoz berish 18 kun davom etadi.", "/kengash/ovoz-berish", "V", false),
    notif(kotib, "council_task_overdue", 'T: "Grant loyihasi hujjatlarini topshirish" muddati o\'tdi', "Mas'ul a'zo natijani yuklamadi.", "/kengash/topshiriqlar", "T", true),
    notif(azo, "task_assigned", 'T: "Xalqaro hamkorlik shartnomasi loyihasini ko\'rib chiqish" topshiriq sizga biriktirildi', "Muddat: 16 kundan keyin.", "/kengash/topshiriqlar", "T", false),
    notif(azo, "council_voting_started", 'V: "Nazarova Dilnoza — katta ilmiy xodim unvoni" ovoz berish boshlandi', "Siz nomzod sifatida ishtirok etyapsiz.", "/kengash/ovoz-berish", "V", false),
    notif(oqituvchi, "council_voting_started", 'V: "Dotsentlik unvoni — ikki nomzod tanlovi" ochildi', "Siz nomzodlardan birisiz.", "/kengash/ovoz-berish", "V", false),
    notif(oqituvchi, "announcement_new", "E: Ilmiy ishlar reyestrini yangilash to'g'risida", "Scopus va WoS maqolalari ro'yxati yangilanishi kerak.", "/kengash/elonlar", "E", false),
    notif(rektor, "council_voting_finished", 'V: "Katta ilmiy xodim unvoni — ikki nomzod" yakunlandi', "Natija: tasdiqlandi (4 yoqlab, 2 qarshi).", "/kengash/hisobotlar", "V", false),
  ];

  let notifAdded = 0;
  for (const n of notifications) {
    if (await Notification.exists({ user: n.user, title: n.title })) continue;
    if (APPLY) await Notification.create(n);
    notifAdded += 1;
  }
  record("Bildirishnoma (4 rol feedi)", notifAdded);

  line("═");
  plan.forEach((p) => console.log(`  ${String(p.n).padStart(3)} × ${p.what}`));
  line();
  console.log(`  Ovoz huquqiga ega a'zolar (eligible): ${eligible}`);
  if (APPLY) {
    console.log("\n  ✅ Qo'llandi. Tekshirish:");
    console.log("     GET /api/council-tasks/tabs-count");
    console.log("     GET /api/rank-applications/tabs-count");
    console.log("     GET /api/voting-sessions/tabs-count");
  } else {
    console.log("\n  DRY-RUN — hech narsa yozilmadi.");
    console.log("  Qo'llash: node seed/council-demo-data.seed.js --apply");
  }
  console.log("");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[council-demo-data] XATO:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
