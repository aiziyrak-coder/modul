"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const DRY = process.argv.includes("--dry");
const passportArg = (process.argv.find((a) => a.startsWith("--listener=")) || "").split("=")[1];

const DEMO_TITLE = "[DEMO] Chiqish testi sinovi";
const DAY = 24 * 60 * 60 * 1000;

const QUESTIONS = [
  {
    question: "Malaka oshirish kursining asosiy maqsadi nima?",
    options: [
      { text: "Kasbiy bilim va ko'nikmalarni yangilash", isCorrect: true },
      { text: "Ish joyini o'zgartirish", isCorrect: false },
      { text: "Ta'til olish", isCorrect: false },
      { text: "Yangi diplom olish", isCorrect: false },
    ],
  },
  {
    question: "Klinik protokol nima uchun kerak?",
    options: [
      { text: "Davolashni yagona standartga solish uchun", isCorrect: true },
      { text: "Hujjat sonini oshirish uchun", isCorrect: false },
      { text: "Bemorlarni ko'paytirish uchun", isCorrect: false },
      { text: "Statistika uchun", isCorrect: false },
    ],
  },
  {
    question: "Simulyatsiya markazining afzalligi nimada?",
    options: [
      { text: "Xavfsiz sharoitda amaliy ko'nikma shakllantirish", isCorrect: true },
      { text: "Dars vaqtini qisqartirish", isCorrect: false },
      { text: "Qog'oz sarfini kamaytirish", isCorrect: false },
      { text: "Bemor bilan uchrashmaslik", isCorrect: false },
    ],
  },
  {
    question: "Interfaol ta'lim usuli qaysi biri?",
    options: [
      { text: "Keys-stadi (holat tahlili)", isCorrect: true },
      { text: "Faqat ma'ruza o'qish", isCorrect: false },
      { text: "Diktant yozdirish", isCorrect: false },
      { text: "Uyga vazifa berish", isCorrect: false },
    ],
  },
  {
    question: "Uzluksiz kasbiy rivojlanish nimani anglatadi?",
    options: [
      { text: "Butun faoliyat davomida muntazam o'qib borish", isCorrect: true },
      { text: "Bir marta malaka oshirish", isCorrect: false },
      { text: "Faqat konferensiyada qatnashish", isCorrect: false },
      { text: "Ish stajini oshirish", isCorrect: false },
    ],
  },
];

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `[QualExitReady Seed] MongoDB ga ulandi${DRY ? " (DRY-RUN, yozilmaydi)" : ""}\n`,
  );

  const Course = require("../src/modules/4.04-qualification/qualCourse/qualCourse.model");
  const CourseType = require("../src/modules/4.04-qualification/qualCourseType/qualCourseType.model");
  const Listener = require("../src/modules/4.04-qualification/_shared/qualListener.model");
  const Subscription = require("../src/modules/4.04-qualification/qualCourseSubscription/qualCourseSubscription.model");
  const ExitTest = require("../src/modules/4.04-qualification/_shared/qualExitTest.model");
  const Petition = require("../src/modules/4.04-qualification/qualPetition/qualPetition.model");
  const ExitResult = require("../src/modules/4.04-qualification/qualExitTestResult/qualExitTestResult.model");
  const Cert = require("../src/modules/4.04-qualification/_shared/qualEarnedCertificate.model");
  const SurveyAnswer = require("../src/modules/4.04-qualification/_shared/qualSurveyAnswer.model");

  const listener = passportArg
    ? await Listener.findOne({ passport: passportArg }).lean()
    : await Listener.findOne().sort({ createdAt: 1 }).lean();
  if (!listener) {
    console.log("  ! Tinglovchi topilmadi — avval tinglovchi yarating");
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`  Tinglovchi: ${listener.fullName}   (passport: ${listener.passport})`);

  const courseType =
    (await CourseType.findOne({ kind: 1, template: 1 }).lean()) ||
    (await CourseType.findOne({ kind: 1 }).lean()) ||
    (await CourseType.findOne().lean());
  if (!courseType) {
    console.log("  ! Kurs turi yo'q — avval kurs turi yarating");
    await mongoose.disconnect();
    process.exit(1);
  }

  const now = new Date();
  const endDate = new Date(now.getTime() - DAY);
  const startDate = new Date(now.getTime() - 30 * DAY);

  let course = await Course.findOne({ title: DEMO_TITLE });

  if (!course) {
    const donor = await Course.findOne({ "teachers.0": { $exists: true } })
      .select("teachers")
      .lean();
    const teachers = donor ? donor.teachers : [];
    if (!teachers.length) {
      console.log("  ! Hech qaysi kursda o'qituvchi yo'q — avval biriktiring");
      await mongoose.disconnect();
      process.exit(1);
    }

    const doc = {
      title: DEMO_TITLE,
      courseType: courseType._id,
      creditHours: 72,
      price: 0,
      form: 2,
      listenersLimit: 50,
      startDate,
      endDate,
      teachers,
    };
    if (!DRY) course = await Course.create(doc);
    console.log(`  + KURS YARATILDI: "${DEMO_TITLE}" (oflayn, bepul, 72 soat)`);
  } else {
    if (!DRY) {
      course.startDate = startDate;
      course.endDate = endDate;
      course.form = 2;
      course.price = 0;
      course.courseType = courseType._id;
      await course.save();
    }
    console.log(`  ~ KURS YANGILANDI: "${DEMO_TITLE}" — sanalar surildi`);
  }
  console.log(
    `    Chiqish testi oynasi: ${endDate.toISOString().slice(0, 10)} → ` +
      `${new Date(endDate.getTime() + 7 * DAY).toISOString().slice(0, 10)} (HOZIR OCHIQ)`,
  );

  const courseId = course ? course._id : null;

  const have = courseId ? await ExitTest.countDocuments({ course: courseId }) : 0;
  if (have) {
    console.log(`  = savollar bor: ${have} ta`);
  } else {
    if (!DRY && courseId) {
      await ExitTest.insertMany(
        QUESTIONS.map((q, i) => ({
          course: courseId,
          testType: 1,
          question: q.question,
          options: q.options,
          order: i,
        })),
      );
    }
    console.log(`  + savollar qo'shildi: ${QUESTIONS.length} ta`);
  }

  const sub = courseId
    ? await Subscription.findOne({ course: courseId, listener: listener._id })
    : null;
  if (sub) {
    console.log("  = obuna bor");
  } else {
    if (!DRY && courseId) {
      await Subscription.create({ course: courseId, listener: listener._id });
    }
    console.log("  + obuna qo'shildi");
  }

  const petition = courseId
    ? await Petition.findOne({ passport: listener.passport, course: courseId })
    : null;
  if (petition) {
    if (!DRY && petition.status !== 2) {
      petition.status = 2;
      await petition.save();
    }
    console.log(`  = ariza bor (status ${petition.status === 2 ? "tasdiqlangan" : "→ tasdiqlandi"})`);
  } else {
    const donorPet = await Petition.findOne({ passport: listener.passport }).lean();
    if (!donorPet) {
      console.log(
        "  ! Bu tinglovchining birorta arizasi yo'q — majburiy maydonlarni " +
          "(diplom, viloyat, tuman) olib bo'lmaydi. Avval qabul orqali ariza yarating.",
      );
    } else if (!DRY && courseId) {
      await Petition.create({
        fullName: listener.fullName,
        passport: listener.passport,
        bachelorDiploma: donorPet.bachelorDiploma,
        course: courseId,
        province: donorPet.province,
        region: donorPet.region,
        institution: donorPet.institution,
        phone: donorPet.phone,
        status: 2,
      });
      console.log("  + tasdiqlangan ariza qo'shildi");
    } else {
      console.log("  + tasdiqlangan ariza qo'shiladi");
    }
  }

  if (courseId) {
    const scope = { course: courseId, listener: listener._id };
    const oldRes = await ExitResult.countDocuments(scope);
    const oldCert = await Cert.countDocuments(scope);
    const oldAns = await SurveyAnswer.countDocuments(scope);
    if (!DRY) {
      await ExitResult.deleteMany(scope);
      await Cert.deleteMany(scope);
      await SurveyAnswer.deleteMany(scope);
    }
    console.log(
      `  ~ tozalandi: natija ${oldRes} ta, hujjat ${oldCert} ta, so'rovnoma javobi ${oldAns} ta`,
    );
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  TAYYOR — tinglovchi portalida:");
  console.log(`    1) "${listener.fullName}" bilan kiring (passport: ${listener.passport})`);
  console.log(`    2) "Chiqish testi" → "${DEMO_TITLE}" → Boshlash`);
  console.log("    3) Test tugagach SO'ROVNOMA ochiladi (bosqichli)");
  console.log("    4) Rektor tasdiqlagach sertifikat QR bilan yuklab olinadi");
  if (DRY) console.log("\n  (DRY — DB o'zgarmadi)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[QualExitReady Seed] XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
