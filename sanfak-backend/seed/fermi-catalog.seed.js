const mongoose = require("mongoose");

const Faculty = require("../src/references/faculty/faculty.model");
const Department = require("../src/references/department/department.model");
const Direction = require("../src/references/direction/direction.model");
const Science = require("../src/references/science/science.model");
const Group = require("../src/references/group/group.model");
const Course = require("../src/references/course/course.model");
const AcademicLevel = require("../src/references/academicLevel/academicLevel.model");
const EducationForm = require("../src/references/educationForm/educationForm.model");
const ReadingForm = require("../src/references/readingForm/readingForm.model");
const Specialization = require("../src/references/specialization/specialization.model");
const AcademicYear = require("../src/references/academicYear/academicYear.model");
const LanguageOfInstruction = require("../src/references/languageOfInstruction/languageOfInstruction.model");

const WRITE = process.argv.includes("--write");
const DRY = !WRITE || process.argv.includes("--dry-run");

const stats = { created: 0, skipped: 0, mismatched: 0 };

const header = (m) => console.log(`\n── ${m} ${"─".repeat(Math.max(0, 62 - m.length))}`);

const createIfNotExists = async (Model, filter, data, label) => {
  const existing = await Model.findOne(filter);
  if (existing) {
    stats.skipped++;
    console.log(`  ~ mavjud   [${label}] "${existing.title ?? existing._id}"`);
    return existing;
  }
  if (DRY) {
    stats.created++;
    console.log(`  + [DRY] yaratilardi [${label}] "${data.title}"`);
    return { _id: null, ...data, __dry: true };
  }
  const doc = await Model.create(data);
  stats.created++;
  console.log(`  + yaratildi [${label}] "${doc.title ?? doc._id}"`);
  return doc;
};

