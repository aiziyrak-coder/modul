"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const BASE = "../src/modules/4.08-internationalAdmission";

const DIRECTIONS = [
  { titleUz: "Davolash ishi", titleRu: "Лечебное дело", titleEn: "General medicine" },
  { titleUz: "Pediatriya", titleRu: "Педиатрия", titleEn: "Pediatrics" },
  { titleUz: "Stomatologiya", titleRu: "Стоматология", titleEn: "Dentistry" },
  { titleUz: "Farmatsiya", titleRu: "Фармация", titleEn: "Pharmacy" },
  { titleUz: "Tibbiy profilaktika", titleRu: "Медицинская профилактика", titleEn: "Preventive medicine" },
];

const EDU_FORMS = [
  {
    titleUz: "Kunduzgi", titleRu: "Очная", titleEn: "Full-time",
    descriptionUz: "Har kuni auditoriyada", descriptionRu: "Ежедневно в аудитории", descriptionEn: "Daily on campus",
  },
  {
    titleUz: "Sirtqi", titleRu: "Заочная", titleEn: "Extramural",
    descriptionUz: "Sessiya davrida", descriptionRu: "В период сессии", descriptionEn: "During sessions",
  },
];

const EDU_LANGS = [
  { titleUz: "O'zbek", titleRu: "Узбекский", titleEn: "Uzbek" },
  { titleUz: "Rus", titleRu: "Русский", titleEn: "Russian" },
  { titleUz: "Ingliz", titleRu: "Английский", titleEn: "English" },
];

const COUNTRIES = [
  { titleUz: "Qozogʻiston", titleRu: "Казахстан", titleEn: "Kazakhstan", passportSample: "N00000000", phoneSample: "+7 700 123 45 67" },
  { titleUz: "Qirgʻiziston", titleRu: "Кыргызстан", titleEn: "Kyrgyzstan", passportSample: "AN0000000", phoneSample: "+996 700 123 456" },
  { titleUz: "Tojikiston", titleRu: "Таджикистан", titleEn: "Tajikistan", passportSample: "A0000000", phoneSample: "+992 90 123 4567" },
  { titleUz: "Hindiston", titleRu: "Индия", titleEn: "India", passportSample: "A0000000", phoneSample: "+91 90 123 45 67" },
  { titleUz: "Pokiston", titleRu: "Пакистан", titleEn: "Pakistan", passportSample: "AB1234567", phoneSample: "+92 300 1234567" },
  { titleUz: "Afgʻoniston", titleRu: "Афганистан", titleEn: "Afghanistan", passportSample: "P0000000", phoneSample: "+93 70 123 4567" },
];

const OFFER_BLOCKS = [
  {
    titleUz: "Umumiy shartlar",
    titleRu: "Общие условия",
    titleEn: "General terms",
    bodyUz: "Ushbu oferta Fargʻona jamoat salomatligi tibbiyot instituti va xorijiy fuqaro oʻrtasidagi munosabatlarni tartibga soladi.",
    bodyRu: "Настоящая оферта регулирует отношения между институтом и иностранным гражданином.",
    bodyEn: "This offer governs the relationship between the institute and a foreign citizen.",
  },
  {
    titleUz: "Hujjatlar",
    titleRu: "Документы",
    titleEn: "Documents",
    bodyUz: "Abituriyent pasport nusxasi, oʻrta taʼlim hujjati va tibbiy maʼlumotnomani taqdim etadi.",
    bodyRu: "Абитуриент предоставляет копию паспорта, документ о среднем образовании и медицинскую справку.",
    bodyEn: "The applicant provides a passport copy, secondary education certificate and a medical statement.",
  },
  {
    titleUz: "Maʼlumotlarni qayta ishlash",
    titleRu: "Обработка данных",
    titleEn: "Data processing",
    bodyUz: "Ariza yuborish orqali abituriyent shaxsiy maʼlumotlari qayta ishlanishiga rozilik bildiradi.",
    bodyRu: "Отправляя заявку, абитуриент соглашается на обработку персональных данных.",
    bodyEn: "By submitting an application the applicant consents to personal data processing.",
  },
];

