"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((s) => s.set("id", false));

const QualCourse = require("../src/modules/4.04-qualification/qualCourse/qualCourse.model");
const QualTopic = require("../src/modules/4.04-qualification/qualTopic/qualTopic.model");
const QualListener = require("../src/modules/4.04-qualification/_shared/qualListener.model");
const QualFinalTestResult = require("../src/modules/4.04-qualification/qualFinalTestResult/qualFinalTestResult.model");
const QualExitTestResult = require("../src/modules/4.04-qualification/qualExitTestResult/qualExitTestResult.model");
const QualTopicScenario = require("../src/modules/4.04-qualification/_shared/qualTopicScenario.model");
const QualTopicCompletion = require("../src/modules/4.04-qualification/qualTopicCompletion/qualTopicCompletion.model");
const QualContract = require("../src/modules/4.04-qualification/qualContract/qualContract.model");
const QualPayment = require("../src/modules/4.04-qualification/qualPayment/qualPayment.model");

const COURSE_TITLE = "Kimyo o'qitish metodikasi";
const PASSPORT = "33333333333333";

const TOPICS = [
  { orderNumber: 1, title: "Kimyoning nazariy asoslari", kind: 1, duration: 2 },
  { orderNumber: 2, title: "Anorganik kimyo o'qitish metodikasi", kind: 1, duration: 2 },
  { orderNumber: 3, title: "Organik kimyo o'qitish metodikasi", kind: 1, duration: 2 },
];
const FINAL_TEST = { passPercentage: 60, totalQuestions: 5, duration: 20 };

