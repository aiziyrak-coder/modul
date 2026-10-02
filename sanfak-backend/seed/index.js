"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const Faculty = require("../src/models/_references/faculty.model");
const Department = require("../src/models/_references/department.model");
const Science = require("../src/models/_references/science.model");
const Direction = require("../src/models/_references/direction.model");
const Course = require("../src/models/_references/course.model");
const AcademicLevel = require("../src/models/_references/academicLevel.model");
const EducationForm = require("../src/models/_references/educationForm.model");
const ReadingForm = require("../src/models/_references/readingForm.model");
const StudyPeriod = require("../src/models/_references/studyPeriod.model");
const Specialization = require("../src/models/_references/specialization.model");
const AcademicYear = require("../src/models/_references/academicYear.model");
const Position = require("../src/models/_references/position.model");
const Room = require("../src/models/_references/room.model");
const Country = require("../src/models/_references/country.model");
const LanguageOfInstruction = require("../src/models/_references/languageOfInstruction.model");
const Division = require("../src/models/_references/division.model");
const Group = require("../src/models/_references/group.model");
const PublicOffer = require("../src/models/_references/publicOffer.model");

const pharmacyData = require("./data/pharmacy-sciences.data");

const upsert = async (Model, filter, data) => {
  return Model.findOneAndUpdate(filter, data, { upsert: true, new: true });
};

const log = (msg) => console.log(`  ${msg}`);
const header = (msg) => console.log(`\n── ${msg} ${"─".repeat(Math.max(0, 60 - msg.length))}`);

const guardRBAC = async () => {
  const db = mongoose.connection.db;
  const roleCount = await db.collection("roles").countDocuments().catch(() => 0);
  const permCount = await db.collection("permissions").countDocuments().catch(() => 0);
  console.log(`\n🔒 RBAC tekshiruvi:`);
  console.log(`   roles:       ${roleCount} ta (tegilmaydi)`);
  console.log(`   permissions: ${permCount} ta (tegilmaydi)`);
};

const seedLanguages = async () => {
  header("1. Ta'lim tillari");
  const uzb = await upsert(LanguageOfInstruction, { title: "O'zbek tili" }, {
    title: "O'zbek tili",
    active: true,
  });
  const rus = await upsert(LanguageOfInstruction, { title: "Rus tili" }, {
    title: "Rus tili",
    active: true,
  });
  const eng = await upsert(LanguageOfInstruction, { title: "Ingliz tili" }, {
    title: "Ingliz tili",
    active: true,
  });
  log(`✓ 3 ta til (o'zbek, rus, ingliz)`);
  return { uzb, rus, eng };
};

const seedAcademicLevels = async () => {
  header("2. Akademik darajalar");
  const levels = [
    { title: "BAKALAVR", desc: "Bakalavriat darajasi" },
    { title: "MAGISTR", desc: "Magistratura darajasi" },
    { title: "DOKTORANTURA", desc: "Doktorantura (PhD)" },
  ];
  const created = {};
  for (const l of levels) {
    const doc = await upsert(AcademicLevel, { title: l.title }, l);
    created[l.title] = doc;
  }
  log(`✓ ${Object.keys(created).length} ta akademik daraja`);
  return created;
};

const seedEducationForms = async () => {
  header("3. Ta'lim shakllari");
  const forms = [
    { title: "Kunduzgi", desc: "Kunduzgi ta'lim shakli" },
    { title: "Sirtqi", desc: "Sirtqi ta'lim shakli" },
    { title: "Kechki", desc: "Kechki ta'lim shakli" },
  ];
  const created = {};
  for (const f of forms) {
    const doc = await upsert(EducationForm, { title: f.title }, f);
    created[f.title] = doc;
  }
  log(`✓ ${Object.keys(created).length} ta ta'lim shakli`);
  return created;
};

const seedReadingForms = async () => {
  header("4. O'qish shakllari");
  const forms = [
    { title: "Kredit-modul", desc: "Kredit-modul tizimi bo'yicha o'qish" },
    { title: "An'anaviy", desc: "An'anaviy o'qish shakli" },
  ];
  const created = {};
  for (const f of forms) {
    const doc = await upsert(ReadingForm, { title: f.title }, f);
    created[f.title] = doc;
  }
  log(`✓ ${Object.keys(created).length} ta o'qish shakli`);
  return created;
};

