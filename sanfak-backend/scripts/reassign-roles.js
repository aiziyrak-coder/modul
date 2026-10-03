// HEMIS lavozim va bo'limiga qarab rollarni QAYTA baholash (kengaytirilgan qoidalar: rektor, prorektor, dekan,
// bo'lim rollari). Faqat HEMIS bilan bog'langan foydalanuvchilar; super_admin/moderator/malaka_* kabi
// qo'lda berilgan rollarga TEGILMAYDI (faqat quyidagi "avtomatik" rollar almashtiriladi).
//   node scripts/reassign-roles.js          -> quruq yurish (faqat sonlar)
//   node scripts/reassign-roles.js --apply  -> yozadi
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");
// import/assign skriptlari beradigan rollar — faqat shular almashtiriladi
const AUTO_ROLES = new Set([
  "hodim", "oqituvchi", "kafedra_mudiri", "kafedra_uslubiy_masul", "reja_moliya", "prorektor",
]);

(async () => {
  await mongoose.connect(process.env.MONGO_HOST, { autoIndex: false, autoCreate: false });
  const UserModel = require("../src/modules/4.01-auth/user/user.model");
  const RoleModel = require("../src/modules/4.01-auth/role/role.model");
  const FaceLink = require("../src/modules/4.15-faceLogin/faceLink.model");
  const { HemisRecord } = require("../src/modules/4.14-hemis/hemis.model");
  const { roleForRow } = require("../src/modules/4.14-hemis/hemis.roles");

  const roles = new Map((await RoleModel.find({}).select("_id title").lean()).map((r) => [r.title, r._id]));
  const titleById = new Map([...roles].map(([t, id]) => [String(id), t]));

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

  const links = await FaceLink.find({ hemisId: { $ne: null } }).select("user hemisId").lean();
  const users = new Map(
    (await UserModel.find({ _id: { $in: links.map((l) => l.user) } }).select("role").lean()).map((u) => [String(u._id), u]),
  );

  const stats = { tekshirildi: 0, ozgaradi: 0, tegilmadi: 0 };
  const changes = {}; // "eski -> yangi": soni
  const ops = [];
  for (const l of links) {
    const u = users.get(String(l.user));
    const rows = byKey.get(String(l.hemisId));
    if (!u || !rows) continue;
    stats.tekshirildi++;
    const cur = titleById.get(String(u.role)) || null;
    if (cur && !AUTO_ROLES.has(cur)) { stats.tegilmadi++; continue; }
    let best = null;
    for (const r of rows) {
      const m = roleForRow(r);
      if (m && (!best || m.rank > best.rank)) best = m;
    }
    if (!best || !roles.has(best.role) || best.role === cur) continue;
    stats.ozgaradi++;
    const k = `${cur} -> ${best.role}`;
    changes[k] = (changes[k] || 0) + 1;
    ops.push({ updateOne: { filter: { _id: l.user }, update: { $set: { role: roles.get(best.role) } } } });
  }

  console.log(APPLY ? "== YOZISH ==" : "== QURUQ YURISH (yozilmaydi) ==");
  console.log(JSON.stringify(stats));
  Object.entries(changes).sort().forEach(([k, n]) => console.log(`  ${k}: ${n}`));
  if (APPLY && ops.length) {
    const r = await UserModel.bulkWrite(ops, { ordered: false });
    console.log(`Yangilandi: ${r.modifiedCount}`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
