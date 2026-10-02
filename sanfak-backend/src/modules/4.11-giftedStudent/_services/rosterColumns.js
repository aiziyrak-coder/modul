"use strict";

const SAMPLE_PINS = ["50000000000001", "50000000000002", "50000000000003"];

const SAMPLE_ROW_COUNT = SAMPLE_PINS.length;

const COLUMNS = [
  {
    key: "lastName",
    header: "Familiya",
    required: true,
    width: 20,
    aliases: ["familiya", "familiyasi", "lastname", "surname", "familiya"],
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
    aliases: ["otasiningismi", "otasininigismi", "sharif", "sharifi", "middlename", "otchestvo"],
    sample: ["Botir o'g'li", "Anvar qizi", ""],
  },
  {
    key: "jshshir",
    header: "JSHSHIR",
    required: true,
    width: 18,
    aliases: ["jshshir", "jshshr", "jshir", "pinfl", "pin", "jshshirpinfl"],
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
    aliases: ["pasportraqami", "pasportraqam", "raqami", "passportnumber"],
    note: "7 raqam",
    sample: ["0000001", "0000002", ""],
  },
  {
    key: "faculty",
    header: "Fakultet",
    width: 30,
    aliases: ["fakultet", "fakulteti", "faculty"],
    note: "Ma'lumotnomadagi nom bilan AYNAN bir xil",
    sampleFrom: "faculty",
  },
  {
    key: "direction",
    header: "Yo'nalish",
    width: 30,
    aliases: ["yonalish", "yonalishi", "direction", "mutaxassislik"],
    note: "Ma'lumotnomadagi nom bilan AYNAN bir xil",
    sampleFrom: "direction",
  },
  {
    key: "course",
    header: "Kurs",
    width: 8,
    aliases: ["kurs", "kursi", "course"],
    note: "Son: 1, 2, 3 …",
    sampleFrom: "course",
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
    key: "academicYear",
    header: "O'quv yili",
    width: 14,
    aliases: ["oquvyili", "oquvyil", "academicyear", "yil"],
    note: "2025/2026",
    sampleFrom: "academicYear",
  },
  {
    key: "workplace",
    header: "Ish joyi",
    width: 30,
    aliases: ["ishjoyi", "ishjoy", "workplace", "ishlaydiganjoyi"],
    note: "Erkin matn — ishlaydigan talabalar uchun",
    sample: ["", "Respublika ixtisoslashtirilgan markazi", ""],
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
];

const REJECTED = [
  {
    aliases: ["ball", "jamiball", "totalscore", "reyting", "score"],
    reason:
      "Ball Excel'dan olinmaydi — reyting faqat TASDIQLANGAN yutuqlardan hisoblanadi",
  },
  {
    aliases: ["rank", "orin", "reytingorni"],
    reason: "O'rin avtomatik hisoblanadi",
  },
  {
    aliases: ["maslahatchi", "advisor", "advisorid", "advisorname", "rahbar"],
    reason: "Maslahatchi Excel'dan biriktirilmaydi — u qo'lda tanlanadi",
  },
  {
    aliases: ["user", "userid", "akkaunt", "oneid", "oneidpin"],
    reason: "Akkaunt JSHSHIR bo'yicha serverda topiladi/yaratiladi",
  },
  {
    aliases: ["rol", "role"],
    reason: "Rol serverda belgilanadi (talaba)",
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
    aliases: ["facultyid", "directionid", "groupid", "courseid", "academicyearid"],
    reason: "Ma'lumotnoma id'lari serverda nom bo'yicha aniqlanadi",
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