const seedStudyPeriods = async () => {
  header("5. O'qish muddatlari");
  const periods = [
    { title: "5 yil (Bakalavr)", desc: "5 yillik bakalavr dasturi" },
    { title: "4 yil (Bakalavr)", desc: "4 yillik bakalavr dasturi" },
    { title: "2 yil (Magistr)", desc: "2 yillik magistr dasturi" },
    { title: "3 yil (Doktorantura)", desc: "3 yillik PhD dasturi" },
  ];
  const created = [];
  for (const p of periods) created.push(await upsert(StudyPeriod, { title: p.title }, p));
  log(`✓ ${created.length} ta o'qish muddati`);
  return created;
};

const seedSpecializations = async () => {
  header("6. Mutaxassisliklar");
  const specs = [
    { title: "Farmatsevt", desc: "Umumiy farmatsevt ixtisosligi" },
    { title: "Farmatsevtika ishi", desc: "Farmatsevtika ishi ixtisosligi" },
    { title: "Farmatsevtik tahlil", desc: "Farmatsevtik tahlil ixtisosligi" },
    { title: "Klinik farmatsiya", desc: "Klinik farmatsiya ixtisosligi" },
  ];
  const created = {};
  for (const s of specs) {
    const doc = await upsert(Specialization, { title: s.title }, s);
    created[s.title] = doc;
  }
  log(`✓ ${Object.keys(created).length} ta mutaxassislik`);
  return created;
};

const seedAcademicYears = async () => {
  header("7. O'quv yillari");
  const years = ["2023-2024", "2024-2025", "2025-2026", "2026-2027"];
  const created = [];
  for (const y of years) created.push(await upsert(AcademicYear, { title: y }, { title: y, active: true }));
  log(`✓ ${created.length} ta o'quv yili`);
  return created;
};

const seedCourses = async () => {
  header("8. Kurslar");
  const list = [
    { title: "1-kurs", desc: "Birinchi o'quv yili" },
    { title: "2-kurs", desc: "Ikkinchi o'quv yili" },
    { title: "3-kurs", desc: "Uchinchi o'quv yili" },
    { title: "4-kurs", desc: "To'rtinchi o'quv yili" },
    { title: "5-kurs", desc: "Beshinchi o'quv yili" },
  ];
  const created = [];
  for (const c of list) created.push(await upsert(Course, { title: c.title }, c));
  log(`✓ ${created.length} ta kurs`);
  return created;
};

const seedPositions = async () => {
  header("9. Lavozimlar");
  const list = [
    { title: "Professor", category: "professor" },
    { title: "Dotsent", category: "dotsent" },
    { title: "Katta o'qituvchi", category: "katta_oqituvchi" },
    { title: "Assistent", category: "assistent" },
    { title: "Kafedra mudiri", category: "kafedra_mudiri" },
    { title: "Dekan", category: "dekan" },
    { title: "Prorektor", category: "prorektor" },
    { title: "Rektor", category: "rektor" },
  ];
  const created = [];
  for (const p of list) {
    created.push(await upsert(Position, { title: p.title }, { ...p, status: true }));
  }
  log(`✓ ${created.length} ta lavozim`);
  return created;
};

const seedRooms = async () => {
  header("10. Xonalar");
  const rooms = [
    { title: "101-xona", building: "Asosiy bino", capacity: 120, type: "lecture" },
    { title: "102-xona", building: "Asosiy bino", capacity: 30, type: "practice" },
    { title: "201-xona", building: "Asosiy bino", capacity: 100, type: "lecture" },
    { title: "202-xona", building: "Asosiy bino", capacity: 25, type: "practice" },
    { title: "301-xona", building: "Laboratoriya binosi", capacity: 20, type: "lab" },
    { title: "302-xona", building: "Laboratoriya binosi", capacity: 20, type: "lab" },
    { title: "K-1", building: "Klinika", capacity: 15, type: "clinical" },
    { title: "K-2", building: "Klinika", capacity: 15, type: "clinical" },
  ];
  const created = [];
  for (const r of rooms) {
    created.push(await upsert(Room, { title: r.title }, { ...r, active: true }));
  }
  log(`✓ ${created.length} ta xona`);
  return created;
};

