"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Indicator = require("../src/modules/4.12-qualityAssurance/indicator/indicator.model");

const INDICATORS = [
  {
    order: 1,
    category: "ilmiy_daraja",
    title:
      "Dunyoning nufuzli 1000 taligiga kiruvchi OTMlarning PhD/DSc ilmiy darajasini olgan PO'lar",
    desc: "TT 4.12.1 #1",
    coefficient: 5,
    dataFields: [
      { fieldName: "otmName", fieldType: "text", required: true },
      { fieldName: "phdSeries", fieldType: "text", required: false },
      { fieldName: "phdNumber", fieldType: "text", required: false },
      { fieldName: "dscSeries", fieldType: "text", required: false },
      { fieldName: "dscNumber", fieldType: "text", required: false },
      { fieldName: "specialty", fieldType: "text", required: true },
      { fieldName: "diplomaFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 2,
    category: "malaka_oshirish",
    title:
      "Dunyoning nufuzli 1000 taligiga kiruvchi OTMlarida malaka oshirgan/dars o'tgan",
    desc: "TT 4.12.1 #2",
    coefficient: 3,
    dataFields: [
      {
        fieldName: "participationType",
        fieldType: "select",
        required: true,
      },
      { fieldName: "country", fieldType: "text", required: true },
      { fieldName: "foreignOtm", fieldType: "text", required: true },
      { fieldName: "specialty", fieldType: "text", required: true },
      { fieldName: "activityName", fieldType: "text", required: true },
      { fieldName: "duration", fieldType: "text", required: true },
      { fieldName: "basisType", fieldType: "select", required: true },
      { fieldName: "invitationFile", fieldType: "file", required: true },
      { fieldName: "certificateFile", fieldType: "file", required: true },
      { fieldName: "rectorOrderFile", fieldType: "file", required: false },
      { fieldName: "passportStampFile", fieldType: "file", required: false },
    ],
  },
  {
    order: 3,
    category: "ilmiy_daraja",
    title: "Semestr davomida olingan Ilmiy daraja (PhD/DSc)",
    desc: "TT 4.12.1 #3",
    coefficient: 4,
    dataFields: [
      { fieldName: "specialty", fieldType: "text", required: true },
      { fieldName: "dissertationTopic", fieldType: "text", required: true },
      { fieldName: "rankObtainedDate", fieldType: "date", required: false },
      { fieldName: "diplomaFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 4,
    category: "ilmiy_unvon",
    title: "Semestr davomida ilmiy unvon olgan PO'lar (dotsent/professor)",
    desc: "TT 4.12.1 #4",
    coefficient: 3,
    dataFields: [
      { fieldName: "doctorDiplomaSeries", fieldType: "text", required: false },
      { fieldName: "doctorDiplomaNumber", fieldType: "text", required: false },
      {
        fieldName: "professorDiplomaSeries",
        fieldType: "text",
        required: false,
      },
      {
        fieldName: "professorDiplomaNumber",
        fieldType: "text",
        required: false,
      },
      { fieldName: "specialty", fieldType: "text", required: true },
      { fieldName: "diplomaFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 5,
    category: "iqtibos",
    title:
      "Xalqaro ko'rsatkichlar bo'yicha ilmiy maqolalarga iqtiboslar (Google Scholar / Scopus)",
    desc: "TT 4.12.1 #5",
    coefficient: 2,
    dataFields: [
      { fieldName: "googleScholarUrl", fieldType: "url", required: false },
      { fieldName: "scopusUrl", fieldType: "url", required: false },
      { fieldName: "citationCount", fieldType: "number", required: true },
    ],
  },
  {
    order: 6,
    category: "maqola",
    title: "Xalqaro jurnallardagi ilmiy maqolalar (Scopus)",
    desc: "TT 4.12.1 #6",
    coefficient: 5,
    dataFields: [
      { fieldName: "journalName", fieldType: "text", required: true },
      { fieldName: "articleTitle", fieldType: "text", required: true },
      { fieldName: "publishYear", fieldType: "text", required: true },
      { fieldName: "pages", fieldType: "text", required: false },
      { fieldName: "url", fieldType: "url", required: true },
      { fieldName: "authorsCount", fieldType: "number", required: false },
      { fieldName: "articleFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 7,
    category: "maqola",
    title: "Respublika OAK ro'yxatidagi maqolalar",
    desc: "TT 4.12.1 #7",
    coefficient: 2,
    dataFields: [
      { fieldName: "journalName", fieldType: "text", required: true },
      { fieldName: "publishYear", fieldType: "text", required: true },
      { fieldName: "pages", fieldType: "text", required: false },
      { fieldName: "url", fieldType: "url", required: true },
      { fieldName: "authorsCount", fieldType: "number", required: true },
      { fieldName: "articleFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 8,
    category: "grant",
    title: "Xorijiy ilmiy tadqiqot markazlari grantlari (so'mda)",
    desc: "TT 4.12.1 #8",
    coefficient: 4,
    dataFields: [
      { fieldName: "grantName", fieldType: "text", required: true },
      { fieldName: "currentYearAmount", fieldType: "number", required: true },
      { fieldName: "totalAmount", fieldType: "number", required: true },
      { fieldName: "contractFile", fieldType: "file", required: true },
      { fieldName: "reportFile", fieldType: "file", required: false },
      { fieldName: "receiptFile", fieldType: "file", required: false },
    ],
  },
  {
    order: 9,
    category: "buyurtma",
    title: "Sohalar buyurtmalari (xo'jalik shartnomasi)",
    desc: "TT 4.12.1 #9",
    coefficient: 3,
    dataFields: [
      { fieldName: "orderName", fieldType: "text", required: true },
      { fieldName: "currentYearAmount", fieldType: "number", required: true },
      { fieldName: "totalAmount", fieldType: "number", required: true },
      { fieldName: "rectorOrderFile", fieldType: "file", required: true },
      { fieldName: "contractFile", fieldType: "file", required: true },
      { fieldName: "receiptFile", fieldType: "file", required: false },
    ],
  },
  {
    order: 10,
    category: "grant",
    title: "Davlat grantlari (so'mda)",
    desc: "TT 4.12.1 #10",
    coefficient: 4,
    dataFields: [
      { fieldName: "grantTopic", fieldType: "text", required: true },
      { fieldName: "currentYearAmount", fieldType: "number", required: true },
      { fieldName: "totalAmount", fieldType: "number", required: true },
      { fieldName: "ministerOrderFile", fieldType: "file", required: true },
      { fieldName: "ministerCertFile", fieldType: "file", required: false },
    ],
  },
  {
    order: 11,
    category: "monografiya",
    title: "Semestr davomida nashr etilgan monografiyalar",
    desc: "TT 4.12.1 #11",
    coefficient: 5,
    dataFields: [
      { fieldName: "specialtyCode", fieldType: "text", required: true },
      { fieldName: "monographTitle", fieldType: "text", required: true },
      { fieldName: "councilDecision", fieldType: "text", required: false },
      { fieldName: "publisher", fieldType: "text", required: true },
      { fieldName: "isbn", fieldType: "text", required: true },
      { fieldName: "referralFile", fieldType: "file", required: true },
      { fieldName: "ssvConclusion", fieldType: "file", required: false },
      { fieldName: "ziyonetCert", fieldType: "file", required: false },
      { fieldName: "monographFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 12,
    category: "patent",
    title: "Intellektual mulk uchun olingan himoya hujjatlari (patentlar)",
    desc: "TT 4.12.1 #12",
    coefficient: 4,
    dataFields: [
      { fieldName: "patentName", fieldType: "text", required: true },
      { fieldName: "issuedDate", fieldType: "date", required: true },
      { fieldName: "registrationNumber", fieldType: "text", required: true },
      { fieldName: "certificateFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 13,
    category: "dasturiy_taminot",
    title: "AKT dasturlari va elektron bazalari uchun guvohnomalar (DGU)",
    desc: "TT 4.12.1 #13",
    coefficient: 3,
    dataFields: [
      { fieldName: "otmName", fieldType: "text", required: true },
      { fieldName: "authorsName", fieldType: "text", required: true },
      { fieldName: "certificateName", fieldType: "text", required: true },
      { fieldName: "issuedDate", fieldType: "date", required: true },
      { fieldName: "registrationNumber", fieldType: "text", required: true },
      { fieldName: "certificateFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 14,
    category: "darslik",
    title: "Semestr davomida nashr etilgan darsliklar",
    desc: "TT 4.12.1 #14",
    coefficient: 4,
    dataFields: [
      { fieldName: "specialtyCode", fieldType: "text", required: true },
      { fieldName: "textbookName", fieldType: "text", required: true },
      { fieldName: "councilCertificate", fieldType: "text", required: true },
      { fieldName: "ministerOrderFile", fieldType: "file", required: true },
      { fieldName: "publishLicenseFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 15,
    category: "qollanma",
    title: "Semestr davomida nashr etilgan o'quv qo'llanmalar",
    desc: "TT 4.12.1 #15",
    coefficient: 3,
    dataFields: [
      { fieldName: "specialtyCode", fieldType: "text", required: true },
      { fieldName: "manualName", fieldType: "text", required: true },
      { fieldName: "councilCertificate", fieldType: "text", required: true },
      { fieldName: "ministerOrderFile", fieldType: "file", required: true },
      { fieldName: "publishLicenseFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 16,
    category: "konferensiya",
    title:
      "Xalqaro konferensiya/seminarlar va loyihalarda ishtirok etish",
    desc: "TT 4.12.1 #16",
    coefficient: 2,
    dataFields: [
      {
        fieldName: "cooperationDocName",
        fieldType: "text",
        required: true,
      },
      { fieldName: "signedDate", fieldType: "date", required: true },
      { fieldName: "teacherName", fieldType: "text", required: true },
      { fieldName: "country", fieldType: "text", required: true },
      { fieldName: "foreignOtm", fieldType: "text", required: true },
      { fieldName: "directionName", fieldType: "text", required: false },
      { fieldName: "conferenceName", fieldType: "text", required: true },
      { fieldName: "certificateFile", fieldType: "file", required: true },
      { fieldName: "programFile", fieldType: "file", required: false },
    ],
  },
  {
    order: 17,
    category: "til_sertifikat",
    title: "Xorijiy til bilish sertifikati (B2+)",
    desc: "TT 4.12.1 #17",
    coefficient: 2,
    dataFields: [
      { fieldName: "certificateName", fieldType: "text", required: true },
      { fieldName: "level", fieldType: "text", required: true },
      { fieldName: "issuedDate", fieldType: "date", required: true },
      { fieldName: "expiryDate", fieldType: "date", required: true },
      { fieldName: "certificateFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 18,
    category: "olimpiada",
    title:
      "Xalqaro olimpiadalar va nufuzli tanlovlarda sovrinli o'rinlarni qo'lga kiritgan talabalarga rahbarlik",
    desc: "TT 4.12.1 #18",
    coefficient: 4,
    dataFields: [
      { fieldName: "studentName", fieldType: "text", required: true },
      { fieldName: "competitionName", fieldType: "text", required: true },
      { fieldName: "venue", fieldType: "text", required: false },
      { fieldName: "date", fieldType: "date", required: true },
      { fieldName: "place", fieldType: "text", required: true },
      { fieldName: "diplomaSeries", fieldType: "text", required: true },
      { fieldName: "diplomaNumber", fieldType: "text", required: true },
      { fieldName: "comment", fieldType: "textarea", required: false },
      { fieldName: "rectorOrderFile", fieldType: "file", required: true },
      { fieldName: "rewardOrderFile", fieldType: "file", required: false },
      { fieldName: "diplomaFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 19,
    category: "olimpiada",
    title:
      "Respublika olimpiadalar va nufuzli tanlovlarda sovrinli o'rinlarga rahbarlik",
    desc: "TT 4.12.1 #19",
    coefficient: 3,
    dataFields: [
      { fieldName: "studentName", fieldType: "text", required: true },
      { fieldName: "competitionName", fieldType: "text", required: true },
      { fieldName: "venue", fieldType: "text", required: false },
      { fieldName: "date", fieldType: "date", required: true },
      { fieldName: "place", fieldType: "text", required: true },
      { fieldName: "diplomaSeries", fieldType: "text", required: true },
      { fieldName: "diplomaNumber", fieldType: "text", required: true },
      { fieldName: "comment", fieldType: "textarea", required: false },
      { fieldName: "rectorOrderFile", fieldType: "file", required: true },
      { fieldName: "rewardOrderFile", fieldType: "file", required: false },
      { fieldName: "diplomaFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 20,
    category: "tezis",
    title: "Tezislar (milliy/xalqaro)",
    desc: "TT 4.10.1.2",
    coefficient: 1,
    dataFields: [
      { fieldName: "authors", fieldType: "text", required: true },
      { fieldName: "conferenceName", fieldType: "text", required: true },
      { fieldName: "thesisTitle", fieldType: "text", required: true },
      { fieldName: "publishYear", fieldType: "text", required: true },
      { fieldName: "pages", fieldType: "text", required: false },
      { fieldName: "url", fieldType: "url", required: false },
      { fieldName: "thesisFile", fieldType: "file", required: true },
    ],
  },
  {
    order: 21,
    category: "uslubiy",
    title: "Uslubiy tavsiyanomalar",
    desc: "TT 4.10.2",
    coefficient: 2,
    dataFields: [
      { fieldName: "topic", fieldType: "text", required: true },
      { fieldName: "manualFile", fieldType: "file", required: true },
      { fieldName: "departmentMinutes", fieldType: "file", required: true },
      { fieldName: "externalReview", fieldType: "file", required: true },
      { fieldName: "internalReview", fieldType: "file", required: true },
      { fieldName: "antiplagiatReport", fieldType: "file", required: true },
      { fieldName: "titleFile", fieldType: "file", required: true },
    ],
  },
];

const upsertIndicator = async (data) => {
  const result = await Indicator.findOneAndUpdate(
    { title: data.title },
    { $set: { ...data, active: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return result;
};

async function seedIndicators() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[Indicators Seed] Connected to MongoDB");

  let created = 0;
  let updated = 0;

  for (const ind of INDICATORS) {
    const exists = await Indicator.findOne({ title: ind.title });
    await upsertIndicator(ind);
    if (exists) updated++;
    else created++;
  }

  console.log(`[Indicators Seed] Created: ${created}, Updated: ${updated}`);
  console.log(`[Indicators Seed] Total in DB: ${await Indicator.countDocuments()}`);

  await mongoose.disconnect();
  process.exit(0);
}

seedIndicators().catch((err) => {
  console.error("[Indicators Seed] ERROR:", err);
  process.exit(1);
});
