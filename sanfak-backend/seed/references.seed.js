"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const LanguageOfInstruction = require("../src/references/languageOfInstruction/languageOfInstruction.model");
const EducationForm          = require("../src/references/educationForm/educationForm.model");
const ReadingForm            = require("../src/references/readingForm/readingForm.model");
const AcademicLevel          = require("../src/references/academicLevel/academicLevel.model");
const Specialization         = require("../src/references/specialization/specialization.model");
const AcademicYear           = require("../src/references/academicYear/academicYear.model");
const Course                 = require("../src/references/course/course.model");
const Faculty                = require("../src/references/faculty/faculty.model");
const Department             = require("../src/references/department/department.model");
const Direction              = require("../src/references/direction/direction.model");
const Group                  = require("../src/references/group/group.model");
const Science                = require("../src/references/science/science.model");
const Position               = require("../src/references/position/position.model");
const AcademicTitle          = require("../src/references/academicTitle/academicTitle.model");
const Country                = require("../src/references/country/country.model");
const Division               = require("../src/references/division/division.model");
const AuditoriumHour         = require("../src/references/auditoriumHour/auditoriumHour.model");
const EducationActivityType  = require("../src/references/educationActivityType/educationActivityType.model");
const StudyPeriod            = require("../src/references/studyPeriod/studyPeriod.model");

const createIfNotExists = async (Model, filter, data, label) => {
  const existing = await Model.findOne(filter);
  if (existing) {
    console.log(`  ~ skip  [${label}] mavjud: "${existing.title ?? existing._id}"`);
    return existing;
  }
  const doc = await Model.create(data);
  console.log(`  + yaratildi [${label}]: "${doc.title ?? doc._id}"`);
  return doc;
};

const header = (msg) =>
  console.log(`\n── ${msg} ${"─".repeat(Math.max(0, 58 - msg.length))}`);

