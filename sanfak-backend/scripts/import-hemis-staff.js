// HEMIS'dagi, hisobi hali YO'Q faol xodimlarga JSHSHIRsiz hisob yaratish (yuz bilan kirish uchun).
// JSHSHIR keyin Admin -> Foydalanuvchilar orqali qo'shiladi. JSHSHIRsiz hisob PIN bilan kira olmaydi.
//   node scripts/import-hemis-staff.js          -> QURUQ YURISH (faqat sonlar)
//   node scripts/import-hemis-staff.js --apply  -> yozadi
// Bo'lim/lavozim keyin link-departments.js va link-positions.js bilan bog'lanadi (FaceLink orqali).
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

(async () => {
  await mongoose.connect(process.env.MONGO_HOST, { autoIndex: false, autoCreate: false });
  const UserModel = require("../src/modules/4.01-auth/user/user.model");
  const RoleModel = require("../src/modules/4.01-auth/role/role.model");
  const FaceLink = require("../src/modules/4.15-faceLogin/faceLink.model");
  const { HemisRecord } = require("../src/modules/4.14-hemis/hemis.model");
  const { roleForRow } = require("../src/modules/4.14-hemis/hemis.roles");

  const roles = new Map((await RoleModel.find({}).select("_id title").lean()).map((r) => [r.title, r._id]));
  const emp = await HemisRecord.find({ type: "employee", missing: false }).select("data").lean();

  // shaxs (id) bo'yicha qatorlar
  const persons = new Map();
  for (const r of emp) {
    const pid = String(r.data.id);
    if (!persons.has(pid)) persons.set(pid, []);
    persons.get(pid).push(r.data);
  }

  // hisobi borlar: FaceLink.hemisId har qanday kalit (id/meta_id/employee_id_number) bo'lishi mumkin
  const linked = new Set((await FaceLink.find({ hemisId: { $ne: null } }).select("hemisId").lean()).map((l) => String(l.hemisId)));
  const hasAccount = (rows) =>
    rows.some((d) => [d.id, d.meta_id, d.employee_id_number].some((k) => k != null && linked.has(String(k))));

  const stats = { hemisShaxs: persons.size, hisobiBor: 0, nofaol: 0, yaratiladi: 0 };
  const byRole = {};
  const todo = [];
  for (const [pid, rows] of persons) {
    if (hasAccount(rows)) { stats.hisobiBor++; continue; }
    if (!rows.some((d) => d.active !== false)) { stats.nofaol++; continue; }
    let best = null;
    for (const d of rows.filter((x) => x.active !== false)) {
      const m = roleForRow(d);
      if (m && (!best || m.rank > best.rank)) best = m;
    }
    const role = best && roles.has(best.role) ? best.role : roles.has("hodim") ? "hodim" : null;
    byRole[role] = (byRole[role] || 0) + 1;
    stats.yaratiladi++;
    todo.push({ pid, rows, role });
  }

  console.log(APPLY ? "== YOZISH ==" : "== QURUQ YURISH (yozilmaydi) ==");
  console.log(JSON.stringify(stats));
  console.log("Rol bo'yicha:", JSON.stringify(byRole));

  if (APPLY) {
    await FaceLink.createIndexes();
    let ok = 0, fail = 0;
    for (const t of todo) {
      try {
        const d = t.rows.find((x) => /asosiy/i.test(x.employmentForm?.name || "")) || t.rows[0];
        const user = await UserModel.create({
          firstName: d.first_name || "-",
          lastName: d.second_name || "-",
          middleName: d.third_name || null,
          oneIdPin: null,
          role: t.role ? roles.get(t.role) : null,
          active: true,
        });
        await FaceLink.updateOne(
          { camStaffId: `hemis:${t.pid}` },
          { $set: { user: user._id, hemisId: t.pid, source: "import" } },
          { upsert: true },
        );
        ok++;
      } catch (e) {
        fail++;
        console.error("xato:", e.message.slice(0, 100));
      }
    }
    console.log(`Yaratildi: ${ok}, xato: ${fail}`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
