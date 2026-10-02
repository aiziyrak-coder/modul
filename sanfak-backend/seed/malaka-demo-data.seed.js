"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((s) => s.set("id", false));

const argv = process.argv.slice(2);
const WRITE = argv.includes("--write");
const DRY = !WRITE;

const log = (s = "") => console.log(s);

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  log(
    `[MalakaDemoData Seed] MongoDB ga ulandi${DRY ? "  —  🔍 DRY-RUN (hech narsa yozilmaydi, --write bilan ishga tushiring)" : "  —  ✍️  YOZISH REJIMI (--write)"}\n`,
  );

  const { appendSignature } = require("#shared/fileAccess");

  const Province = require("../src/references/province/province.model");
  const Region = require("../src/references/region/region.model");
  const Role = require("../src/modules/4.01-auth/role/role.model");
  const User = require("../src/modules/4.01-auth/user/user.model");

  const QualCourseType = require("../src/modules/4.04-qualification/qualCourseType/qualCourseType.model");
  const QualCourse = require("../src/modules/4.04-qualification/qualCourse/qualCourse.model");
  const QualCalendarPlan = require("../src/modules/4.04-qualification/qualCalendarPlan/qualCalendarPlan.model");
  const QualNotification = require("../src/modules/4.04-qualification/qualNotification/qualNotification.model");
  const QualTopic = require("../src/modules/4.04-qualification/qualTopic/qualTopic.model");
  const QualTopicLecture = require("../src/modules/4.04-qualification/_shared/qualTopicLecture.model");
  const QualTopicPractical = require("../src/modules/4.04-qualification/_shared/qualTopicPractical.model");
  const QualTopicVideo = require("../src/modules/4.04-qualification/_shared/qualTopicVideo.model");
  const QualTopicScenario = require("../src/modules/4.04-qualification/_shared/qualTopicScenario.model");
  const QualTopicFinalTest = require("../src/modules/4.04-qualification/_shared/qualTopicFinalTest.model");
  const QualSource = require("../src/modules/4.04-qualification/qualSource/qualSource.model");
  const QualAccessTest = require("../src/modules/4.04-qualification/_shared/qualAccessTest.model");
  const QualExitTest = require("../src/modules/4.04-qualification/_shared/qualExitTest.model");
  const QualTestConfig = require("../src/modules/4.04-qualification/qualTestConfig/qualTestConfig.model");
  const QualListener = require("../src/modules/4.04-qualification/_shared/qualListener.model");
  const QualPetition = require("../src/modules/4.04-qualification/qualPetition/qualPetition.model");
  const QualCourseSubscription = require("../src/modules/4.04-qualification/qualCourseSubscription/qualCourseSubscription.model");
  const QualContract = require("../src/modules/4.04-qualification/qualContract/qualContract.model");
  const QualPayment = require("../src/modules/4.04-qualification/qualPayment/qualPayment.model");
  const QualEarnedCertificate = require("../src/modules/4.04-qualification/_shared/qualEarnedCertificate.model");
  const QualAccessTestResult = require("../src/modules/4.04-qualification/qualAccessTestResult/qualAccessTestResult.model");
  const QualExitTestResult = require("../src/modules/4.04-qualification/qualExitTestResult/qualExitTestResult.model");
  const QualFinalTestResult = require("../src/modules/4.04-qualification/qualFinalTestResult/qualFinalTestResult.model");
  const QualTopicCompletion = require("../src/modules/4.04-qualification/qualTopicCompletion/qualTopicCompletion.model");

  const ALL_MODELS = [
    ["qualCourseType", QualCourseType],
    ["qualCourse", QualCourse],
    ["qualCalendarPlan", QualCalendarPlan],
    ["qualNotification", QualNotification],
    ["qualTopic", QualTopic],
    ["qualTopicLecture", QualTopicLecture],
    ["qualTopicPractical", QualTopicPractical],
    ["qualTopicVideo", QualTopicVideo],
    ["qualTopicScenario", QualTopicScenario],
    ["qualTopicFinalTest", QualTopicFinalTest],
    ["qualSource", QualSource],
    ["qualAccessTest", QualAccessTest],
    ["qualExitTest", QualExitTest],
    ["qualTestConfig", QualTestConfig],
    ["qualListener", QualListener],
    ["qualPetition", QualPetition],
    ["qualCourseSubscription", QualCourseSubscription],
    ["qualContract", QualContract],
    ["qualPayment", QualPayment],
    ["qualEarnedCertificate", QualEarnedCertificate],
    ["qualAccessTestResult", QualAccessTestResult],
    ["qualExitTestResult", QualExitTestResult],
    ["qualFinalTestResult", QualFinalTestResult],
    ["qualTopicCompletion", QualTopicCompletion],
  ];

  const beforeCounts = {};
  for (const [label, Model] of ALL_MODELS) {
    beforeCounts[label] = await Model.countDocuments();
  }

  const stats = {};
  async function upsertOne(Model, label, filter, extra = {}) {
    stats[label] = stats[label] || { existing: 0, created: 0 };
    const found = await Model.findOne(filter).lean();
    if (found) {
      stats[label].existing++;
      return found;
    }
    stats[label].created++;
    if (DRY) {
      return { _id: new mongoose.Types.ObjectId(), ...filter, ...extra, __simulated: true };
    }
    const doc = await Model.create({ ...filter, ...extra });
    return doc.toObject ? doc.toObject() : doc;
  }

  log("── 0. Oldingi seedlar tekshiruvi ───────────────────────────────────");
  const teacher1 = await User.findOne({ oneIdPin: "22222222222222" }).select("_id firstName lastName oneIdPin");
  const teacher2 = await User.findOne({ oneIdPin: "22222222222201" }).select("_id firstName lastName oneIdPin");
  const listenerUsers = {};
  for (const pin of ["33333333333333", "33333333333301", "33333333333302", "33333333333303", "33333333333304"]) {
    listenerUsers[pin] = await User.findOne({ oneIdPin: pin }).select("_id firstName lastName middleName oneIdPin");
  }
  const missing = [];
  if (!teacher1) missing.push("22222222222222 (malaka-teacher.seed.js)");
  if (!teacher2) missing.push("22222222222201 (malaka-users.seed.js)");
  for (const [pin, u] of Object.entries(listenerUsers)) {
    if (!u) missing.push(`${pin} (malaka-tinglovchi.seed.js / malaka-users.seed.js)`);
  }
  if (missing.length) {
    console.error("  ✖ TO'XTATILDI — quyidagi test foydalanuvchilar topilmadi:");
    missing.forEach((m) => console.error(`      - ${m}`));
    console.error(
      "\n  Avval ishga tushiring: node seed/malaka-teacher.seed.js && node seed/malaka-tinglovchi.seed.js && node seed/malaka-users.seed.js",
    );
    await mongoose.disconnect();
    process.exit(1);
  }
  log(`  ✓ O'qituvchilar: ${teacher1.lastName} ${teacher1.firstName}, ${teacher2.lastName} ${teacher2.firstName}`);
  log(`  ✓ Tinglovchilar: ${Object.values(listenerUsers).map((u) => u.oneIdPin).join(", ")}`);

  log("\n── 1. Manzil ma'lumotnomasi (province/region) ─────────────────────");
  const province = await upsertOne(Province, "province", { title: "Farg'ona viloyati" }, { active: true });
  const region = await upsertOne(
    Region,
    "region",
    { title: "Farg'ona shahri", province: province._id },
    { active: true },
  );
  log(`  province: ${stats.province.existing} bor / ${stats.province.created} yangi`);
  log(`  region  : ${stats.region.existing} bor / ${stats.region.created} yangi`);

  log("\n── 2. Kurs turlari (qualCourseType) ────────────────────────────────");
  const courseTypeCert = await upsertOne(
    QualCourseType,
    "qualCourseType",
    { title: "Malaka oshirish sertifikati" },
    { kind: 1, template: 1 },
  );
  const courseTypeRef = await upsertOne(
    QualCourseType,
    "qualCourseType",
    { title: "Malaka oshirish ma'lumotnomasi" },
    { kind: 2, template: 2 },
  );
  log(`  ${stats.qualCourseType.existing} bor / ${stats.qualCourseType.created} yangi`);

  log("\n── 3. Kurslar (qualCourse) ─────────────────────────────────────────");
  const now = new Date();
  const inDays = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  const courseA = await upsertOne(
    QualCourse,
    "qualCourse",
    { title: "Kimyo o'qitish metodikasi" },
    {
      courseType: courseTypeCert._id,
      creditHours: 72,
      price: 1500000,
      form: 1,
      listenersLimit: 30,
      startDate: inDays(-10),
      endDate: inDays(50),
      teachers: [teacher1._id, teacher2._id],
      status: 2,
      accessTest: { randomQuestions: 3, duration: 15 },
      exitTest: { passPercentage: 60, randomQuestions: 3, duration: 20 },
      active: true,
    },
  );
  const courseB = await upsertOne(
    QualCourse,
    "qualCourse",
    { title: "Zamonaviy pedagogika texnologiyalari" },
    {
      courseType: courseTypeRef._id,
      creditHours: 36,
      price: 900000,
      form: 2,
      listenersLimit: 20,
      startDate: inDays(-5),
      endDate: inDays(20),
      address: "Farg'ona sh., Yalantosh ko'chasi 3-uy",
      location: { lat: "40.3894", lng: "71.7864" },
      teachers: [teacher2._id],
      status: 2,
      accessTest: { randomQuestions: 2, duration: 10 },
      exitTest: { passPercentage: 60, randomQuestions: 2, duration: 15 },
      active: true,
    },
  );
  const courseC = await upsertOne(
    QualCourse,
    "qualCourse",
    { title: "Ichki kasalliklar diagnostikasi" },
    {
      courseType: courseTypeCert._id,
      creditHours: 144,
      price: 2500000,
      form: 1,
      listenersLimit: 25,
      startDate: inDays(15),
      endDate: inDays(90),
      teachers: [teacher1._id],
      status: 1,
      active: true,
    },
  );
  log(`  ${stats.qualCourse.existing} bor / ${stats.qualCourse.created} yangi (A/B/C)`);

  log("\n── 4. Kalendar rejalar + Xabarnomalar ──────────────────────────────");
  const calPlanFile = appendSignature(`${process.env.PORT ? `http://localhost:${process.env.PORT}` : "http://localhost:4100"}/files/bachelor/17857435019230.pdf`);
  for (const title of ["2026-yil kalendar rejasi", "Yozgi malaka oshirish grafigi", "Qishki malaka oshirish grafigi"]) {
    await upsertOne(QualCalendarPlan, "qualCalendarPlan", { title }, { file: calPlanFile });
  }
  for (const title of [
    "Yangi qabul boshlandi — 2026",
    "Kimyo kursi uchun joylar tugamoqda",
    "Chiqish testi jadvali e'lon qilindi",
  ]) {
    await upsertOne(QualNotification, "qualNotification", { title });
  }
  log(`  qualCalendarPlan: ${stats.qualCalendarPlan.existing} bor / ${stats.qualCalendarPlan.created} yangi`);
  log(`  qualNotification: ${stats.qualNotification.existing} bor / ${stats.qualNotification.created} yangi`);

  log("\n── 5. Mavzular (qualTopic) ──────────────────────────────────────────");
  const FINAL_TEST_A = { passPercentage: 60, totalQuestions: 5, duration: 20 };
  const topicsA = [];
  for (const t of [
    { orderNumber: 1, title: "Kimyoning nazariy asoslari", kind: 1, duration: 2 },
    { orderNumber: 2, title: "Anorganik kimyo o'qitish metodikasi", kind: 1, duration: 2 },
    { orderNumber: 3, title: "Organik kimyo o'qitish metodikasi", kind: 1, duration: 2 },
  ]) {
    topicsA.push(
      await upsertOne(
        QualTopic,
        "qualTopic",
        { course: courseA._id, orderNumber: t.orderNumber },
        { title: t.title, kind: t.kind, duration: t.duration, finalTest: FINAL_TEST_A },
      ),
    );
  }
  const topicsB = [];
  for (const t of [
    { orderNumber: 1, title: "Pedagogik texnologiyalar nazariyasi", kind: 1, duration: 3 },
    { orderNumber: 2, title: "Interaktiv metodlar amaliyoti", kind: 2, duration: 3 },
  ]) {
    topicsB.push(
      await upsertOne(
        QualTopic,
        "qualTopic",
        { course: courseB._id, orderNumber: t.orderNumber },
        { title: t.title, kind: t.kind, duration: t.duration },
      ),
    );
  }
  const topicsC = [];
  for (const t of [
    { orderNumber: 1, title: "Diagnostika asoslari", kind: 1, duration: 4 },
    { orderNumber: 2, title: "Klinik amaliyot", kind: 2, duration: 4 },
  ]) {
    topicsC.push(
      await upsertOne(
        QualTopic,
        "qualTopic",
        { course: courseC._id, orderNumber: t.orderNumber },
        { title: t.title, kind: t.kind, duration: t.duration },
      ),
    );
  }
  log(`  ${stats.qualTopic.existing} bor / ${stats.qualTopic.created} yangi (A:3, B:2, C:2)`);

  log("\n── 6. O'quv materiallar ─────────────────────────────────────────────");
  const bachelorPdf = (n) =>
    appendSignature(
      `${process.env.PORT ? `http://localhost:${process.env.PORT}` : "http://localhost:4100"}/files/bachelor/${n}`,
    );
  const BACHELOR_FILES = ["17857435019230.pdf", "17857435328540.pdf", "17857437943200.pdf"];

  await upsertOne(
    QualTopicLecture,
    "qualTopicLecture",
    { topic: topicsA[0]._id, title: "1-ma'ruza: Kimyo asoslari" },
    { course: courseA._id, file: bachelorPdf(BACHELOR_FILES[0]) },
  );
  await upsertOne(
    QualTopicLecture,
    "qualTopicLecture",
    { topic: topicsB[0]._id, title: "1-ma'ruza: Pedagogik texnologiyalar" },
    { course: courseB._id, file: bachelorPdf(BACHELOR_FILES[1]) },
  );
  await upsertOne(
    QualTopicLecture,
    "qualTopicLecture",
    { topic: topicsC[0]._id, title: "1-ma'ruza: Diagnostika kirish" },
    { course: courseC._id, file: bachelorPdf(BACHELOR_FILES[2]) },
  );

  await upsertOne(
    QualTopicPractical,
    "qualTopicPractical",
    { topic: topicsA[1]._id, title: "Amaliy topshiriq: anorganik reaksiyalar" },
    { course: courseA._id, file: bachelorPdf(BACHELOR_FILES[0]) },
  );
  await upsertOne(
    QualTopicPractical,
    "qualTopicPractical",
    { topic: topicsB[1]._id, title: "Amaliy topshiriq: interaktiv dars" },
    { course: courseB._id, file: bachelorPdf(BACHELOR_FILES[1]) },
  );

  const fakeVideoUrl = (n) =>
    `${process.env.PORT ? `http://localhost:${process.env.PORT}` : "http://localhost:4100"}/files/video/qualification-topic-videos/demo-${n}.mp4`;
  await upsertOne(
    QualTopicVideo,
    "qualTopicVideo",
    { topic: topicsA[2]._id, title: "Video dars: organik kimyo" },
    { course: courseA._id, videoRaw: fakeVideoUrl(1) },
  );
  await upsertOne(
    QualTopicVideo,
    "qualTopicVideo",
    { topic: topicsC[1]._id, title: "Video dars: klinik amaliyot" },
    { course: courseC._id, videoRaw: fakeVideoUrl(2) },
  );

  await upsertOne(
    QualTopicScenario,
    "qualTopicScenario",
    { topic: topicsB[0]._id, title: "Vaziyatli masala: metod tanlash" },
    {
      course: courseB._id,
      text: "Guruhda turli bilim darajasidagi tinglovchilar bor. Qanday metod tanlaysiz?",
    },
  );
  await upsertOne(
    QualTopicScenario,
    "qualTopicScenario",
    { topic: topicsC[0]._id, title: "Vaziyatli masala: shoshilinch holat" },
    {
      course: courseC._id,
      text: "Bemorda shoshilinch alomatlar aniqlandi. Diagnostik ketma-ketlikni tavsiflang.",
    },
  );

  const opt4 = (correctIdx, labels) => labels.map((text, i) => ({ text, isCorrect: i === correctIdx }));
  const finalTestA1 = [];
  finalTestA1.push(
    await upsertOne(
      QualTopicFinalTest,
      "qualTopicFinalTest",
      { topic: topicsA[0]._id, question: "Kimyoviy reaksiya turi qaysi?" },
      {
        course: courseA._id,
        testType: 1,
        options: opt4(0, ["Almashinish", "Notekis", "Xayoliy", "Statik"]),
        order: 1,
      },
    ),
  );
  finalTestA1.push(
    await upsertOne(
      QualTopicFinalTest,
      "qualTopicFinalTest",
      { topic: topicsA[0]._id, question: "Davriy jadvalni kim yaratgan?" },
      {
        course: courseA._id,
        testType: 1,
        options: opt4(2, ["Bor", "Kюri", "Mendeleyev", "Nyuton"]),
        order: 2,
      },
    ),
  );
  const finalTestA2 = [
    await upsertOne(
      QualTopicFinalTest,
      "qualTopicFinalTest",
      { topic: topicsA[1]._id, question: "Anorganik kimyo nimani o'rganadi?" },
      {
        course: courseA._id,
        testType: 1,
        options: opt4(1, ["Faqat organik moddalar", "Metall va nometallar birikmalari", "Faqat gazlar", "Faqat suv"]),
        order: 1,
      },
    ),
  ];
  const finalTestB1 = [
    await upsertOne(
      QualTopicFinalTest,
      "qualTopicFinalTest",
      { topic: topicsB[0]._id, question: "Interaktiv metodning asosiy belgisi?" },
      {
        course: courseB._id,
        testType: 1,
        options: opt4(3, ["Faqat ma'ruza", "Faqat test", "Faqat kitob", "Ikki tomonlama muloqot"]),
        order: 1,
      },
    ),
  ];
  log(`  qualTopicLecture  : ${stats.qualTopicLecture.existing} bor / ${stats.qualTopicLecture.created} yangi`);
  log(`  qualTopicPractical: ${stats.qualTopicPractical.existing} bor / ${stats.qualTopicPractical.created} yangi`);
  log(`  qualTopicVideo    : ${stats.qualTopicVideo.existing} bor / ${stats.qualTopicVideo.created} yangi`);
  log(`  qualTopicScenario : ${stats.qualTopicScenario.existing} bor / ${stats.qualTopicScenario.created} yangi`);
  log(`  qualTopicFinalTest: ${stats.qualTopicFinalTest.existing} bor / ${stats.qualTopicFinalTest.created} yangi`);

  log("\n── 7. Manbalar (qualSource) ─────────────────────────────────────────");
  await upsertOne(
    QualSource,
    "qualSource",
    { course: courseA._id, title: "Kimyo darsligi (PDF)" },
    { file: bachelorPdf(BACHELOR_FILES[0]), fileDetails: { name: "kimyo-darslik.pdf" } },
  );
  await upsertOne(
    QualSource,
    "qualSource",
    { course: courseA._id, title: "Metodik qo'llanma" },
    { file: bachelorPdf(BACHELOR_FILES[1]), fileDetails: { name: "metodik-qollanma.pdf" }, link: "https://example.uz/kimyo" },
  );
  await upsertOne(
    QualSource,
    "qualSource",
    { course: courseB._id, title: "Pedagogika nazariyasi (PDF)" },
    { file: bachelorPdf(BACHELOR_FILES[1]), fileDetails: { name: "pedagogika.pdf" } },
  );
  await upsertOne(
    QualSource,
    "qualSource",
    { course: courseC._id, title: "Diagnostika qo'llanmasi (PDF)" },
    { file: bachelorPdf(BACHELOR_FILES[2]), fileDetails: { name: "diagnostika.pdf" } },
  );
  log(`  ${stats.qualSource.existing} bor / ${stats.qualSource.created} yangi`);

  log("\n── 8. Kirish/Chiqish testi savol-banki ──────────────────────────────");
  const accessA = [];
  accessA.push(
    await upsertOne(
      QualAccessTest,
      "qualAccessTest",
      { course: courseA._id, question: "Kimyo fanining asosiy birligi?" },
      { testType: 1, options: opt4(0, ["Atom", "Hujayra", "Neyron", "Molekula emas"]), order: 1 },
    ),
  );
  accessA.push(
    await upsertOne(
      QualAccessTest,
      "qualAccessTest",
      { course: courseA._id, question: "H2O formulasi nimani anglatadi?" },
      { testType: 1, options: opt4(1, ["Vodorod peroksid", "Suv", "Kislorod", "Vodorod gazi"]), order: 2 },
    ),
  );
  accessA.push(
    await upsertOne(
      QualAccessTest,
      "qualAccessTest",
      { course: courseA._id, question: "pH shkalasi nechtagacha?" },
      { testType: 1, options: opt4(2, ["7", "10", "14", "100"]), order: 3 },
    ),
  );
  const accessB = [];
  accessB.push(
    await upsertOne(
      QualAccessTest,
      "qualAccessTest",
      { course: courseB._id, question: "Pedagogika fani nimani o'rganadi?" },
      { testType: 1, options: opt4(0, ["Ta'lim-tarbiya", "Fizika", "Biologiya", "Kimyo"]), order: 1 },
    ),
  );
  accessB.push(
    await upsertOne(
      QualAccessTest,
      "qualAccessTest",
      { course: courseB._id, question: "Interfaol metodga misol?" },
      { testType: 1, options: opt4(3, ["Ma'ruza", "Test", "Kitob o'qish", "Klaster"]), order: 2 },
    ),
  );

  const exitA = [];
  exitA.push(
    await upsertOne(
      QualExitTest,
      "qualExitTest",
      { course: courseA._id, question: "Metallar davriy jadvalning qaysi qismida?" },
      { testType: 1, options: opt4(0, ["Chapda", "O'ngda", "Markazda", "Yo'q"]), order: 1 },
    ),
  );
  exitA.push(
    await upsertOne(
      QualExitTest,
      "qualExitTest",
      { course: courseA._id, question: "Organik kimyo asosan qaysi elementga bog'liq?" },
      { testType: 1, options: opt4(1, ["Temir", "Uglerod", "Kislorod", "Oltin"]), order: 2 },
    ),
  );
  exitA.push(
    await upsertOne(
      QualExitTest,
      "qualExitTest",
      { course: courseA._id, question: "Kislotaning asosiy xossasi?" },
      { testType: 1, options: opt4(2, ["Shirin", "Sovuq", "Nordon ta'm", "Rangsiz"]), order: 3 },
    ),
  );
  const exitB = [];
  exitB.push(
    await upsertOne(
      QualExitTest,
      "qualExitTest",
      { course: courseB._id, question: "Zamonaviy dars qanday tashkil etiladi?" },
      { testType: 1, options: opt4(0, ["Tinglovchi faol ishtirokida", "Faqat ma'ruza", "Faqat mustaqil ish", "Umuman tashkil etilmaydi"]), order: 1 },
    ),
  );
  exitB.push(
    await upsertOne(
      QualExitTest,
      "qualExitTest",
      { course: courseB._id, question: "Baholash turlaridan biri?" },
      { testType: 1, options: opt4(2, ["Faqat imtihon", "Faqat davomat", "Formativ baholash", "Baholanmaydi"]), order: 2 },
    ),
  );
  log(`  qualAccessTest: ${stats.qualAccessTest.existing} bor / ${stats.qualAccessTest.created} yangi`);
  log(`  qualExitTest  : ${stats.qualExitTest.existing} bor / ${stats.qualExitTest.created} yangi`);

  log("\n── 9. Test sozlamalari (qualTestConfig) ─────────────────────────────");
  for (const course of [courseA, courseB]) {
    await upsertOne(
      QualTestConfig,
      "qualTestConfig",
      { course: course._id, kind: 1, topic: null },
      { timeLimit: 15, randomCount: 0, passPercentage: 60 },
    );
    await upsertOne(
      QualTestConfig,
      "qualTestConfig",
      { course: course._id, kind: 2, topic: null },
      { timeLimit: 20, randomCount: 0, passPercentage: 60 },
    );
  }
  log(`  ${stats.qualTestConfig.existing} bor / ${stats.qualTestConfig.created} yangi`);

  log("\n── 10. Arizalar (qualPetition) — status aralash ─────────────────────");
  const fullName = (u) => [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ");
  const bachelorFor = (i) => bachelorPdf(BACHELOR_FILES[i % BACHELOR_FILES.length]);

  const PETITION_PLAN = [
    { course: courseA, pin: "33333333333333", status: 2 },
    { course: courseA, pin: "33333333333301", status: 2 },
    { course: courseA, pin: "33333333333302", status: 1 },
    { course: courseB, pin: "33333333333303", status: 2 },
    { course: courseB, pin: "33333333333304", status: 3 },
    { course: courseC, pin: "33333333333301", status: 1 },
    { course: courseC, pin: "33333333333302", status: 2 },
  ];

  const petitions = [];
  for (const p of PETITION_PLAN) {
    const u = listenerUsers[p.pin];
    const doc = await upsertOne(
      QualPetition,
      "qualPetition",
      { passport: p.pin, course: p.course._id },
      {
        fullName: fullName(u),
        bachelorDiploma: bachelorFor(PETITION_PLAN.indexOf(p)),
        province: province._id,
        region: region._id,
        institution: "Farg'ona jamoat salomatligi tibbiyot instituti",
        phone: "+998901112200",
        status: p.status,
      },
    );
    petitions.push({ ...p, doc });
  }
  log(`  ${stats.qualPetition.existing} bor / ${stats.qualPetition.created} yangi (2 kutilmoqda / 4 tasdiqlangan / 1 rad etilgan)`);

  log("\n── 11. Tasdiqlangan arizalar → Tinglovchi/Obuna/Shartnoma ───────────");
  let contractCount = DRY ? await QualContract.countDocuments() : await QualContract.countDocuments();
  const listenersByPin = {};
  const contractsByKey = {};

  for (const p of petitions.filter((x) => x.status === 2)) {
    const u = listenerUsers[p.pin];
    const listener = await upsertOne(QualListener, "qualListener", { passport: p.pin }, { fullName: fullName(u) });
    listenersByPin[p.pin] = listener;

    await upsertOne(
      QualCourseSubscription,
      "qualCourseSubscription",
      { course: p.course._id, listener: listener._id },
      { educationType: 2 },
    );

    const contractFilter = { course: p.course._id, listener: listener._id };
    const existingContract = await QualContract.findOne(contractFilter).lean();
    let contract;
    if (existingContract) {
      stats.qualContract = stats.qualContract || { existing: 0, created: 0 };
      stats.qualContract.existing++;
      contract = existingContract;
    } else {
      stats.qualContract = stats.qualContract || { existing: 0, created: 0 };
      stats.qualContract.created++;
      contractCount++;
      const number = String(contractCount).padStart(4, "0");
      const price = p.course.price || 0;
      if (DRY) {
        contract = { _id: new mongoose.Types.ObjectId(), ...contractFilter, number, totalPrice: price, debitPrice: price, __simulated: true };
      } else {
        contract = (
          await QualContract.create({
            ...contractFilter,
            petition: p.doc._id,
            number,
            totalPrice: price,
            debitPrice: price,
            file: bachelorPdf(BACHELOR_FILES[0]),
          })
        ).toObject();
      }
    }
    contractsByKey[`${p.course._id}_${p.pin}`] = contract;
  }
  log(`  qualListener            : ${stats.qualListener.existing} bor / ${stats.qualListener.created} yangi`);
  log(`  qualCourseSubscription  : ${stats.qualCourseSubscription.existing} bor / ${stats.qualCourseSubscription.created} yangi`);
  log(`  qualContract            : ${stats.qualContract.existing} bor / ${stats.qualContract.created} yangi`);

  log("\n── 12. To'lovlar (qualPayment) ──────────────────────────────────────");
  const cA_L1 = contractsByKey[`${courseA._id}_33333333333333`];
  const cA_L2 = contractsByKey[`${courseA._id}_33333333333301`];
  const cB_L4 = contractsByKey[`${courseB._id}_33333333333303`];
  if (cA_L1) {
    await upsertOne(
      QualPayment,
      "qualPayment",
      { contract: cA_L1._id, transactionId: "BANK-DEMO-0001" },
      {
        course: courseA._id,
        listener: listenersByPin["33333333333333"]._id,
        date: inDays(-3),
        method: 3,
        price: cA_L1.totalPrice,
        status: 1,
      },
    );
  }
  if (cA_L2) {
    await upsertOne(
      QualPayment,
      "qualPayment",
      { contract: cA_L2._id, transactionId: "CLICK-DEMO-0002" },
      {
        course: courseA._id,
        listener: listenersByPin["33333333333301"]._id,
        date: inDays(-2),
        method: 1,
        price: cA_L2.totalPrice,
        status: 2,
      },
    );
  }
  if (cB_L4) {
    await upsertOne(
      QualPayment,
      "qualPayment",
      { contract: cB_L4._id, transactionId: "CLICK-DEMO-0003" },
      {
        course: courseB._id,
        listener: listenersByPin["33333333333303"]._id,
        date: inDays(-1),
        method: 1,
        price: cB_L4.totalPrice,
        status: 2,
      },
    );
  }
  log(`  ${stats.qualPayment.existing} bor / ${stats.qualPayment.created} yangi (4-chi shartnoma — C/L3 — ataylab to'lovsiz qoldi)`);

  log("\n── 13. Test natijalari ──────────────────────────────────────────────");
  const snapshot = (bankDocs, correctCount) =>
    bankDocs.map((q, idx) => {
      const correct = idx < correctCount;
      const selIdx = q.options.findIndex((o) => (correct ? o.isCorrect : !o.isCorrect));
      return {
        isSelectedCorrect: correct,
        testType: q.testType,
        question: q.question,
        options: q.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, isSelected: i === selIdx })),
      };
    });

  const L1 = listenersByPin["33333333333333"];
  const L2 = listenersByPin["33333333333301"];
  const L4 = listenersByPin["33333333333303"];

  await upsertOne(
    QualAccessTestResult,
    "qualAccessTestResult",
    { course: courseA._id, listener: L1._id },
    {
      totalQuestions: accessA.length,
      totalCorrects: accessA.length,
      questions: snapshot(accessA, accessA.length),
      startDate: inDays(-6),
      endDate: inDays(-6),
      finishedDate: inDays(-6),
      status: 2,
    },
  );
  await upsertOne(
    QualAccessTestResult,
    "qualAccessTestResult",
    { course: courseA._id, listener: L2._id },
    {
      totalQuestions: accessA.length,
      totalCorrects: 1,
      questions: snapshot(accessA, 1),
      startDate: inDays(-6),
      endDate: inDays(-6),
      finishedDate: inDays(-6),
      status: 2,
    },
  );

  await upsertOne(
    QualExitTestResult,
    "qualExitTestResult",
    { course: courseA._id, listener: L1._id },
    {
      passPercentage: 60,
      percentage: 100,
      totalQuestions: exitA.length,
      totalCorrects: exitA.length,
      isPassed: true,
      questions: snapshot(exitA, exitA.length),
      startDate: inDays(-1),
      endDate: inDays(-1),
      finishedDate: inDays(-1),
      status: 2,
    },
  );
  await upsertOne(
    QualExitTestResult,
    "qualExitTestResult",
    { course: courseA._id, listener: L2._id },
    {
      passPercentage: 60,
      percentage: 33,
      totalQuestions: exitA.length,
      totalCorrects: 1,
      isPassed: false,
      questions: snapshot(exitA, 1),
      startDate: inDays(-1),
      endDate: inDays(-1),
      finishedDate: inDays(-1),
      status: 2,
    },
  );
  await upsertOne(
    QualExitTestResult,
    "qualExitTestResult",
    { course: courseB._id, listener: L4._id },
    {
      passPercentage: 60,
      percentage: 100,
      totalQuestions: exitB.length,
      totalCorrects: exitB.length,
      isPassed: true,
      questions: snapshot(exitB, exitB.length),
      startDate: inDays(-1),
      endDate: inDays(-1),
      finishedDate: inDays(-1),
      status: 2,
    },
  );

  await upsertOne(
    QualFinalTestResult,
    "qualFinalTestResult",
    { course: courseA._id, topic: topicsA[0]._id, listener: L1._id },
    {
      passPercentage: 60,
      totalQuestions: finalTestA1.length,
      totalCorrects: finalTestA1.length,
      isPassed: true,
      questions: snapshot(finalTestA1, finalTestA1.length),
      startDate: inDays(-8),
      endDate: inDays(-8),
      finishedDate: inDays(-8),
      status: 2,
    },
  );
  await upsertOne(
    QualFinalTestResult,
    "qualFinalTestResult",
    { course: courseA._id, topic: topicsA[1]._id, listener: L1._id },
    {
      passPercentage: 60,
      totalQuestions: finalTestA2.length,
      totalCorrects: finalTestA2.length,
      isPassed: true,
      questions: snapshot(finalTestA2, finalTestA2.length),
      startDate: inDays(-7),
      endDate: inDays(-7),
      finishedDate: inDays(-7),
      status: 2,
    },
  );
  await upsertOne(
    QualFinalTestResult,
    "qualFinalTestResult",
    { course: courseA._id, topic: topicsA[0]._id, listener: L2._id },
    {
      passPercentage: 60,
      totalQuestions: finalTestA1.length,
      totalCorrects: 0,
      isPassed: false,
      questions: snapshot(finalTestA1, 0),
      startDate: inDays(-8),
      endDate: inDays(-8),
      finishedDate: inDays(-8),
      status: 2,
    },
  );
  log(`  qualAccessTestResult: ${stats.qualAccessTestResult.existing} bor / ${stats.qualAccessTestResult.created} yangi`);
  log(`  qualExitTestResult  : ${stats.qualExitTestResult.existing} bor / ${stats.qualExitTestResult.created} yangi`);
  log(`  qualFinalTestResult : ${stats.qualFinalTestResult.existing} bor / ${stats.qualFinalTestResult.created} yangi`);

  log("\n── 14. Mavzu o'zlashtirish (qualTopicCompletion) ────────────────────");
  await upsertOne(
    QualTopicCompletion,
    "qualTopicCompletion",
    { course: courseA._id, topic: topicsA[0]._id, listener: L1._id },
    { startedAt: inDays(-9), status: 5, isLocked: 1 },
  );
  await upsertOne(
    QualTopicCompletion,
    "qualTopicCompletion",
    { course: courseA._id, topic: topicsA[1]._id, listener: L1._id },
    { startedAt: inDays(-7), status: 2, isLocked: 1 },
  );
  await upsertOne(
    QualTopicCompletion,
    "qualTopicCompletion",
    { course: courseA._id, topic: topicsA[0]._id, listener: L2._id },
    { startedAt: inDays(-8), status: 1, isLocked: 1 },
  );
  await upsertOne(
    QualTopicCompletion,
    "qualTopicCompletion",
    { course: courseB._id, topic: topicsB[0]._id, listener: L4._id },
    { startedAt: inDays(-4), status: 5, isLocked: 1 },
  );
  log(`  ${stats.qualTopicCompletion.existing} bor / ${stats.qualTopicCompletion.created} yangi`);

  log("\n── 15. Sertifikat/ma'lumotnoma (qualEarnedCertificate) ──────────────");
  await upsertOne(
    QualEarnedCertificate,
    "qualEarnedCertificate",
    { course: courseA._id, listener: L1._id, kind: 1 },
    { template: 1, number: "0001", file: bachelorPdf(BACHELOR_FILES[0]) },
  );
  await upsertOne(
    QualEarnedCertificate,
    "qualEarnedCertificate",
    { course: courseB._id, listener: L4._id, kind: 1 },
    { template: 1, number: "0002", file: bachelorPdf(BACHELOR_FILES[1]) },
  );
  await upsertOne(
    QualEarnedCertificate,
    "qualEarnedCertificate",
    { course: courseA._id, listener: L2._id, kind: 2 },
    { template: 1, number: "0001", file: bachelorPdf(BACHELOR_FILES[2]) },
  );
  log(`  ${stats.qualEarnedCertificate.existing} bor / ${stats.qualEarnedCertificate.created} yangi (2 sertifikat, 1 ma'lumotnoma)`);

  const afterCounts = {};
  for (const [label, Model] of ALL_MODELS) {
    afterCounts[label] = await Model.countDocuments();
  }

  log("\n═══════════════════════════════════════════════════════════════════");
  log(`  KOLLEKSIYA HOLATI (${DRY ? "DRY-RUN — DB o'zgarmadi, sonlar SEED OLDIDAN" : "seeddan KEYIN"})`);
  log("═══════════════════════════════════════════════════════════════════");
  for (const [label] of ALL_MODELS) {
    const before = beforeCounts[label];
    const after = afterCounts[label];
    const created = (stats[label] && stats[label].created) || 0;
    const wasEmpty = before === 0 ? " ← BO'SH EDI" : "";
    log(
      `  ${label.padEnd(24)} oldin=${String(before).padStart(3)}  keyin=${String(after).padStart(3)}  (+${created}${DRY ? " simulyatsiya" : ""})${wasEmpty}`,
    );
  }

  log("\n═══════════════════════════════════════════════════════════════════");
  if (DRY) {
    log("  🔍 DRY-RUN — HECH NARSA YOZILMADI. Yozish uchun: --write");
  } else {
    log("  ✓ Demo ma'lumot tayyor (4.4 Malaka oshirish).");
    log("\n  Login PIN'lar:");
    log("    11111111111111 → malaka_menejer");
    log("    22222222222222 → malaka_oqituvchi");
    log("    33333333333333 → malaka_tinglovchi (Course A: tasdiqlangan, kirish/chiqish/final o'tgan, sertifikat bor)");
    log("    33333333333301 → malaka_tinglovchi (Course A: tasdiqlangan, chiqish testi o'tmagan → ma'lumotnoma; Course C: kutilmoqda)");
    log("    33333333333302 → malaka_tinglovchi (Course A: kutilmoqda; Course C: tasdiqlangan)");
    log("    33333333333303 → malaka_tinglovchi (Course B: tasdiqlangan, to'liq o'tgan, sertifikat bor)");
    log("    33333333333304 → malaka_tinglovchi (Course B: rad etilgan)");
  }
  log("═══════════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n[MalakaDemoData Seed] XATO:", err.message);
  if (err.errors) {
    Object.entries(err.errors).forEach(([field, e]) => console.error(`  - ${field}: ${e.message}`));
  }
  mongoose.disconnect().finally(() => process.exit(1));
});