const APPLICANTS = [
  ["Aliyev", "Nurlan", "Qozogʻiston", "approved", 0, 1],
  ["Bekova", "Aizhan", "Qozogʻiston", "approved", 0, 2],
  ["Sultanov", "Rustam", "Qozogʻiston", "new", 1, 0],
  ["Toktogulova", "Aigul", "Qirgʻiziston", "approved", 1, 1],
  ["Jumabekov", "Ermek", "Qirgʻiziston", "new", 1, 2],
  ["Osmonov", "Baktybek", "Qirgʻiziston", "rejected", 2, 0],
  ["Rahimov", "Farhod", "Tojikiston", "approved", 2, 1],
  ["Karimova", "Nasiba", "Tojikiston", "new", 2, 2],
  ["Sharma", "Rahul", "Hindiston", "approved", 3, 0],
  ["Patel", "Priya", "Hindiston", "new", 3, 1],
  ["Singh", "Arjun", "Hindiston", "new", 3, 2],
  ["Gupta", "Neha", "Hindiston", "rejected", 4, 0],
  ["Khan", "Bilal", "Pokiston", "approved", 4, 1],
  ["Ahmed", "Fatima", "Pokiston", "new", 4, 2],
  ["Malik", "Usman", "Pokiston", "rejected", 0, 0],
  ["Nazari", "Ahmad", "Afgʻoniston", "new", 1, 1],
  ["Hakimi", "Zahra", "Afgʻoniston", "approved", 2, 2],
  ["Rasouli", "Omid", "Afgʻoniston", "new", 3, 0],
];

const REJECT_REASONS = [
  "Pasport nusxasi oʻqilmaydi — aniq skanerdan qayta yuklang.",
  "Oʻrta taʼlim hujjati notarial tasdiqlanmagan.",
  "Tibbiy maʼlumotnoma muddati oʻtgan (6 oydan eski).",
];

async function ensureMany(Model, docs, label) {
  const ids = [];
  let created = 0;
  for (const doc of docs) {
    let found = await Model.findOne({ titleUz: doc.titleUz });
    if (!found) {
      found = await Model.create(doc);
      created++;
    }
    ids.push(found._id);
  }
  console.log(`  · ${label.padEnd(18)} ${docs.length} ta (${created} yangi)`);
  return ids;
}

