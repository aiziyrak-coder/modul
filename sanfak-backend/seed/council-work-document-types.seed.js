"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const WorkDocumentType = require("../src/modules/4.06-scientificCouncil/workDocumentType/workDocumentType.model");

const DOCUMENT_TYPES = [
  { order: 1, key: "coverLetter", labelUz: "Yo'llanma xati", labelRu: "Сопроводительное письмо", format: "pdf", required: true },
  { order: 2, key: "passport", labelUz: "Pasport nusxasi", labelRu: "Копия паспорта", format: "pdf", required: true },
  { order: 3, key: "cv", labelUz: "Ilmiy-pedagogik faoliyat haqida ma'lumot", labelRu: "Сведения о научно-педагогической деятельности", format: "word", required: true },
  { order: 4, key: "biography", labelUz: "Tarjimai hol", labelRu: "Автобиография", format: "word", required: true },
  { order: 5, key: "dissertation", labelUz: "Dissertatsiya", labelRu: "Диссертация", format: "word, pdf", required: true },
  { order: 6, key: "abstract", labelUz: "Avtoreferat", labelRu: "Автореферат", format: "word, pdf", required: true },
  { order: 7, key: "antiplagiat", labelUz: "Antiplagiat tekshiruvi", labelRu: "Проверка антиплагиата", format: "pdf", required: true },
  { order: 8, key: "supervisorReview", labelUz: "Ilmiy rahbar taqrizi", labelRu: "Отзыв научного руководителя", format: "pdf", required: true },
  { order: 9, key: "examCertificates", labelUz: "Imtihon natijalari", labelRu: "Результаты экзаменов", format: "pdf", required: true },
  { order: 10, key: "form34", labelUz: "34-shakl", labelRu: "Форма 34", format: "excel", required: true },
  { order: 11, key: "publishedWorks", labelUz: "Chop etilgan ishlar ro'yxati", labelRu: "Список опубликованных работ", format: "word", required: true },
  { order: 12, key: "implementationConclusions", labelUz: "Joriy etish xulosalari", labelRu: "Акты внедрения", format: "pdf", required: true },
  { order: 13, key: "approbation", labelUz: "Approbatsiya bayonnomasi", labelRu: "Протокол апробации", format: "pdf", required: true },
  { order: 14, key: "ssvConclusion", labelUz: "SSV xulosasi", labelRu: "Заключение НТС", format: "pdf", required: true },
  { order: 15, key: "checkAct", labelUz: "Tekshirish dalolatnomasi", labelRu: "Акт проверки", format: "pdf", required: true },
  { order: 16, key: "contracts", labelUz: "Shartnomalar", labelRu: "Договоры", format: "pdf", required: false },
  { order: 17, key: "coauthorConsent", labelUz: "Hammualliflar roziligi", labelRu: "Согласие соавторов", format: "pdf", required: false },
  { order: 18, key: "patientList", labelUz: "Bemorlar ro'yxati", labelRu: "Список пациентов", format: "excel", required: false },
];

async function seedWorkDocumentTypes() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[Work Document Types Seed] MongoDBga ulandi");

  let created = 0;
  let updated = 0;

  for (const dt of DOCUMENT_TYPES) {
    const exists = await WorkDocumentType.findOne({ key: dt.key });
    await WorkDocumentType.findOneAndUpdate(
      { key: dt.key },
      { $set: { ...dt, active: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (exists) updated++;
    else created++;
  }

  console.log(`[Work Document Types Seed] Qo'shildi: ${created}, Yangilandi: ${updated}`);
  console.log(`[Work Document Types Seed] DBda jami: ${await WorkDocumentType.countDocuments()}`);

  await mongoose.disconnect();
  process.exit(0);
}

seedWorkDocumentTypes().catch((err) => {
  console.error("[Work Document Types Seed] XATO:", err);
  process.exit(1);
});