function normalizeForCompare(value) {
  if (value === undefined || value === null) return "";
  let s = String(value).toLowerCase();
  s = s.replace(/[‘’ʻʼ`´']/g, "");
  s = s.replace(/ye/g, "e");
  s = s.replace(/и/g, "i").replace(/й/g, "i");
  s = s.replace(/x/g, "h");
  s = s.replace(/\bkafedrasi\b/g, " ").replace(/\bfakulteti\b/g, " ");
  s = s.replace(/[.,]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function indexByNormalizedTitle(docs) {
  const index = new Map();
  for (const doc of docs || []) {
    const key = normalizeForCompare(doc?.title);
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(doc);
  }
  return index;
}

function indexByField(docs, field) {
  const index = new Map();
  for (const doc of docs || []) {
    const key = doc?.[field];
    if (key === undefined || key === null || key === "") continue;
    if (!index.has(key)) index.set(key, doc);
  }
  return index;
}

function indexInsert(titleIndex, doc) {
  const key = normalizeForCompare(doc?.title);
  if (!key) return;
  if (!titleIndex.has(key)) titleIndex.set(key, []);
  titleIndex.get(key).push(doc);
}

function resolveByNormalizedTitle({ title, titleIndex }) {
  const candidates = titleIndex.get(normalizeForCompare(title)) || [];
  return candidates.length ? { action: "match", existing: candidates[0] } : { action: "create" };
}

function resolveByCodeThenTitle({ code, title, byCode, titleIndex }) {
  const existing = code ? byCode.get(code) : undefined;
  if (existing) return { action: "code-match", existing };
  const candidates = titleIndex.get(normalizeForCompare(title)) || [];
  if (candidates.length) return { action: "mismatch", candidates };
  return { action: "create" };
}

function resolveDirectionMatch({ code, title, byCode, titleIndex }) {
  if (code) {
    const existing = byCode.get(code);
    if (existing) return existing;
  }
  const candidates = titleIndex.get(normalizeForCompare(title)) || [];
  return candidates[0] || null;
}

const persistOrSkip = async (Model, existing, data, label, titleIndex) => {
  if (existing) {
    stats.skipped++;
    console.log(`  ~ mavjud   [${label}] "${existing.title ?? existing._id}"`);
    return existing;
  }
  if (DRY) {
    stats.created++;
    console.log(`  + [DRY] yaratilardi [${label}] "${data.title}"`);
    const fake = { _id: null, ...data, __dry: true };
    if (titleIndex) indexInsert(titleIndex, fake);
    return fake;
  }
  const doc = await Model.create(data);
  stats.created++;
  console.log(`  + yaratildi [${label}] "${doc.title ?? doc._id}"`);
  if (titleIndex) indexInsert(titleIndex, doc);
  return doc;
};

const FACULTIES = [
  { title: "Davolash ishi fakulteti", desc: "Umumiy tibbiyot va klinik yo'nalishlar" },
  { title: "Tibbiy profilaktika fakulteti", desc: "Epidemiologiya, gigiyena va jamoat salomatligi" },
  { title: "Xalqaro fakultet", desc: "Xorijiy talabalar va xalqaro qo'shma dasturlar" },
  { title: "Pediatriya fakulteti", desc: "Bolalar salomatligi va pediatriya" },
];

const F_DAV = "Davolash ishi fakulteti";
const F_PRO = "Tibbiy profilaktika fakulteti";
const F_PED = "Pediatriya fakulteti";

const DEPARTMENTS = [
  { title: "Kommunal va mehnat gigienasi kafedrasi", faculty: F_PRO },
  { title: "Ovqatlanish, bolalar va o'smirlar gigienasi kafedrasi", faculty: F_PRO },
  { title: "Preventiv tibbiyot asoslari, jamoat salomatligi, jismoniy tarbiya va sport kafedrasi", faculty: F_PRO },
  { title: "Epidemiologiya va yuqumli kasalliklar, hamshiralik ishi kafedrasi", faculty: F_PRO },
  { title: "Mikrobiologiya, virusologiya va immunologiya kafedrasi", faculty: F_PRO },

  { title: "Normal anatomiya kafedrasi", faculty: F_DAV },
  { title: "Fiziologiya kafedrasi", faculty: F_DAV },
  { title: "Patologik fiziologiya va patologik anatomiya kafedrasi", faculty: F_DAV },
  { title: "Gistologiya va biologiya kafedrasi", faculty: F_DAV },
  { title: "Tibbiy va biologik kimyo kafedrasi", faculty: F_DAV },
  { title: "Biotibbiyot muhandisligi, biofizika va axborot texnologiyalar kafedrasi", faculty: F_DAV },
  { title: "Xalq tabobati va farmakologiya kafedrasi", faculty: F_DAV },
  { title: "Lotin tili, pedagogika va psixologiya kafedrasi", faculty: F_DAV },
  { title: "O'zbek va xorijiy tillar kafedrasi", faculty: F_DAV },
  { title: "Ijtimoiy fanlar kafedrasi", faculty: F_DAV },

  { title: "Ichki kasalliklar propedevtikasi kafedrasi", faculty: F_DAV },
  { title: "Terapiya yo'nalishidagi fanlar (UASH) kafedrasi", faculty: F_DAV },
  { title: "Gospital terapiya (laboratoriya) kafedrasi", faculty: F_DAV },
  { title: "Endokrinologiya, gematologiya va ftiziatriya kafedrasi", faculty: F_DAV },
  { title: "Nevrologiya va psixiatriya kafedrasi", faculty: F_DAV },
  { title: "Dermatovenerologiya va allergologiya kafedrasi", faculty: F_DAV },

  { title: "Umumiy jarrohlik kafedrasi", faculty: F_DAV },
  { title: "Fakultet va gospital jarrohlik kafedrasi", faculty: F_DAV },
  { title: "Travmatologiya va ortopediya kafedrasi", faculty: F_DAV },
  { title: "Urologiya va onkologiya kafedrasi", faculty: F_DAV },
  { title: "Stomatologiya va otorinolaringologiya kafedrasi", faculty: F_DAV },
  { title: "Akusherlik va ginekologiya kafedrasi", faculty: F_DAV },

  { title: "Pediatriya kafedrasi", faculty: F_PED },
  { title: "Pediatriya kafedrasi-2", faculty: F_PED },

  { title: "Oftalmologiya kafedrasi", faculty: F_DAV, isNew: true },
  { title: "Anesteziologiya va reanimatologiya kafedrasi", faculty: F_DAV, isNew: true },
];

const SCIENCES = [
  { code: "O‘YT1104", title: "O'zbekistonning eng yangi tarixi", dept: "Ijtimoiy fanlar kafedrasi", src: "sayt" },
  { code: "FS1104", title: "Falsafa", dept: "Ijtimoiy fanlar kafedrasi", src: "sayt" },
  { code: "DIN1404", title: "Dinshunoslik", dept: "Ijtimoiy fanlar kafedrasi", src: "sayt" },
  { code: "O'RTTXT11-208", title: "O'zbek (rus) tili. Tibbiyotda xorijiy til", dept: "O'zbek va xorijiy tillar kafedrasi", src: "sayt" },

  { code: "TBUG1106", title: "Tibbiy biologiya. Umumiy genetika", dept: "Gistologiya va biologiya kafedrasi", src: "nom" },
  { code: "TK1106", title: "Tibbiy kimyo", dept: "Tibbiy va biologik kimyo kafedrasi", src: "nom" },
  { code: "TBF1204", title: "Tibbiy va biologik fizika", dept: "Biotibbiyot muhandisligi, biofizika va axborot texnologiyalar kafedrasi", src: "nom" },
  { code: "LT1204", title: "Lotin tili va tibbiy terminologiya", dept: "Lotin tili, pedagogika va psixologiya kafedrasi", src: "nom" },
  { code: "TAT1204", title: "Tibbiyotda axborot texnologiyalari", dept: "Biotibbiyot muhandisligi, biofizika va axborot texnologiyalar kafedrasi", src: "nom" },
  { code: "AN11-312", title: "Odam anatomiyasi 1,2,3", dept: "Normal anatomiya kafedrasi", src: "nom" },
  { code: "GS12-308", title: "Gistologiya, sitologiya, embriologiya 1,2", dept: "Gistologiya va biologiya kafedrasi", src: "sayt" },
  { code: "BK13-408", title: "Biokimyo 1,2", dept: "Tibbiy va biologik kimyo kafedrasi", src: "nom" },
  { code: "FZ13-408", title: "Normal fiziologiya 1,2", dept: "Fiziologiya kafedrasi", src: "sayt" },
  { code: "MB13-408", title: "Mikrobiologiya, virusologiya, immunologiya 1,2", dept: "Mikrobiologiya, virusologiya va immunologiya kafedrasi", src: "sayt" },
  { code: "PS1304", title: "Psixologiya", dept: "Lotin tili, pedagogika va psixologiya kafedrasi", src: "sayt" },
  { code: "KAN1504", title: "Klinik anatomiya (Operativ jarrohlik va topografik anatomiya)", dept: "Normal anatomiya kafedrasi", src: "qaror" },
  { code: "PAN15-606", title: "Patologik anatomiya 1,2", dept: "Patologik fiziologiya va patologik anatomiya kafedrasi", src: "sayt" },
  { code: "PFZ15-606", title: "Patologik fiziologiya 1,2", dept: "Patologik fiziologiya va patologik anatomiya kafedrasi", src: "sayt" },
  { code: "FR15-606", title: "Farmakologiya 1,2", dept: "Xalq tabobati va farmakologiya kafedrasi", src: "sayt" },
  { code: "GXGTE1406", title: "Gigiena, harbiy gigiena. Tibbiy ekologiya", dept: "Kommunal va mehnat gigienasi kafedrasi", src: "sayt" },
  { code: "JSMM1606", title: "Jamoat salomatligi. Marketing, menejment", dept: "Preventiv tibbiyot asoslari, jamoat salomatligi, jismoniy tarbiya va sport kafedrasi", src: "sayt" },

  { code: "TKK1104", title: "Tibbiyot kasbiga kirish", dept: "Ichki kasalliklar propedevtikasi kafedrasi", src: "sayt" },
  { code: "IKP15-608", title: "Ichki kasalliklar propedevtikasi 1,2", dept: "Ichki kasalliklar propedevtikasi kafedrasi", src: "sayt" },
  { code: "IK17-910", title: "Ichki kasalliklar 1,2,3", dept: "Terapiya yo'nalishidagi fanlar (UASH) kafedrasi", src: "qaror" },
  { code: "DV1704", title: "Dermatovenerologiya", dept: "Dermatovenerologiya va allergologiya kafedrasi", src: "sayt" },
  { code: "STVFHAS1704", title: "Sud tibbiyoti. Vrach faoliyatining huquqiy asoslari", dept: "Patologik fiziologiya va patologik anatomiya kafedrasi", src: "qaror" },
  { code: "FT1704", title: "Ftiziatriya", dept: "Endokrinologiya, gematologiya va ftiziatriya kafedrasi", src: "sayt" },
  { code: "TR1706", title: "Tibbiy radiologiya", dept: "Endokrinologiya, gematologiya va ftiziatriya kafedrasi", src: "sayt" },
  { code: "EN1804", title: "Endokrinologiya", dept: "Endokrinologiya, gematologiya va ftiziatriya kafedrasi", src: "sayt" },
  { code: "KF1504", title: "Klinik farmakologiya", dept: "Xalq tabobati va farmakologiya kafedrasi", src: "sayt" },
  { code: "NTG11006", title: "Nevrologiya. Tibbiy genetika", dept: "Nevrologiya va psixiatriya kafedrasi", src: "sayt" },
  { code: "ON1904", title: "Onkologiya", dept: "Urologiya va onkologiya kafedrasi", src: "nom" },
  { code: "PNTPS11006", title: "Psixiatriya, narkologiya. Tibbiy psixologiya", dept: "Nevrologiya va psixiatriya kafedrasi", src: "sayt" },
  { code: "YuKBYuK EPXE18-1010", title: "Yuqumli kasalliklar. Bolalar yuqumli kasalliklari. Epidemiologiya", dept: "Epidemiologiya va yuqumli kasalliklar, hamshiralik ishi kafedrasi", src: "nom" },
  { code: "GXDT11104", title: "Gematologiya, HDT", dept: "Endokrinologiya, gematologiya va ftiziatriya kafedrasi", src: "sayt" },
  { code: "KALIM11104", title: "Klinik allergologiya, immunologiya", dept: "Dermatovenerologiya va allergologiya kafedrasi", src: "sayt" },
  { code: "SO‘Q11104", title: "Simulyatsion o'qitish", dept: "Ichki kasalliklar propedevtikasi kafedrasi", src: "qaror" },

  { code: "AG18-906", title: "Akusherlik va ginekologiya 1,2", dept: "Akusherlik va ginekologiya kafedrasi", src: "nom" },
  { code: "BKP15-606", title: "Bolalar kasalliklari propedevtikasi 1,2", dept: "Pediatriya kafedrasi", src: "sayt" },
  { code: "PD17906", title: "Pediatriya 1,2", dept: "Pediatriya kafedrasi", src: "sayt" },

  { code: "UX15-606", title: "Umumiy xirurgiya 1,2", dept: "Umumiy jarrohlik kafedrasi", src: "nom" },
  { code: "XK18908", title: "Xirurgik kasalliklar 1,2", dept: "Fakultet va gospital jarrohlik kafedrasi", src: "nom" },
  { code: "TROXDJNX18905", title: "Travmatologiya va ortopediya, HDJ. Neyroxirurgiya", dept: "Travmatologiya va ortopediya kafedrasi", src: "nom" },
  { code: "UR1704", title: "Urologiya", dept: "Urologiya va onkologiya kafedrasi", src: "nom" },
  { code: "ANR11004", title: "Anesteziologiya va reanimatologiya", dept: "Anesteziologiya va reanimatologiya kafedrasi", src: "qaror" },
  { code: "OTST11006", title: "Otorinolaringologiya va stomatologiya", dept: "Stomatologiya va otorinolaringologiya kafedrasi", src: "sayt" },
  { code: "OF1904", title: "Oftalmologiya", dept: "Oftalmologiya kafedrasi", src: "qaror" },

  { code: "OShTKK19-1010", title: "Oilaviy shifokorlikda terapiya. Kasb kasalliklari", dept: "Terapiya yo'nalishidagi fanlar (UASH) kafedrasi", src: "qaror" },
  { code: "OshPN19-1007", title: "Oilaviy shifokorlikda pediatriya. Neonatologiya", dept: "Pediatriya kafedrasi", src: "sayt" },
  { code: "OShXBX19-1006", title: "Oilaviy shifokorlikda xirurgiya. Bolalar xirurgiyasi", dept: "Fakultet va gospital jarrohlik kafedrasi", src: "nom" },
  { code: "OshAG19-1006", title: "Oilaviy shifokorlikda akusherlik va ginekologiya 1,2", dept: "Akusherlik va ginekologiya kafedrasi", src: "nom" },
  { code: "RB11004", title: "Reabilitologiya. Sport tibbiyoti", dept: "Preventiv tibbiyot asoslari, jamoat salomatligi, jismoniy tarbiya va sport kafedrasi", src: "sayt" },
  { code: "TTYo11005", title: "Tez tibbiy yordam", dept: "Ichki kasalliklar propedevtikasi kafedrasi", src: "nom" },
];

const seedFaculties = async () => {
  header("1. Fakultetlar (fermi.uz)");
  const titleIndex = indexByNormalizedTitle(await Faculty.find({}).lean());
  const map = {};
  for (const f of FACULTIES) {
    const decision = resolveByNormalizedTitle({ title: f.title, titleIndex });
    map[f.title] = await persistOrSkip(
      Faculty,
      decision.action === "match" ? decision.existing : null,
      { title: f.title, desc: f.desc, active: true },
      "faculty",
      titleIndex,
    );
  }
  return map;
};

const seedDepartments = async (faculties) => {
  header("2. Kafedralar (fermi.uz — 29 + 2 yangi)");
  const titleIndex = indexByNormalizedTitle(await Department.find({}).lean());
  const map = {};
  for (const d of DEPARTMENTS) {
    const fac = faculties[d.faculty];
    const decision = resolveByNormalizedTitle({ title: d.title, titleIndex });
    map[d.title] = await persistOrSkip(
      Department,
      decision.action === "match" ? decision.existing : null,
      {
        title: d.title,
        desc: d.isNew
          ? "O'quv rejada fan mavjud, fermi.uz da kafedra ko'rsatilmagan — foydalanuvchi tasdig'i bilan qo'shildi"
          : "fermi.uz rasmiy ro'yxatidan",
        faculty: fac?._id ?? null,
        active: true,
      },
      d.isNew ? "department·YANGI" : "department",
      titleIndex,
    );
  }
  return map;
};

const DIRECTIONS = [
  { title: "Davolash ishi", code: "60910200", years: 6, faculty: F_DAV, spec: "Oilaviy shifokor" },
  { title: "Tibbiy profilaktika ishi", code: null, years: 5, faculty: F_PRO },
  { title: "Farmatsiya ishi", code: null, years: 5, faculty: F_DAV },
  { title: "Pediatriya ishi", code: null, years: 5, faculty: F_PED },
  { title: "Stomatologiya ishi", code: null, years: 5, faculty: F_DAV },
  { title: "Biotibbiyot muhandisligi", code: null, years: 4, faculty: F_DAV },
  { title: "Xalq tabobati", code: null, years: 4, faculty: F_DAV },
  { title: "Tibbiy biologik ish", code: null, years: 4, faculty: F_DAV },
  { title: "Oliy hamshiralik ishi", code: null, years: 3, faculty: F_DAV },
  { title: "Fundamental tibbiyot", code: null, years: 3, faculty: F_DAV },
];

const seedDirections = async (faculties) => {
  header(`3. Yo'nalishlar — o'quv jarayoni jadvalidan (${DIRECTIONS.length} ta)`);
  const [level, eduForm, readForm] = await Promise.all([
    AcademicLevel.findOne({ title: /bakalavr/i }),
    EducationForm.findOne({ title: /kunduzgi/i }),
    ReadingForm.findOne({ title: /kredit/i }),
  ]);
  const langs = await LanguageOfInstruction.find({ title: { $in: [/o'zbek/i, /rus/i] } });
  const existingDirections = await Direction.find({}).lean();
  const directionByCode = indexByField(existingDirections, "directionCode");
  const directionTitleIndex = indexByNormalizedTitle(existingDirections);
  const map = {};

  for (const d of DIRECTIONS) {
    let specId = null;
    if (d.spec) {
      const sp = await createIfNotExists(
        Specialization,
        { title: d.spec },
        { title: d.spec, active: true },
        "specialization",
      );
      specId = sp?._id ?? null;
    }
    const existingDoc = resolveDirectionMatch({
      code: d.code,
      title: d.title,
      byCode: directionByCode,
      titleIndex: directionTitleIndex,
    });
    map[d.title] = await persistOrSkip(
      Direction,
      existingDoc,
      {
        title: d.title,
        desc: `${d.code ? d.code + " — " : ""}${d.title} (bakalavr, kunduzgi, ${d.years} yil) · manba: 2026-2027 o'quv jarayoni jadvali`,
        directionCode: d.code,
        level: level?._id ?? null,
        educationForm: eduForm?._id ?? null,
        readingFormat: readForm?._id ?? null,
        specialization: specId,
        studyPeriod: d.years,
        faculty: faculties[d.faculty]?._id ?? null,
        teachingLanguages: langs.map((l) => l._id),
        active: true,
      },
      "direction",
      directionTitleIndex,
    );
  }
  return map;
};

