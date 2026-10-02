"use strict";

const SAMPLE_PINS = ["50000000000001", "50000000000002", "50000000000003"];

const SAMPLE_ROW_COUNT = SAMPLE_PINS.length;

const COLUMNS = [
  {
    key: "lastName",
    header: "Familiya",
    required: true,
    width: 20,
    aliases: ["familiya", "familiyasi", "lastname", "surname"],
    note: "Majburiy",
    sample: ["Aliyev", "Karimova", "Tursunov"],
  },
  {
    key: "firstName",
    header: "Ism",
    required: true,
    width: 18,
    aliases: ["ism", "ismi", "firstname", "name"],
    note: "Majburiy",
    sample: ["Sardor", "Nilufar", "Jasur"],
  },
  {
    key: "middleName",
    header: "Otasining ismi",
    width: 22,
    aliases: ["otasiningismi", "sharif", "sharifi", "middlename", "otchestvo"],
    sample: ["Botir o'g'li", "Anvar qizi", ""],
  },
  {
    key: "program",
    header: "Ta'lim yo'nalishi",
    required: true,
    width: 18,
    aliases: ["talimyonalishi", "yonalish", "dastur", "program", "talimturi2"],
    note: "Majburiy · magistratura yoki ordinatura",
    sample: ["magistratura", "ordinatura", "magistratura"],
  },
  {
    key: "jshshir",
    header: "JSHSHIR",
    required: true,
    width: 18,
    aliases: ["jshshir", "jshshr", "jshir", "pinfl", "pin"],
    note: "Majburiy · aniq 14 raqam · katak MATN formatida bo'lsin",
    sample: SAMPLE_PINS,
  },
  {
    key: "passportSeria",
    header: "Pasport seriya",
    width: 15,
    aliases: ["pasportseriya", "pasportseriyasi", "seriya", "passportseria"],
    note: "Masalan: AA",
    sample: ["AA", "AB", ""],
  },
  {
    key: "passportNumber",
    header: "Pasport raqami",
    width: 16,
    aliases: ["pasportraqami", "pasportraqam", "passportnumber"],
    note: "7 raqam",
    sample: ["0000001", "0000002", ""],
  },
  {
    key: "specialty",
    header: "Mutaxassislik",
    width: 32,
    aliases: ["mutaxassislik", "mutaxassisligi", "specialty"],
    note: "Ma'lumotnomadagi nom yoki kod (masalan 5A510101)",
    sampleFrom: "specialty",
  },
  {
    key: "department",
    header: "Kafedra",
    width: 30,
    aliases: ["kafedra", "kafedrasi", "department"],
    note: "Ma'lumotnomadagi nom bilan AYNAN bir xil",
    sampleFrom: "department",
  },
  {
    key: "group",
    header: "Guruh",
    width: 15,
    aliases: ["guruh", "guruhi", "group"],
    note: "Ma'lumotnomadagi nom bilan AYNAN bir xil",
    sampleFrom: "group",
  },
  {
    key: "courseNumber",
    header: "Kurs",
    width: 8,
    aliases: ["kurs", "kursi", "course", "coursenumber"],
    note: "Son: 1, 2, 3",
    sampleFrom: "course",
  },
  {
    key: "academicYear",
    header: "O'quv yili",
    width: 14,
    aliases: ["oquvyili", "oquvyil", "academicyear", "yil"],
    note: "2025/2026",
    sampleFrom: "academicYear",
  },
  {
    key: "fundingType",
    header: "Ta'lim turi",
    width: 14,
    aliases: ["talimturi", "moliyalashtirish", "fundingtype", "tolovturi"],
    note: "byudjet yoki shartnoma",
    sample: ["byudjet", "shartnoma", ""],
  },
  {
    key: "studyPeriod",
    header: "O'qish muddati",
    width: 15,
    aliases: ["oqishmuddati", "muddat", "studyperiod"],
    note: "Yil (son) · bo'sh qoldirilsa mutaxassislikdan olinadi",
    sample: ["2", "3", ""],
  },
  {
    key: "admissionOrder",
    header: "Qabul buyrug'i",
    width: 18,
    aliases: ["qabulbuyrugi", "buyruq", "admissionorder"],
    sample: ["125-son", "126-son", ""],
  },
  {
    key: "admissionDate",
    header: "Qabul sanasi",
    width: 14,
    aliases: ["qabulsanasi", "admissiondate"],
    note: "KK.OO.YYYY yoki YYYY-OO-KK",
    sample: ["01.09.2025", "01.09.2025", ""],
  },
  {
    key: "address",
    header: "Yashash manzili",
    width: 32,
    aliases: ["yashashmanzili", "manzil", "address", "adres"],
    note: "Erkin matn",
    sample: ["Toshkent sh., Yunusobod t., Amir Temur ko'ch. 12", "Samarqand sh., Registon ko'ch. 5", ""],
  },
  {
    key: "workplace",
    header: "Ish joyi",
    width: 28,
    aliases: ["ishjoyi", "ishjoy", "workplace"],
    note: "Erkin matn — ishlaydigan talabalar uchun",
    sample: ["1-son oilaviy poliklinika", "Viloyat ko'p tarmoqli tibbiyot markazi", ""],
  },
  {
    key: "workplaceCoords",
    header: "Ish joyi koordinatasi",
    width: 24,
    aliases: ["ishjoyikoordinatasi", "koordinata", "koordinatalar", "gps", "latlng"],
    note: "41.311081, 69.240562 (Google Maps'dan nusxa) — YOKI kenglik+uzunlik ustunlari",
    sample: ["41.311081, 69.240562", "", ""],
  },
  {
    key: "workplaceLat",
    header: "Ish joyi kengligi",
    width: 16,
    aliases: ["ishjoyikengligi", "kenglik", "lat", "latitude", "shirota"],
    note: "Koordinata ustuni O'RNIGA (-90 ... 90). Excelda vergul bo'lsa SHU yo'l.",
    sample: ["", "39.654321", ""],
  },
  {
    key: "workplaceLng",
    header: "Ish joyi uzunligi",
    width: 16,
    aliases: ["ishjoyiuzunligi", "uzunlik", "lng", "lon", "longitude", "dolgota"],
    note: "Koordinata ustuni O'RNIGA (-180 ... 180)",
    sample: ["", "66.975699", ""],
  },
  {
    key: "email",
    header: "Email",
    width: 26,
    aliases: ["email", "epochta", "elektronpochta", "pochta"],
    sample: ["sardor.aliyev@example.uz", "nilufar.karimova@example.uz", ""],
  },
  {
    key: "phone",
    header: "Telefon",
    width: 18,
    aliases: ["telefon", "telefonraqami", "phone", "tel"],
    sample: ["+998901234567", "+998911234567", ""],
  },
  {
    key: "foreign",
    header: "Xorijiy fuqaro",
    width: 15,
    aliases: ["xorijiyfuqaro", "xorijiy", "chetel", "foreign"],
    note: "ha / yo'q",
    sample: ["yo'q", "ha", ""],
  },
  {
    key: "diplomaSeria",
    header: "Diplom seriya",
    width: 15,
    aliases: ["diplomseriya", "diplomaseria"],
    sample: ["AA", "AB", ""],
  },
  {
    key: "diplomaNumber",
    header: "Diplom raqami",
    width: 16,
    aliases: ["diplomraqami", "diplomanumber"],
    sample: ["0012345", "0012346", ""],
  },
  {
    key: "diplomaDate",
    header: "Diplom sanasi",
    width: 14,
    aliases: ["diplomsanasi", "diplomadate"],
    note: "KK.OO.YYYY yoki YYYY-OO-KK",
    sample: ["15.06.2025", "20.06.2025", ""],
  },
];