const RESULTS = [
  { orderNumber: 1, totalCorrects: 5, isPassed: true },
  { orderNumber: 2, totalCorrects: 4, isPassed: true },
  { orderNumber: 3, totalCorrects: 2, isPassed: false },
];
const EXIT = { totalQuestions: 10, totalCorrects: 8, percentage: 80, passPercentage: 60, isPassed: true };

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[Kimyo Demo Seed] MongoDB ga ulandi\n");

  const course = await QualCourse.findOne({ title: COURSE_TITLE }).lean();
  if (!course) {
    console.error(`  ✗ Kurs topilmadi: "${COURSE_TITLE}"`);
    console.error(`    → avval ishga tushiring: node seed/malaka-demo-data.seed.js --write`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const listener = await QualListener.findOne({ passport: PASSPORT }).lean();
  if (!listener) {
    console.error(`  ✗ Tinglovchi topilmadi: ${PASSPORT}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`  Kurs      : ${course._id} "${course.title}"`);
  console.log(`  Tinglovchi: ${listener._id} ${listener.fullName}\n`);

  console.log("── 1. Mavzular ────────────────────────────────────────────────");
  const topicByOrder = {};
  for (const tp of TOPICS) {
    const doc = await QualTopic.findOneAndUpdate(
      { course: course._id, orderNumber: tp.orderNumber },
      { $set: { ...tp, course: course._id, finalTest: FINAL_TEST } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    topicByOrder[tp.orderNumber] = doc._id;
    console.log(`  ✓ ${tp.orderNumber}. ${tp.title}`);
  }

  console.log("\n── 2. Yakuniy test natijalari (Malaka Tinglovchi) ─────────────");
  for (const r of RESULTS) {
    const topicId = topicByOrder[r.orderNumber];
    await QualFinalTestResult.findOneAndUpdate(
      { course: course._id, topic: topicId, listener: listener._id },
      {
        $set: {
          course: course._id,
          topic: topicId,
          listener: listener._id,
          passPercentage: FINAL_TEST.passPercentage,
          totalQuestions: FINAL_TEST.totalQuestions,
          totalCorrects: r.totalCorrects,
          isPassed: r.isPassed,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    const pct = Math.round((r.totalCorrects / FINAL_TEST.totalQuestions) * 100);
    console.log(`  ✓ Mavzu ${r.orderNumber}: ${r.totalCorrects}/${FINAL_TEST.totalQuestions} (${pct}%) ${r.isPassed ? "o'tdi" : "o'tmadi"}`);
  }

  console.log("\n── 3. Chiqish testi natijasi ──────────────────────────────────");
  await QualExitTestResult.findOneAndUpdate(
    { course: course._id, listener: listener._id },
    {
      $set: {
        course: course._id,
        listener: listener._id,
        passPercentage: EXIT.passPercentage,
        percentage: EXIT.percentage,
        totalQuestions: EXIT.totalQuestions,
        totalCorrects: EXIT.totalCorrects,
        isPassed: EXIT.isPassed,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  console.log(`  ✓ Chiqish: ${EXIT.totalCorrects}/${EXIT.totalQuestions} (${EXIT.percentage}%) o'tdi`);

  console.log("\n── 4. Vaziyatli masala (savol + javob) ────────────────────────");
  const SCENARIOS = [
    {
      orderNumber: 1,
      title: "Vaziyatli masala: guruhdagi nizo",
      text: "O'quvchilar guruhida ikki tinglovchi o'rtasida nizo kelib chiqdi va bu darsga xalaqit bermoqda. O'qituvchi sifatida vaziyatni qanday hal qilasiz?",
      answer: "Guruh ichidagi mojaroni hal qilish uchun avval har ikki tomonni alohida tinglayman, so'ng umumiy maqsadga yo'naltirib, hamkorlikdagi topshiriq beraman.",
      image: "http://localhost:4000/files/file/qualification-course-types/1782892538108.pdf",
    },
    {
      orderNumber: 2,
      title: "Vaziyatli masala: metod tanlash",
      text: "Zamonaviy ta'lim metodini tanlashda qanday mezonlarni hisobga olasiz? Aniq misol keltiring.",
      answer: "Differentsial yondashuvni tanlayman: tinglovchilarning bilim darajasi va ehtiyojini hisobga olib, guruhlarga bo'lgan holda topshiriq beraman.",
      image: null,
    },
  ];
  for (const s of SCENARIOS) {
    const topicId = topicByOrder[s.orderNumber];
    await QualTopicScenario.findOneAndUpdate(
      { course: course._id, topic: topicId },
      { $set: { title: s.title, text: s.text, course: course._id, topic: topicId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const set = { scenarioAnswer: s.answer };
    if (s.image) set.scenarioImage = s.image;
    await QualTopicCompletion.findOneAndUpdate(
      { course: course._id, topic: topicId, listener: listener._id },
      { $set: set, $setOnInsert: { startedAt: new Date(), status: 4 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log(`  ✓ Mavzu ${s.orderNumber}: savol + javob${s.image ? " + rasm" : ""}`);
  }

  console.log("\n── 5. To'lovlar (To'lov tarixi demo) ──────────────────────────");
  const contract = await QualContract.findOne({
    course: course._id,
    listener: listener._id,
  }).lean();
  if (contract) {
    const PAYMENTS = [
      {
        transactionId: "BANK-2025-0001",
        method: 3,
        price: 600000,
        status: 2,
        date: new Date("2025-03-10"),
        bank: { file: "http://localhost:4000/files/file/qualification-course-types/1782892538108.pdf" },
      },
      { transactionId: "CLICK-9812345678", method: 1, price: 200000, status: 2, date: new Date("2025-03-20") },
    ];
    for (const pm of PAYMENTS) {
      await QualPayment.findOneAndUpdate(
        { contract: contract._id, transactionId: pm.transactionId },
        {
          $set: {
            course: course._id,
            listener: listener._id,
            contract: contract._id,
            date: pm.date,
            method: pm.method,
            price: pm.price,
            status: pm.status,
            transactionId: pm.transactionId,
            ...(pm.bank ? { bank: pm.bank } : {}),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      console.log(`  ✓ ${pm.transactionId}: ${pm.price} so'm (${pm.method === 3 ? "Bank" : "Click"})`);
    }
  } else {
    console.log("  ~ Shartnoma topilmadi — to'lovlar o'tkazib yuborildi");
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  ${TOPICS.length} mavzu + ${RESULTS.length} yakuniy natija + chiqish testi qo'shildi`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[Kimyo Demo Seed] XATO:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