async function main() {
  const reset = process.argv.includes("--reset");
  const refsOnly = process.argv.includes("--refs-only");
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("✓ MongoDB:", process.env.MONGO_HOST, reset ? "(--reset)" : "");

  const Direction = require(`${BASE}/admissionDirection/admissionDirection.model`);
  const EduForm = require(`${BASE}/admissionEducationForm/admissionEducationForm.model`);
  const EduLang = require(`${BASE}/admissionEducationLanguage/admissionEducationLanguage.model`);
  const Country = require(`${BASE}/admissionCountry/admissionCountry.model`);
  const Offer = require(`${BASE}/admissionOffer/admissionOffer.model`);
  const Season = require(`${BASE}/admissionSeason/admissionSeason.model`);
  const Applicant = require(`${BASE}/internationalAdmission/internationalAdmission.model`);

  console.log("\n── Taʼlim tuzilmasi");
  const dirIds = await ensureMany(Direction, DIRECTIONS, "Yoʻnalishlar");
  const formIds = await ensureMany(EduForm, EDU_FORMS, "Taʼlim shakli");
  const langIds = await ensureMany(EduLang, EDU_LANGS, "Taʼlim tili");
  await ensureMany(Country, COUNTRIES, "Davlatlar");

  let offer = await Offer.findOne({ active: true }).sort({ createdAt: 1 });
  if (!offer) offer = await Offer.create({ blocks: [] });
  if (!offer.blocks.length) {
    offer.blocks = OFFER_BLOCKS.map((b, i) => ({ order: i + 1, ...b }));
    await offer.save();
    console.log(`  · ${"Ommaviy oferta".padEnd(18)} ${OFFER_BLOCKS.length} blok (yangi)`);
  } else {
    console.log(`  · ${"Ommaviy oferta".padEnd(18)} ${offer.blocks.length} blok (bor)`);
  }

  console.log("\n── Qabul mavsumi");
  const now = new Date();
  const academicYear = `${now.getFullYear()}/${now.getFullYear() + 1}`;
  let season = await Season.findOne({ titleUz: `${now.getFullYear()} yozgi qabul` });
  if (!season) {
    const openDate = new Date(now);
    openDate.setMonth(openDate.getMonth() - 2);
    const closeDate = new Date(now);
    closeDate.setMonth(closeDate.getMonth() + 2);

    await Season.updateMany(
      { active: true, status: { $ne: "yopiq" }, openDate: { $lte: closeDate }, closeDate: { $gte: openDate } },
      { $set: { status: "yopiq", closedAt: now } },
    );

    season = await Season.create({
      titleUz: `${now.getFullYear()} yozgi qabul`,
      titleRu: `Летний приём ${now.getFullYear()}`,
      titleEn: `Summer admission ${now.getFullYear()}`,
      descriptionUz: "Xorijiy fuqarolar uchun bakalavriat qabuli.",
      descriptionRu: "Приём иностранных граждан на бакалавриат.",
      descriptionEn: "Undergraduate admission for foreign citizens.",
      academicYear,
      season: "yoz",
      items: dirIds.slice(0, 3).map((d) => ({
        direction: d,
        educationForms: formIds,
        educationLanguages: langIds,
      })),
      openDate,
      closeDate,
      status: "ochiq",
    });
    console.log(`  · yaratildi: ${season.titleUz} (${academicYear}) — Ochiq`);
  } else {
    console.log(`  · mavjud: ${season.titleUz} — ${season.status}`);
  }

  if (refsOnly) {
    console.log(`
══════════════════════════════════════════════════════
  MAʼLUMOTNOMALAR TAYYOR (--refs-only, ariza yaratilmadi)

  Public API:  GET /api/public/admission/directions?language=ru
══════════════════════════════════════════════════════
`);
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log("\n── Arizalar");
  if (reset) {
    const del = await Applicant.deleteMany({ applicationNumber: { $regex: "^APP-" } });
    console.log(`  · --reset: ${del.deletedCount} ta eski demo ariza oʻchirildi`);
  }

  let createdCount = 0;
  let rejectIdx = 0;
  for (let i = 0; i < APPLICANTS.length; i++) {
    const [lastName, firstName, country, status, dirIdx, langIdx] = APPLICANTS[i];
    const fullName = `${lastName} ${firstName}`;
    if (await Applicant.findOne({ fullName, country })) continue;

    const createdAt = new Date(now);
    createdAt.setMonth(createdAt.getMonth() - (i % 5));
    createdAt.setDate(1 + ((i * 3) % 27));

    const doc = await Applicant.create({
      applicationNumber: `APP-${createdAt.getFullYear()}-${String(i + 1).padStart(5, "0")}`,
      fullName,
      birthDate: new Date(2004 + (i % 4), i % 12, 1 + (i % 27)),
      country,
      phone: `+998 90 ${100 + i} ${10 + i} ${20 + i}`,
      parentPhone: `+998 91 ${200 + i} ${30 + i} ${40 + i}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      passportNumber: `AB${1000000 + i * 137}`,
      passportExpiry: new Date(now.getFullYear() + 3, i % 12, 15),
      direction: dirIds[dirIdx],
      educationForm: formIds[i % formIds.length],
      educationLanguage: langIds[langIdx],
      season: season._id,
      academicYear,
      offerAccepted: true,
      documents: [
        { title: "Pasport nusxasi", fileUrl: "/files/demo/passport.pdf", verified: status !== "new" },
        { title: "Oʻrta taʼlim hujjati", fileUrl: "/files/demo/diploma.pdf", verified: status !== "new" },
      ],
      status,
      rejectionReason:
        status === "rejected" ? REJECT_REASONS[rejectIdx++ % REJECT_REASONS.length] : "",
      reviewedAt: status === "new" ? undefined : createdAt,
    });

    await Applicant.collection.updateOne({ _id: doc._id }, { $set: { createdAt } });
    createdCount++;
  }

  const total = await Applicant.countDocuments({ active: true });
  console.log(`  · ${createdCount} ta yangi ariza (bazada jami: ${total})`);

  const byStatus = await Applicant.aggregate([
    { $match: { active: true } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  console.log(`  · holatlar: ${byStatus.map((s) => `${s._id}=${s.count}`).join(", ")}`);

  console.log(`
══════════════════════════════════════════════════════
  DEMO MAʼLUMOT TAYYOR

  UI:    http://localhost:5373/foreign-admission
  Login: 48000000000000   (qabul_bolimi)
══════════════════════════════════════════════════════
`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n[4.8 DEMO SEED ERROR]", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
