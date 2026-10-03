// HEMIS -> ta'lim tillari, yo'nalishlar, guruhlar, talabalar.
//   node scripts/import-students.js          -> QURUQ YURISH (faqat sonlar)
//   node scripts/import-students.js --apply  -> yozadi
// bulkWrite ishlatiladi: guruh hook'lari (o'quv yuklamasini qayta hisoblash) ISHGA TUSHMAYDI.
// Takror ishga tushirish xavfsiz (hemisId bo'yicha); mavjud yozuvlarga faqat HEMIS maydonlari yoziladi.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");
const clean = (s) => String(s || "").replace(/[‘’ʻʼ`´]/g, "'").replace(/\s+/g, " ").trim();
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function flush(Model, ops) {
  let n = 0;
  for (const part of chunk(ops, 1000)) {
    const r = await Model.bulkWrite(part, { ordered: false });
    n += (r.upsertedCount || 0) + (r.modifiedCount || 0);
  }
  return n;
}

(async () => {
  await mongoose.connect(process.env.MONGO_HOST, { autoIndex: false, autoCreate: false });
  const Faculty = require("../src/references/faculty/faculty.model");
  const Department = require("../src/references/department/department.model");
  const Lang = require("../src/references/languageOfInstruction/languageOfInstruction.model");
  const Direction = require("../src/references/direction/direction.model");
  const Group = require("../src/references/group/group.model");
  const Student = require("../src/domain/student/student.model");
  const { HemisRecord } = require("../src/modules/4.14-hemis/hemis.model");

  const load = async (type) => (await HemisRecord.find({ type, missing: false }).select("data").lean()).map((r) => r.data);
  const [hSpecialties, hGroups, hStudents] = await Promise.all([load("specialty"), load("group"), load("student")]);

  // HEMIS bo'lim id -> bizning fakultet id (kafedra bo'lsa uning fakulteti)
  const facByHemis = new Map((await Faculty.find({ hemisId: { $ne: null } }).select("_id hemisId").lean()).map((f) => [f.hemisId, f._id]));
  const depFac = new Map((await Department.find({ hemisId: { $ne: null } }).select("hemisId faculty").lean()).map((d) => [d.hemisId, d.faculty]));
  const facultyOf = (hid) => facByHemis.get(hid) || depFac.get(hid) || null;

  const stats = { tillar: 0, yonalish: 0, guruh: 0, talaba: 0, fakultetsiz: 0, guruhsiz: 0 };

  // 1) ta'lim tillari (guruhlardagi tillardan)
  const langNames = [...new Set(hGroups.map((g) => clean(g.educationLang?.name)).filter(Boolean))];
  const langId = new Map();
  for (const name of langNames) {
    let doc = await Lang.findOne({ title: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).select("_id").lean();
    if (!doc && APPLY) doc = await Lang.create({ title: name });
    if (!doc) stats.tillar++;
    langId.set(name, doc?._id || `dry-lang-${name}`);
  }
  stats.tillar = langNames.length;

  // 2) yo'nalishlar: har yo'nalishning tillari = uning guruhlari tillari
  const specLangs = new Map();
  for (const g of hGroups) {
    const sid = g.specialty?.id;
    const ln = clean(g.educationLang?.name);
    if (sid == null || !ln) continue;
    if (!specLangs.has(sid)) specLangs.set(sid, new Set());
    specLangs.get(sid).add(ln);
  }
  const dirOps = [];
  for (const s of hSpecialties) {
    const langs = [...(specLangs.get(s.id) || [])].map((n) => langId.get(n)).filter(Boolean);
    const faculty = facultyOf(s.department?.id);
    dirOps.push({
      updateOne: {
        filter: { hemisId: s.id },
        update: {
          $set: { title: clean(s.name), directionCode: s.code || null, faculty, active: s.active !== false, hemisId: s.id },
          $setOnInsert: { teachingLanguages: langs.length ? langs : [...langId.values()].slice(0, 1) },
        },
        upsert: true,
      },
    });
  }
  stats.yonalish = dirOps.length;
  if (APPLY) await flush(Direction, dirOps);
  const dirByHemis = new Map((await Direction.find({ hemisId: { $ne: null } }).select("_id hemisId").lean()).map((d) => [d.hemisId, d._id]));
  if (!APPLY) hSpecialties.forEach((x) => dirByHemis.set(x.id, `dry-dir-${x.id}`)); // quruq yurishda yaratilgan deb hisoblaymiz

  // 3) guruhlar (talabalar soni bilan)
  const perGroup = new Map();
  for (const st of hStudents) perGroup.set(st.group?.id, (perGroup.get(st.group?.id) || 0) + 1);
  const grpOps = hGroups.map((g) => ({
    updateOne: {
      filter: { hemisId: g.id },
      update: {
        $set: {
          title: clean(g.name),
          direction: dirByHemis.get(g.specialty?.id) || null,
          studentNumber: perGroup.get(g.id) || 0,
          active: g.active !== false,
          hemisId: g.id,
        },
      },
      upsert: true,
    },
  }));
  stats.guruh = grpOps.length;
  if (APPLY) await flush(Group, grpOps);
  const grpByHemis = new Map((await Group.find({ hemisId: { $ne: null } }).select("_id hemisId").lean()).map((g) => [g.hemisId, g._id]));
  if (!APPLY) hGroups.forEach((x) => grpByHemis.set(x.id, `dry-grp-${x.id}`));

  // 4) talabalar
  const levelToCourse = (code) => Math.min(Math.max(Number(code) - 10, 1), 8);
  const semNo = (name) => Math.min(Math.max(parseInt(name, 10) || 1, 1), 16);
  const stOps = [];
  for (const st of hStudents) {
    const faculty = facultyOf(st.department?.id);
    if (!faculty) stats.fakultetsiz++;
    const group = grpByHemis.get(st.group?.id) || null;
    if (!group) stats.guruhsiz++;
    stOps.push({
      updateOne: {
        filter: { hemisId: st.id },
        update: {
          $set: {
            firstName: clean(st.first_name) || "-",
            lastName: clean(st.second_name) || "-",
            middleName: clean(st.third_name) || null,
            birthDate: st.birth_date ? new Date(st.birth_date * 1000) : null,
            gender: String(st.gender?.code) === "12" ? "female" : "male",
            studentId: st.student_id_number || null,
            email: st.email || null,
            address: { region: clean(st.province?.name) || null, district: clean(st.district?.name) || null, street: null },
            group,
            faculty,
            direction: dirByHemis.get(st.specialty?.id) || null,
            course: levelToCourse(st.level?.code),
            semester: semNo(st.semester?.name),
            enrollmentYear: st.year_of_enter || null,
            studyType: /grant/i.test(st.paymentForm?.name || "") ? "grant" : "contract",
            educationForm: "kunduzgi",
            status: "active",
            active: true,
            hemisId: st.id,
          },
        },
        upsert: true,
      },
    });
  }
  stats.talaba = stOps.length;
  if (APPLY) {
    const n = await flush(Student, stOps);
    console.log(`Talaba yozildi/yangilandi: ${n}`);
  }

  console.log(APPLY ? "== YOZISH ==" : "== QURUQ YURISH (yozilmaydi) ==");
  console.log(JSON.stringify(stats));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