const seedLanguages = async () => {
  header("1. Ta'lim tillari (languageOfInstruction)");
  const list = [
    { title: "O'zbek" },
    { title: "Rus" },
    { title: "Ingliz" },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      LanguageOfInstruction,
      { title: item.title },
      { title: item.title, active: true },
      "languageOfInstruction",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedEducationForms = async () => {
  header("2. Ta'lim shakllari (educationForm)");
  const list = [
    { title: "Kunduzgi", desc: "Kunduzgi ta'lim shakli" },
    { title: "Sirtqi",   desc: "Sirtqi ta'lim shakli" },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      EducationForm,
      { title: item.title },
      { title: item.title, desc: item.desc, active: true },
      "educationForm",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedReadingForms = async () => {
  header("3. O'qish shakllari (readingForm)");
  const list = [
    { title: "Kredit-modul", desc: "Kredit-modul tizimi bo'yicha" },
    { title: "An'anaviy",    desc: "An'anaviy o'qish shakli" },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      ReadingForm,
      { title: item.title },
      { title: item.title, desc: item.desc, active: true },
      "readingForm",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedAcademicLevels = async () => {
  header("4. Akademik darajalar (academicLevel)");
  const list = [
    { title: "Bakalavr",      desc: "Bakalavriat darajasi" },
    { title: "Magistr",       desc: "Magistratura darajasi" },
    { title: "Doktorantura",  desc: "Doktorantura (PhD)" },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      AcademicLevel,
      { title: item.title },
      { title: item.title, desc: item.desc, active: true },
      "academicLevel",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedSpecializations = async () => {
  header("5. Ixtisosliklar (specialization)");
  const list = [
    { title: "Davolash ishi",   desc: "Umumiy tibbiyot — davolash ixtisosligi" },
    { title: "Stomatologiya",   desc: "Og'iz bo'shlig'i kasalliklari ixtisosligi" },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      Specialization,
      { title: item.title },
      { title: item.title, desc: item.desc, active: true },
      "specialization",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedAcademicYears = async () => {
  header("6. O'quv yillari (academicYear) — format: YYYY/YYYY");
  const list = [
    { title: "2024/2025", active: false },
    { title: "2025/2026", active: true  },
    { title: "2026/2027", active: false },
    { title: "2027/2028", active: false },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      AcademicYear,
      { title: item.title },
      { title: item.title, active: item.active },
      "academicYear",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedCourses = async () => {
  header("7. Kurslar (course)");
  const list = [
    { title: "1-kurs", desc: "Birinchi o'quv yili" },
    { title: "2-kurs", desc: "Ikkinchi o'quv yili" },
    { title: "3-kurs", desc: "Uchinchi o'quv yili" },
    { title: "4-kurs", desc: "To'rtinchi o'quv yili" },
    { title: "5-kurs", desc: "Beshinchi o'quv yili" },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      Course,
      { title: item.title },
      { title: item.title, desc: item.desc, active: true },
      "course",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedFaculties = async () => {
  header("8. Fakultetlar (faculty)");
  const list = [
    { title: "Davolash fakulteti",            desc: "Umumiy tibbiyot (davolash) fakulteti" },
    { title: "Stomatologiya fakulteti",       desc: "Og'iz bo'shlig'i kasalliklari fakulteti" },
    { title: "Tibbiy profilaktika fakulteti", desc: "Tibbiy profilaktika (gigiyena va ekologiya) fakulteti" },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      Faculty,
      { title: item.title },
      { title: item.title, desc: item.desc, active: true },
      "faculty",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedDepartments = async (faculties) => {
  header("9. Kafedralar (department) — faculty → ObjectId ref");
  const list = [
    {
      title: "Ichki kasalliklar kafedrasi",
      desc:  "Terapevtik fanlar kafedrasi",
      facultyTitle: "Davolash fakulteti",
    },
    {
      title: "Jarrohlik kafedrasi",
      desc:  "Jarrohlik fanlari kafedrasi",
      facultyTitle: "Davolash fakulteti",
    },
    {
      title: "Stomatologiya kafedrasi",
      desc:  "Og'iz bo'shlig'i kasalliklari kafedrasi",
      facultyTitle: "Stomatologiya fakulteti",
    },
    {
      title: "Gigiyena va ekologiya kafedrasi",
      desc:  "Gigiyena va ekologiya fanlari kafedrasi",
      facultyTitle: "Tibbiy profilaktika fakulteti",
    },
    {
      title: "Ovqatlanish gigiyenasi va nutritsiologiya kafedrasi",
      desc:  "Ovqatlanish gigiyenasi va nutritsiologiya fanlari kafedrasi",
      facultyTitle: "Tibbiy profilaktika fakulteti",
    },
  ];
  const result = {};
  for (const item of list) {
    const facultyDoc = faculties[item.facultyTitle];
    const doc = await createIfNotExists(
      Department,
      { title: item.title },
      {
        title:   item.title,
        desc:    item.desc,
        faculty: facultyDoc._id,
        active:  true,
      },
      "department",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedDirections = async (refs) => {
  header("10. Yo'nalishlar (direction) — faculty + level + readingFormat + educationForm + teachingLanguages ref");
  const list = [
    {
      title:          "Davolash ishi",
      desc:           "Umumiy tibbiyot — davolash yo'nalishi",
      directionCode:  "5510100",
      studyPeriod:    6,
      facultyTitle:         "Davolash fakulteti",
      levelTitle:           "Bakalavr",
      readingFormatTitle:   "Kredit-modul",
      educationFormTitle:   "Kunduzgi",
      specializationTitle:  "Davolash ishi",
      langTitles: ["O'zbek", "Rus"],
    },
    {
      title:          "Stomatologiya",
      desc:           "Stomatologiya yo'nalishi",
      directionCode:  "5510900",
      studyPeriod:    5,
      facultyTitle:         "Stomatologiya fakulteti",
      levelTitle:           "Bakalavr",
      readingFormatTitle:   "Kredit-modul",
      educationFormTitle:   "Kunduzgi",
      specializationTitle:  "Stomatologiya",
      langTitles: ["O'zbek"],
    },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      Direction,
      { directionCode: item.directionCode },
      {
        title:            item.title,
        desc:             item.desc,
        directionCode:    item.directionCode,
        studyPeriod:      item.studyPeriod,
        faculty:          refs.faculties[item.facultyTitle]._id,
        level:            refs.levels[item.levelTitle]._id,
        readingFormat:    refs.readingForms[item.readingFormatTitle]._id,
        educationForm:    refs.educationForms[item.educationFormTitle]._id,
        specialization:   refs.specializations[item.specializationTitle]._id,
        teachingLanguages: item.langTitles.map((t) => refs.languages[t]._id),
        international:    false,
        active:           true,
      },
      "direction",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedGroups = async (refs) => {
  header("11. Guruhlar (group) — direction + course + lang ref");
  const list = [
    {
      title:        "Dav-101",
      desc:         "Davolash yo'nalishi 1-kurs, o'zbek guruh",
      directionKey: "Davolash ishi",
      courseKey:    "1-kurs",
      langKey:      "O'zbek",
      studentNumber: 30,
    },
    {
      title:        "Dav-102",
      desc:         "Davolash yo'nalishi 1-kurs, rus guruh",
      directionKey: "Davolash ishi",
      courseKey:    "1-kurs",
      langKey:      "Rus",
      studentNumber: 25,
    },
    {
      title:        "Dav-201",
      desc:         "Davolash yo'nalishi 2-kurs, o'zbek guruh",
      directionKey: "Davolash ishi",
      courseKey:    "2-kurs",
      langKey:      "O'zbek",
      studentNumber: 28,
    },
    {
      title:        "Stom-101",
      desc:         "Stomatologiya yo'nalishi 1-kurs, o'zbek guruh",
      directionKey: "Stomatologiya",
      courseKey:    "1-kurs",
      langKey:      "O'zbek",
      studentNumber: 22,
    },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      Group,
      { title: item.title },
      {
        title:         item.title,
        desc:          item.desc,
        direction:     refs.directions[item.directionKey]._id,
        course:        refs.courses[item.courseKey]._id,
        lang:          refs.languages[item.langKey]._id,
        studentNumber: item.studentNumber,
        active:        true,
      },
      "group",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedSciences = async (departments) => {
  header("12. Fanlar (science) — department ref");
  const list = [
    {
      title:       "Anatomiya",
      desc:        "Inson anatomiyasi fanı",
      scienceCode: "MED-ANAT-01",
      deptKey:     "Ichki kasalliklar kafedrasi",
    },
    {
      title:       "Fiziologiya",
      desc:        "Normal fiziologiya fani",
      scienceCode: "MED-FIZ-01",
      deptKey:     "Ichki kasalliklar kafedrasi",
    },
    {
      title:       "Jarrohlik kasalliklari",
      desc:        "Umumiy jarrohlik kasalliklari fani",
      scienceCode: "MED-JAR-01",
      deptKey:     "Jarrohlik kafedrasi",
    },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      Science,
      { scienceCode: item.scienceCode },
      {
        title:       item.title,
        desc:        item.desc,
        scienceCode: item.scienceCode,
        department:  departments[item.deptKey]._id,
        active:      true,
      },
      "science",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedPositions = async () => {
  header("13. Lavozimlar (position)");
  const list = [
    { title: "Professor",         annualHours: 720, minAuditoriumHours: 300, maxAuditoriumHours: 600 },
    { title: "Dotsent",           annualHours: 720, minAuditoriumHours: 350, maxAuditoriumHours: 700 },
    { title: "Katta o'qituvchi",  annualHours: 720, minAuditoriumHours: 380, maxAuditoriumHours: 760 },
    { title: "Assistent",         annualHours: 720, minAuditoriumHours: 400, maxAuditoriumHours: 800 },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      Position,
      { title: item.title },
      { ...item, active: true },
      "position",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedAcademicTitles = async (positions) => {
  header("14. Akademik unvonlar (academicTitle) — position ref + rateTime (required)");
  const list = [
    {
      title:          "Professor",
      rateTime:       720,
      hourMultiplier: 1.2,
      positionTitle:  "Professor",
    },
    {
      title:          "Dotsent",
      rateTime:       720,
      hourMultiplier: 1.15,
      positionTitle:  "Dotsent",
    },
    {
      title:          "PhD",
      rateTime:       720,
      hourMultiplier: 1.1,
      positionTitle:  "Assistent",
    },
  ];
  const result = {};
  for (const item of list) {
    const positionDoc = positions[item.positionTitle];
    const doc = await createIfNotExists(
      AcademicTitle,
      { title: item.title },
      {
        title:          item.title,
        rateTime:       item.rateTime,
        hourMultiplier: item.hourMultiplier,
        position:       positionDoc ? positionDoc._id : null,
        active:         true,
      },
      "academicTitle",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedCountries = async () => {
  header("16. Davlatlar (country)");
  const list = [
    { title: "O'zbekiston",  passportSeries: "AA", phone: "+998" },
    { title: "Qozog'iston",  passportSeries: "N",  phone: "+7"   },
    { title: "Rossiya",      passportSeries: "RU", phone: "+7"   },
    { title: "Tojikiston",   passportSeries: "A",  phone: "+992" },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      Country,
      { title: item.title },
      {
        title:         item.title,
        passportSeries: item.passportSeries,
        phone:         item.phone,
        active:        true,
      },
      "country",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedDivisions = async (faculties) => {
  header("17. Bo'limlar (division) — faculty ref (ixtiyoriy)");
  const list = [
    {
      title:       "O'quv-uslubiy bo'lim",
      desc:        "O'quv jarayonini metodologik ta'minlash bo'limi",
      facultyKey:  null,
    },
    {
      title:       "Kadrlar bo'limi",
      desc:        "Xodimlarni boshqarish va ish bilan ta'minlash bo'limi",
      facultyKey:  null,
    },
    {
      title:       "Davolash fakulteti dekanati",
      desc:        "Davolash fakulteti o'quv-tashkiliy bo'limi",
      facultyKey:  "Davolash fakulteti",
    },
  ];
  const result = {};
  for (const item of list) {
    const facultyId = item.facultyKey ? faculties[item.facultyKey]._id : null;
    const doc = await createIfNotExists(
      Division,
      { title: item.title },
      {
        title:   item.title,
        desc:    item.desc,
        faculty: facultyId,
        active:  true,
      },
      "division",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedAuditoriumHour = async () => {
  header("18. Auditoriya normalari (auditoriumHour) — categories bilan");
  const data = {
    auditoriumHour: 360,
    categories: [
      { slug: "professor",        title: "Professor",        value: 300 },
      { slug: "docent",           title: "Dotsent",          value: 350 },
      { slug: "senior_teacher",   title: "Katta o'qituvchi", value: 380 },
      { slug: "assistant",        title: "Assistent",        value: 400 },
    ],
    active: true,
  };
  const existing = await AuditoriumHour.findOne({ active: true });
  if (existing) {
    console.log(`  ~ skip  [auditoriumHour] mavjud active yozuv: "${existing._id}"`);
    return existing;
  }
  const doc = await AuditoriumHour.create(data);
  console.log(`  + yaratildi [auditoriumHour]: "${doc._id}" (${doc.categories.length} ta kategoriya)`);
  return doc;
};

const seedEducationActivityTypes = async () => {
  header("19. Ta'lim faoliyat turlari (educationActivityType)");
  const list = [
    { title: "Ma'ruza",              desc: "Nazariy dars (ma'ruza)",           flow: false },
    { title: "Amaliy mashg'ulot",    desc: "Amaliy ko'nikmalar darsi",         flow: false },
    { title: "Seminar",              desc: "Munozara va tahlil darsi",          flow: false },
    { title: "Laboratoriya",         desc: "Laboratoriya tajribalari darsi",    flow: false },
    { title: "Mustaqil ta'lim",      desc: "Talaba mustaqil o'qishi (UIRS)",    flow: false },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      EducationActivityType,
      { title: item.title },
      {
        title:  item.title,
        desc:   item.desc,
        flow:   item.flow,
        active: true,
      },
      "educationActivityType",
    );
    result[item.title] = doc;
  }
  return result;
};

const seedStudyPeriods = async () => {
  header("20. O'qish davrlari (studyPeriod)");
  const list = [
    { title: "1-semestr", desc: "Birinchi o'quv semestri (kuz)" },
    { title: "2-semestr", desc: "Ikkinchi o'quv semestri (bahor)" },
  ];
  const result = {};
  for (const item of list) {
    const doc = await createIfNotExists(
      StudyPeriod,
      { title: item.title },
      {
        title:  item.title,
        desc:   item.desc,
        active: true,
      },
      "studyPeriod",
    );
    result[item.title] = doc;
  }
  return result;
};

const main = async () => {
  const startTime = Date.now();

  await mongoose.connect(process.env.MONGO_HOST);
  console.log("✓ MongoDB ulandi:", process.env.MONGO_HOST ? "[MONGO_HOST o'rnatilgan]" : "[MONGO_HOST YO'Q]");
  console.log("=".repeat(64));
  console.log("  REFERENCES SEED — study-load test uchun namuna data");
  console.log("  Idempotent: mavjud yozuvlar o'zgartirilmaydi (skip)");
  console.log("=".repeat(64));

  const languages       = await seedLanguages();
  const educationForms  = await seedEducationForms();
  const readingForms    = await seedReadingForms();
  const levels          = await seedAcademicLevels();
  const specializations = await seedSpecializations();
  await seedAcademicYears();
  const courses         = await seedCourses();
  const faculties       = await seedFaculties();
  const departments     = await seedDepartments(faculties);

  const directions = await seedDirections({
    faculties,
    levels,
    readingForms,
    educationForms,
    specializations,
    languages,
  });

  await seedGroups({ directions, courses, languages });

  await seedSciences(departments);

  const positions = await seedPositions();
  await seedAcademicTitles(positions);

  await seedCountries();
  await seedDivisions(faculties);
  await seedAuditoriumHour();
  await seedEducationActivityTypes();
  await seedStudyPeriods();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n" + "=".repeat(64));
  console.log("  SEED YAKUNLANDI");
  console.log("=".repeat(64));
  console.log(`  Vaqt:        ${elapsed} sek`);
  console.log(`  Holat:       idempotent — mavjud yozuvlar o'zgartirilmadi`);
  console.log(`  Keyingi qadam:`);
  console.log(`    POST /api/auth  { oneIdPin: "admin" }  → token oling`);
  console.log(`    /api/references/faculties             → fakultetlarni tekshiring`);
  console.log(`    /api/references/directions            → yo'nalishlarni tekshiring`);
  console.log(`    /api/references/groups                → guruhlarni tekshiring`);
  console.log(`    /api/references/countries             → davlatlarni tekshiring`);
  console.log(`    /api/references/divisions             → bo'limlarni tekshiring`);
  console.log(`    /api/references/auditorium-hours      → norma yozuvini tekshiring`);
  console.log(`    /api/references/education-activity-types → faoliyat turlarini tekshiring`);
  console.log(`    /api/references/study-periods         → o'qish davrlarini tekshiring`);
  console.log("=".repeat(64));

  await mongoose.disconnect();
  process.exit(0);
};

main().catch((err) => {
  console.error("\n[SEED ERROR]", err.message);
  if (err.errors) {
    Object.entries(err.errors).forEach(([field, e]) =>
      console.error(`  - ${field}: ${e.message}`),
    );
  }
  mongoose.disconnect().finally(() => process.exit(1));
});