const seedCourses = async () => {
  header("4. Kurslar — 6-kurs (Davolash ishi 6 yillik)");
  for (const n of [1, 2, 3, 4, 5, 6]) {
    await createIfNotExists(Course, { title: `${n}-kurs` }, { title: `${n}-kurs`, active: true }, "course");
  }
};

const seedSciences = async (departments) => {
  header(`5. Fanlar — Davolash ishi o'quv rejasi (${SCIENCES.length} ta)`);
  const missing = [];
  const mismatched = [];

  const existingSciences = await Science.find({}).lean();
  const byCode = indexByField(existingSciences, "scienceCode");
  const titleIndex = indexByNormalizedTitle(existingSciences);
  const deptTitleById = new Map(
    (await Department.find({}).select("title").lean()).map((d) => [String(d._id), d.title]),
  );

  for (const s of SCIENCES) {
    const dep = departments[s.dept];
    if (!dep) {
      missing.push(`${s.code} → "${s.dept}"`);
      continue;
    }

    const decision = resolveByCodeThenTitle({ code: s.code, title: s.title, byCode, titleIndex });

    if (decision.action === "code-match") {
      stats.skipped++;
      console.log(`  ~ mavjud   [science] "${decision.existing.title}" (kod: ${s.code})`);
      continue;
    }

    if (decision.action === "mismatch") {
      for (const cand of decision.candidates) {
        stats.mismatched++;
        const candDeptTitle = deptTitleById.get(String(cand.department)) ?? "noma'lum";
        mismatched.push({
          existingTitle: cand.title,
          existingCode: cand.scienceCode ?? "yo'q",
          existingDept: candDeptTitle,
          expectedCode: s.code,
          expectedDept: dep.title,
        });
        console.log(
          `  ⚠ MOSLIK SHUBHALI: mavjud "${cand.title}" (kod ${cand.scienceCode ?? "yo'q"}, kafedra "${candDeptTitle}") ` +
            `≠ kutilgan (kod ${s.code}, kafedra "${dep.title}") — YARATILMADI, qo'lda tekshiring`,
        );
      }
      continue;
    }

    await createIfNotExists(
      Science,
      { scienceCode: s.code },
      {
        title: s.title,
        desc: `Davolash ishi (60910200) o'quv rejasi · biriktiruv manbai: ${s.src}`,
        scienceCode: s.code,
        department: dep._id,
        active: true,
      },
      `science·${s.src}`,
    );
  }
  if (missing.length) {
    console.log(`\n  ⚠️  KAFEDRA TOPILMADI (${missing.length}):`);
    missing.forEach((m) => console.log(`      ${m}`));
  }
  return { missing, mismatched };
};

