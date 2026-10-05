// HEMIS tuzilmasi -> fakultet / kafedra / bo'limlar, va foydalanuvchilarni ularga bog'lash.
//   node scripts/link-departments.js          -> QURUQ YURISH (faqat sonlar)
//   node scripts/link-departments.js --apply  -> yozadi
// HEMIS "Fakultet" -> faculty; "Kafedra" -> department (parent = fakultet); qolgan turlar
// (Bo'lim, Boshqarma, Markaz, Rektorat, Boshqa) -> division. Takror ishga tushirish xavfsiz (hemisId bo'yicha).
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

(async () => {
  await mongoose.connect(process.env.MONGO_HOST, { autoIndex: false, autoCreate: false });
  const Faculty = require("../src/references/faculty/faculty.model");
  const Department = require("../src/references/department/department.model");
  const Division = require("../src/references/division/division.model");
  const UserModel = require("../src/modules/4.01-auth/user/user.model");
  const RoleModel = require("../src/modules/4.01-auth/role/role.model");
  const FaceLink = require("../src/modules/4.15-faceLogin/faceLink.model");
  const { HemisRecord } = require("../src/modules/4.14-hemis/hemis.model");

  const hemisDeps = (
    await HemisRecord.find({ type: "department", missing: false }).select("data").lean()
  ).map((r) => r.data);
  const kind = (d) => {
    const t = clean(d.structureType?.name).toLowerCase();
    if (t.startsWith("fakultet")) return "faculty";
    if (t.startsWith("kafedra")) return "department";
    return "division";
  };
  const stats = {
    hemisBolim: hemisDeps.length, fakultet: 0, kafedra: 0, boshqaBolim: 0,
    yangi: 0, mavjud: 0, kafedraOtasiYoq: 0,
  };

  // 1) fakultetlar
  const facByHemis = new Map();
  for (const d of hemisDeps.filter((x) => kind(x) === "faculty")) {
    stats.fakultet++;
    let doc = await Faculty.findOne({ hemisId: d.id });
    if (!doc) {
      stats.yangi++;
      if (APPLY) doc = await Faculty.create({ title: clean(d.name), hemisId: d.id, active: d.active !== false });
      else doc = { _id: `dry-f-${d.id}` };
    } else stats.mavjud++;
    facByHemis.set(d.id, doc._id);
  }
  // 2) kafedralar
  const depByHemis = new Map();
  for (const d of hemisDeps.filter((x) => kind(x) === "department")) {
    stats.kafedra++;
    const faculty = facByHemis.get(d.parent) || null;
    if (!faculty) stats.kafedraOtasiYoq++;
    let doc = await Department.findOne({ hemisId: d.id });
    if (!doc) {
      stats.yangi++;
      if (APPLY) {
        doc = await Department.create({ title: clean(d.name), faculty, hemisId: d.id, active: d.active !== false });
      } else doc = { _id: `dry-d-${d.id}` };
    } else stats.mavjud++;
    depByHemis.set(d.id, { _id: doc._id, faculty });
  }
  // 3) qolgan tuzilmalar
  const divByHemis = new Map();
  for (const d of hemisDeps.filter((x) => kind(x) === "division")) {
    stats.boshqaBolim++;
    let doc = await Division.findOne({ hemisId: d.id });
    if (!doc) {
      stats.yangi++;
      if (APPLY) doc = await Division.create({ title: clean(d.name), hemisId: d.id, active: d.active !== false });
      else doc = { _id: `dry-v-${d.id}` };
    } else stats.mavjud++;
    divByHemis.set(d.id, doc._id);
  }

  // 4) foydalanuvchilarni bog'lash
  const emp = await HemisRecord.find({ type: "employee", missing: false }).select("data").lean();
  const byKey = new Map();
  for (const r of emp) {
    for (const k of [r.data.id, r.data.meta_id, r.data.employee_id_number]) {
      if (k == null) continue;
      const key = String(k);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(r.data);
    }
  }
  const links = await FaceLink.find({}).select("user hemisId").lean();
  // qo'lda o'zgartirilgan bo'limlarni bosib ketmaslik: faqat bo'limi/fakulteti/bo'linmasi BO'SH foydalanuvchilar
  const existingOrg = new Map(
    (await UserModel.find({ _id: { $in: links.map((l) => l.user) } }).select("department faculty division").lean()).map((u) => [String(u._id), u]),
  );
  const uStats = { bogLanadi: 0, kafedraga: 0, fakultetga: 0, bolimga: 0, topilmadi: 0 };
  const ops = [];
  for (const l of links) {
    const cur = existingOrg.get(String(l.user));
    if (cur && (cur.department || cur.faculty || cur.division)) { uStats.allaqachonBor = (uStats.allaqachonBor || 0) + 1; continue; }
    const rows = byKey.get(String(l.hemisId));
    if (!rows) { uStats.topilmadi++; continue; }
    const main = rows.find((r) => /asosiy/i.test(r.employmentForm?.name || "")) || rows[0];
    const hid = main.department?.id;
    const set = {};
    if (depByHemis.has(hid)) {
      const dep = depByHemis.get(hid);
      set.department = dep._id;
      if (dep.faculty) set.faculty = dep.faculty;
      uStats.kafedraga++;
    } else if (facByHemis.has(hid)) {
      set.faculty = facByHemis.get(hid);
      uStats.fakultetga++;
    } else if (divByHemis.has(hid)) {
      set.division = divByHemis.get(hid);
      uStats.bolimga++;
    } else { uStats.topilmadi++; continue; }
    uStats.bogLanadi++;
    ops.push({ updateOne: { filter: { _id: l.user }, update: { $set: set } } });
  }

  console.log(APPLY ? "== YOZISH ==" : "== QURUQ YURISH (yozilmaydi) ==");
  console.log("Tuzilma:", JSON.stringify(stats));
  console.log("Foydalanuvchilar:", JSON.stringify(uStats));

  if (APPLY) {
    if (ops.length) {
      const r = await UserModel.bulkWrite(ops, { ordered: false });
      console.log(`Foydalanuvchi yangilandi: ${r.modifiedCount}`);
    }
    // 5) kafedra mudiri -> kafedra rahbari (kafedrada aniq bitta bo'lsa)
    const mudirRole = await RoleModel.findOne({ title: "kafedra_mudiri" }).select("_id").lean();
    let heads = 0;
    if (mudirRole) {
      const mudirs = await UserModel.find({ role: mudirRole._id, department: { $ne: null } })
        .select("_id department").lean();
      const per = new Map();
      for (const u of mudirs) {
        const k = String(u.department);
        per.set(k, [...(per.get(k) || []), u._id]);
      }
      for (const [dep, users] of per) {
        if (users.length !== 1) continue;
        const r = await Department.updateOne(
          { _id: dep, $or: [{ head: null }, { head: { $exists: false } }] },
          { $set: { head: users[0] } },
        );
        heads += r.modifiedCount || 0;
      }
    }
    console.log(`Kafedra rahbari belgilandi: ${heads}`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