const seedCountries = async () => {
  header("11. Davlatlar");
  const list = [
    { title: "O'zbekiston", phone: "+998" },
    { title: "Qozog'iston", phone: "+7" },
    { title: "Qirg'iziston", phone: "+996" },
    { title: "Tojikiston", phone: "+992" },
    { title: "Turkmaniston", phone: "+993" },
    { title: "Rossiya", phone: "+7" },
    { title: "Turkiya", phone: "+90" },
    { title: "Hindiston", phone: "+91" },
  ];
  const created = [];
  for (const c of list) created.push(await upsert(Country, { title: c.title }, c));
  log(`✓ ${created.length} ta davlat`);
  return created;
};

const seedDivisions = async () => {
  header("12. Bo'limlar");
  const list = [
    { title: "O'quv-uslubiy bo'lim", desc: "O'quv jarayonini tashkil etish va nazorat" },
    { title: "Axborot-resurs markazi", desc: "Kutubxona va elektron resurslar" },
    { title: "Kadrlar bo'limi", desc: "Xodimlar va talabalar kadrlar bilan ishlash" },
    { title: "Moliya-iqtisod bo'limi", desc: "Moliya, iqtisod va hisob-kitob" },
    { title: "Xalqaro aloqalar bo'limi", desc: "Xorijiy talabalar va hamkorlik" },
  ];
  const created = [];
  for (const d of list) created.push(await upsert(Division, { title: d.title }, d));
  log(`✓ ${created.length} ta bo'lim`);
  return created;
};

const seedFaculty = async () => {
  header("13. Farmatsiya fakulteti");
  const f = await upsert(
    Faculty,
    { title: pharmacyData.faculty.title },
    { ...pharmacyData.faculty, active: true },
  );
  log(`✓ ${f.title}`);
  return f;
};

const seedDepartments = async (faculty) => {
  header("14. Kafedralar");
  const created = [];
  for (const d of pharmacyData.departments) {
    const dept = await upsert(
      Department,
      { title: d.title },
      {
        title: d.title,
        desc: d.desc,
        faculty: faculty._id,
        active: true,
      },
    );
    created.push(dept);
  }
  log(`✓ ${created.length} ta kafedra (Farmatsiya fakultetiga biriktirildi)`);
  return created;
};

const seedSciences = async (departments) => {
  header("15. Fanlar (PDF dan)");
  const deptMap = new Map(departments.map((d) => [d.title, d._id]));

  let totalSciences = 0;
  for (const d of pharmacyData.departments) {
    const deptId = deptMap.get(d.title);
    for (const s of d.sciences) {
      await upsert(
        Science,
        { scienceCode: s.code },
        {
          title: s.title,
          desc: s.desc,
          scienceCode: s.code,
          department: deptId,
          active: true,
        },
      );
      totalSciences++;
    }
  }
  log(`✓ ${totalSciences} ta fan (har biri o'z kafedrasiga biriktirildi)`);
  return totalSciences;
};

const seedDirections = async (faculty, langs, refs) => {
  header("16. Yo'nalishlar");
  const created = [];

  const specByTitle = {
    "Farmatsiya (farmatsevtika ishi)": refs.specs["Farmatsevtika ishi"],
    "Farmatsiya (farmatsevtik tahlil)": refs.specs["Farmatsevtik tahlil"],
    "Farmatsiya (klinik farmatsiya)": refs.specs["Klinik farmatsiya"],
  };

  for (const d of pharmacyData.directions) {
    const dir = await upsert(
      Direction,
      { directionCode: d.directionCode },
      {
        title: d.title,
        desc: d.desc,
        directionCode: d.directionCode,
        studyPeriod: d.studyPeriod,
        level: refs.levels["BAKALAVR"]._id,
        readingFormat: refs.readingForms["Kredit-modul"]._id,
        educationForm: refs.educationForms["Kunduzgi"]._id,
        specialization: specByTitle[d.title]?._id || null,
        faculty: faculty._id,
        international: false,
        teachingLanguages: [langs.uzb._id, langs.rus._id],
        active: true,
      },
    );
    created.push(dir);
  }
  log(`✓ ${created.length} ta yo'nalish (level/readingFormat/educationForm/specialization reference)`);
  return created;
};