const seedGroups = async (direction) => {
  header("6. Guruhlar — Davolash ishi 1-kurs (yuklama sinovi uchun)");
  const ay = await AcademicYear.findOne({ title: "2026/2027" });
  const course1 = await Course.findOne({ title: "1-kurs" });
  const uz = await LanguageOfInstruction.findOne({ title: /o'zbek/i });
  const ru = await LanguageOfInstruction.findOne({ title: /rus/i });

  if (!ay || !course1) {
    console.log("  ⚠️  academicYear 2026/2027 yoki 1-kurs topilmadi — guruhlar o'tkazib yuborildi");
    return;
  }
  const list = [
    { title: "DI-101", lang: uz, n: 22 },
    { title: "DI-102", lang: uz, n: 21 },
    { title: "DI-103", lang: ru, n: 18 },
  ];
  for (const g of list) {
    await createIfNotExists(
      Group,
      { title: g.title, academicYear: ay._id },
      {
        title: g.title,
        desc: "Davolash ishi 1-kurs (seed)",
        direction: direction?._id ?? null,
        course: course1._id,
        lang: g.lang?._id ?? null,
        studentNumber: g.n,
        academicYear: ay._id,
        active: true,
      },
      "group",
    );
  }
};

const main = async () => {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST .env da yo'q");
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(`\n╔══ FerMI katalog seed ${DRY ? "[DRY-RUN — yozilmaydi]" : ""}`);
  console.log(`║  baza: ${mongoose.connection.name}`);
  console.log("╚══ hech nima o'chirilmaydi — faqat yetishmayotgani qo'shiladi\n");

  const faculties = await seedFaculties();
  const departments = await seedDepartments(faculties);
  const directions = await seedDirections(faculties);
  await seedCourses();
  const { missing, mismatched } = await seedSciences(departments);
  await seedGroups(directions["Davolash ishi"]);

  console.log(`\n══ YAKUN ${"═".repeat(56)}`);
  console.log(`  ${DRY ? "yaratilardi" : "yaratildi"} : ${stats.created}`);
  console.log(`  mavjud edi: ${stats.skipped}`);
  console.log(`  nomuvofiq : ${stats.mismatched}`);
  if (missing?.length) console.log(`  ⚠️ kafedrasiz fan: ${missing.length}`);
  if (mismatched?.length) {
    console.log(`\n  ⚠️  MOSLIK SHUBHALI (${mismatched.length}) — quyidagilar YARATILMADI, qo'lda tekshiring:`);
    mismatched.forEach((m) => {
      console.log(
        `      "${m.existingTitle}" — mavjud (kod ${m.existingCode}, kafedra "${m.existingDept}") ` +
          `≠ kutilgan (kod ${m.expectedCode}, kafedra "${m.expectedDept}")`,
      );
    });
  }
  if (DRY) console.log("\n  ⚠️  DRY-RUN edi — bazaga hech narsa yozilmadi.");
  await mongoose.disconnect();
};

if (require.main === module) {
  main().catch((e) => {
    console.error("\n❌ SEED XATOSI:", e.message);
    process.exit(1);
  });
}

module.exports = {
  normalizeForCompare,
  indexByNormalizedTitle,
  indexByField,
  resolveByNormalizedTitle,
  resolveByCodeThenTitle,
  resolveDirectionMatch,
};
