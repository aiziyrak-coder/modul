// HEMIS -> ma'lumotnomalar: ta'lim shakli, o'quv yili, kurs, akademik daraja; yo'nalish va guruhlarni ularga bog'lash.
//   node scripts/seed-hemis-references.js          -> quruq yurish (faqat sonlar)
//   node scripts/seed-hemis-references.js --apply  -> yozadi
// Takror ishga tushirish xavfsiz (nom bo'yicha). bulkWrite: guruh hook'lari ishga tushmaydi.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");
const clean = (s) => String(s || "").replace(/[‘’ʻʼ`´]/g, "'").replace(/\s+/g, " ").trim();
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const key = (s) => clean(s).toLowerCase();

async function ensure(Model, titles, extra = {}) {
  const have = new Map((await Model.find({}).select("_id title").lean()).map((d) => [key(d.title), d._id]));
  let created = 0;
  for (const t of titles) {
    if (have.has(key(t))) continue;
    created++;
    have.set(key(t), APPLY ? (await Model.create({ title: t, ...extra }))._id : `dry-${t}`);
  }
  return { ids: have, created };
}

(async () => {
  await mongoose.connect(process.env.MONGO_HOST, { autoIndex: false, autoCreate: false });
  const EducationForm = require("../src/references/educationForm/educationForm.model");
  const AcademicYear = require("../src/references/academicYear/academicYear.model");
  const Course = require("../src/references/course/course.model");
  const AcademicLevel = require("../src/references/academicLevel/academicLevel.model");
  const Direction = require("../src/references/direction/direction.model");
  const Group = require("../src/references/group/group.model");
  const { HemisRecord } = require("../src/modules/4.14-hemis/hemis.model");

  const load = async (type) => (await HemisRecord.find({ type, missing: false }).select("data").lean()).map((r) => r.data);
  const [students, specialties] = await Promise.all([load("student"), load("specialty")]);

  // 1) ma'lumotnomalar
  const forms = await ensure(EducationForm, [...new Set(students.map((s) => cap(clean(s.educationForm?.name))).filter(Boolean))]);
  const yearTitles = [...new Set(students.map((s) => clean(s.educationYear?.name).replace("-", "/")).filter((y) => /^\d{4}\/\d{4}$/.test(y)))];
  const years = await ensure(AcademicYear, yearTitles);
  const courseTitles = [...new Set(students.map((s) => clean(s.level?.name)).filter((n) => /^\d+-kurs$/.test(n)))].sort();
  const courses = await ensure(Course, courseTitles);
  const levels = await ensure(AcademicLevel, [...new Set(specialties.map((s) => cap(clean(s.educationType?.name))).filter(Boolean))]);

  const stats = {
    taLimShakli: forms.created, oquvYili: years.created, kurs: courses.created, daraja: levels.created,
    yonalishYangilanadi: 0, guruhYangilanadi: 0,
  };

  // joriy o'quv yili = talabalarning eng ko'p uchraydigan yili
  const yc = {};
  students.forEach((s) => { const y = clean(s.educationYear?.name).replace("-", "/"); yc[y] = (yc[y] || 0) + 1; });
  const currentYear = Object.entries(yc).sort((a, b) => b[1] - a[1])[0]?.[0];
  const currentYearId = years.ids.get(key(currentYear));
  const formId = forms.ids.get(key("Kunduzgi"));

  // 2) yo'nalishlar: daraja + ta'lim shakli
  const dirOps = specialties.map((s) => ({
    updateOne: {
      filter: { hemisId: s.id },
      update: {
        $set: {
          ...(levels.ids.get(key(s.educationType?.name)) ? { level: levels.ids.get(key(s.educationType?.name)) } : {}),
          ...(formId ? { educationForm: formId } : {}),
        },
      },
    },
  }));
  stats.yonalishYangilanadi = dirOps.length;

  // 3) guruhlar: kurs (guruh talabalarining eng ko'p kursi) + joriy o'quv yili
  const perGroup = new Map();
  for (const s of students) {
    const g = s.group?.id;
    const c = clean(s.level?.name);
    if (g == null || !c) continue;
    if (!perGroup.has(g)) perGroup.set(g, {});
    perGroup.get(g)[c] = (perGroup.get(g)[c] || 0) + 1;
  }
  const grpOps = [];
  for (const [hid, counts] of perGroup) {
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const courseId = courses.ids.get(key(top));
    if (!courseId) continue;
    grpOps.push({
      updateOne: {
        filter: { hemisId: hid },
        update: { $set: { course: courseId, ...(currentYearId ? { academicYear: currentYearId } : {}) } },
      },
    });
  }
  stats.guruhYangilanadi = grpOps.length;

  console.log(APPLY ? "== YOZISH ==" : "== QURUQ YURISH (yozilmaydi) ==");
  console.log(JSON.stringify({ ...stats, joriyYil: currentYear }));
  if (APPLY) {
    for (let i = 0; i < dirOps.length; i += 1000) await Direction.bulkWrite(dirOps.slice(i, i + 1000), { ordered: false });
    for (let i = 0; i < grpOps.length; i += 1000) await Group.bulkWrite(grpOps.slice(i, i + 1000), { ordered: false });
    console.log("Yo'nalish va guruhlar yangilandi");
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