const REJECTED = [
  {
    aliases: ["rahbar", "ustoz", "klinikustoz", "ilmiyrahbar", "supervisor", "supervisorname"],
    reason: "Rahbar/ustoz Excel'dan biriktirilmaydi — kafedra mudiri qo'lda biriktiradi",
  },
  {
    aliases: ["user", "userid", "akkaunt", "oneid", "oneidpin"],
    reason: "Akkaunt JSHSHIR bo'yicha serverda topiladi/yaratiladi",
  },
  {
    aliases: ["rol", "role"],
    reason: "Rol ta'lim yo'nalishiga qarab serverda belgilanadi",
  },
  {
    aliases: ["id", "_id", "identifikator"],
    reason: "Identifikator Excel'dan olinmaydi",
  },
  {
    aliases: ["active", "faol", "holat", "status"],
    reason: "Holat Excel'dan olinmaydi",
  },
  {
    aliases: [
      "sababsizsoat",
      "totalunexcusedhours",
      "ogohlantirish",
      "warningissued",
      "chetlatish",
      "expulsionordercreated",
    ],
    reason: "Davomat va chetlatish ko'rsatkichlari tizim tomonidan hisoblanadi",
  },
  {
    aliases: ["diplomfayli", "diplomafileurl", "fayl"],
    reason: "Fayl Excel'dan olinmaydi — yozuv ochilgach yuklanadi",
  },
  {
    aliases: [
      "dars",
      "darsotishjoyi",
      "amaliyotjoyi",
      "darsjadvali",
      "darssoati",
      "haftaliksoat",
      "teachinglocation",
      "practicelocation",
      "weeklyhours",
    ],
    reason: "Bu maydonlar biriktirish oynasida to'ldiriladi",
  },
];

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/['ʻʼ’‘`]/g, "")
    .replace(/[^a-z0-9Ѐ-ӿ]/g, "");
}

const BY_ALIAS = new Map();
for (const col of COLUMNS) {
  BY_ALIAS.set(normalizeHeader(col.header), col.key);
  for (const a of col.aliases) BY_ALIAS.set(normalizeHeader(a), col.key);
}

const REJECTED_BY_ALIAS = new Map();
for (const r of REJECTED) {
  for (const a of r.aliases) REJECTED_BY_ALIAS.set(normalizeHeader(a), r.reason);
}

function matchHeader(value) {
  const key = normalizeHeader(value);
  if (!key) return null;
  if (BY_ALIAS.has(key)) return { key: BY_ALIAS.get(key) };
  if (REJECTED_BY_ALIAS.has(key)) return { rejected: REJECTED_BY_ALIAS.get(key) };
  return null;
}

const REQUIRED_KEYS = COLUMNS.filter((c) => c.required).map((c) => c.key);

const SAMPLE_PIN_SET = new Set(SAMPLE_PINS);

const isSamplePin = (pin) => SAMPLE_PIN_SET.has(String(pin ?? "").trim());

module.exports = {
  COLUMNS,
  REJECTED,
  REQUIRED_KEYS,
  SAMPLE_PINS,
  SAMPLE_ROW_COUNT,
  isSamplePin,
  normalizeHeader,
  matchHeader,
};
