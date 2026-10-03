// Rolsiz foydalanuvchilarga HEMIS lavozimiga qarab rol berish (faqat rol=null bo'lganlarga; mavjud rolga tegilmaydi).
//   node scripts/assign-roles.js          -> quruq yurish (faqat sonlar)
//   node scripts/assign-roles.js --apply  -> yozadi
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
  const { roleForPosition } = require("../src/modules/4.14-hemis/hemis.roles");

  const roles = new Map((await RoleModel.find({}).select("_id title").lean()).map((r) => [r.title, r._id]));
  const noRole = await UserModel.find({ role: null }).select("_id").lean();
  const ids = new Set(noRole.map((u) => String(u._id)));
  const links = (await FaceLink.find({ user: { $in: [...ids] } }).select("user hemisId").lean());

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

  const stats = { rolsizFoydalanuvchi: noRole.length, bogLangan: 0, rolBeriladi: 0, qoladi: 0 };
  const byRole = {};
  const left = {};
  const updates = [];
  for (const l of links) {
    const rows = byKey.get(String(l.hemisId));
    if (!rows) continue;
    stats.bogLangan++;
    let best = null;
    for (const d of rows) {
      const m = roleForPosition(d.staffPosition?.name);
      if (m && (!best || m.rank > best.rank)) best = m;
    }
    if (best && roles.has(best.role)) {
      stats.rolBeriladi++;
      byRole[best.role] = (byRole[best.role] || 0) + 1;
      updates.push({ updateOne: { filter: { _id: l.user, role: null }, update: { $set: { role: roles.get(best.role) } } } });
    } else {
      stats.qoladi++;
      const pos = rows[0].staffPosition?.name || "(lavozim yo'q)";
      left[pos] = (left[pos] || 0) + 1;
    }
  }
  console.log(APPLY ? "== YOZISH ==" : "== QURUQ YURISH (yozilmaydi) ==");
  console.log(JSON.stringify(stats));
  console.log("Beriladigan rollar:", JSON.stringify(byRole));
  console.log("Rolsiz qoladigan lavozimlar:", JSON.stringify(left));
  if (APPLY && updates.length) {
    const r = await UserModel.bulkWrite(updates, { ordered: false });
    console.log(`Yangilandi: ${r.modifiedCount}`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