const seedGroups = async (directions, courses, langs) => {
  header("17. Guruhlar");
  const [dir1] = directions;
  const [c1, c2, c3, c4, c5] = courses;
  const list = [
    { title: "Farm-101", course: c1, direction: dir1, lang: langs.uzb._id, studentNumber: 28 },
    { title: "Farm-102", course: c1, direction: dir1, lang: langs.rus._id, studentNumber: 24 },
    { title: "Farm-201", course: c2, direction: dir1, lang: langs.uzb._id, studentNumber: 27 },
    { title: "Farm-301", course: c3, direction: dir1, lang: langs.uzb._id, studentNumber: 26 },
    { title: "Farm-401", course: c4, direction: dir1, lang: langs.uzb._id, studentNumber: 25 },
    { title: "Farm-501", course: c5, direction: dir1, lang: langs.uzb._id, studentNumber: 24 },
  ];
  const created = [];
  for (const g of list) {
    created.push(
      await upsert(
        Group,
        { title: g.title },
        {
          title: g.title,
          desc: `Farmatsiya ${g.course.title}`,
          direction: g.direction._id,
          course: g.course._id,
          lang: g.lang,
          studentNumber: g.studentNumber,
          active: true,
        },
      ),
    );
  }
  log(`✓ ${created.length} ta guruh`);
  return created;
};

const seedPublicOffer = async () => {
  header("18. Ommaviy oferta");
  const existing = await PublicOffer.findOne({ active: true });
  if (existing) {
    log(`⚠ Oferta mavjud — o'tkazildi (mavjud: ${existing._id})`);
    return existing;
  }
  const doc = await PublicOffer.create({
    sections: [
      {
        order: 1,
        title: "Umumiy qoidalar",
        comment:
          "Ushbu oferta Toshkent farmatsevtika instituti va foydalanuvchi o'rtasidagi o'zaro munosabatlarni tartibga soladi.",
      },
      {
        order: 2,
        title: "Tomonlarning huquqlari va majburiyatlari",
        comment:
          "Har ikki tomon O'zbekiston Respublikasi qonunchiligiga asoslangan holda o'z majburiyatlarini bajarishi lozim.",
      },
      {
        order: 3,
        title: "Javobgarlik",
        comment:
          "Ushbu oferta shartlarini buzilishi natijasida kelib chiqqan oqibatlar uchun tomonlar qonun bilan belgilangan tartibda javobgar bo'ladilar.",
      },
    ],
    active: true,
  });
  log(`✓ Namuna oferta yaratildi`);
  return doc;
};

const main = async () => {
  const startTime = Date.now();
  try {
    await mongoose.connect(process.env.MONGO_HOST);
    console.log("✓ MongoDB ulandi\n");
    console.log("=".repeat(68));
    console.log(" SANFAK SEED SKRIPTI — Role va Permission ga tegmaydi ");
    console.log("=".repeat(68));

    await guardRBAC();

    const langs = await seedLanguages();
    const levels = await seedAcademicLevels();
    const educationForms = await seedEducationForms();
    const readingForms = await seedReadingForms();
    await seedStudyPeriods();
    const specs = await seedSpecializations();
    await seedAcademicYears();
    const courses = await seedCourses();
    await seedPositions();
    await seedRooms();
    await seedCountries();
    await seedDivisions();

    const faculty = await seedFaculty();
    const departments = await seedDepartments(faculty);
    const sciencesCount = await seedSciences(departments);

    const refs = { levels, educationForms, readingForms, specs };
    const directions = await seedDirections(faculty, langs, refs);
    await seedGroups(directions, courses, langs);

    await seedPublicOffer();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n" + "=".repeat(68));
    console.log(" SEED YAKUNLANDI ");
    console.log("=".repeat(68));
    console.log(`   Vaqt:         ${elapsed} sek`);
    console.log(`   Kafedra:      ${departments.length} ta`);
    console.log(`   Fan:          ${sciencesCount} ta`);
    console.log(`   Yo'nalish:    ${directions.length} ta`);
    console.log(`   RBAC:         tegilmagan (xavfsiz)`);

    process.exit(0);
  } catch (err) {
    console.error("\n✗ SEED XATOSI:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

main();
