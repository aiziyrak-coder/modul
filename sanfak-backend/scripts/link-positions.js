// HEMIS xodim lavozimlari -> position jadvali, va foydalanuvchilarga lavozim biriktirish.
//   node scripts/link-positions.js          -> QURUQ YURISH (faqat sonlar)
//   node scripts/link-positions.js --apply  -> yozadi
// Yangi lavozimlar model standart me'yorlari bilan yaratiladi (soat me'yorlari TAXMIN QILINMAYDI —
// o'qituvchi lavozimlari me'yori alohida tasdiqlanadi). Mavjud lavozim va foydalanuvchining
// allaqachon belgilangan lavozimiga tegilmaydi. Takror ishga tushirish xavfsiz (hemisCode bo'yicha).
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");
// HEMIS yozuvidagi ‘ ’ ʻ ʼ belgilarini loyiha uslubidagi oddiy ' ga keltiramiz ("Katta o'qituvchi")
const title = (s) => String(s || "").replace(/[‘’ʻʼ`´]/g, "'").replace(/\s+/g, " ").trim();

(async () => {
  await mongoose.connect(process.env.MONGO_HOST, { autoIndex: false, autoCreate: false });
  const Position = require("../src/references/position/position.model");
  const UserModel = require("../src/modules/4.01-auth/user/user.model");
  const FaceLink = require("../src/modules/4.15-faceLogin/faceLink.model");
  const { HemisRecord } = require("../src/modules/4.14-hemis/hemis.model");

  const emp = await HemisRecord.find({ type: "employee", missing: false }).select("data").lean();

  // noyob lavozimlar (kod bo'yicha)
  const wanted = new Map();
  const byKey = new Map();
  for (const r of emp) {
    const sp = r.data.staffPosition;
    if (sp?.name) {
      const code = String(sp.code ?? sp.name);
      if (!wanted.has(code)) wanted.set(code, title(sp.name));
    }
    for (const k of [r.data.id, r.data.meta_id, r.data.employee_id_number]) {
      if (k == null) continue;
      const key = String(k);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(r.data);
    }
  }

  const stats = { hemisLavozim: wanted.size, yangi: 0, mavjudNomBilan: 0, mavjudKodBilan: 0 };
  const posByCode = new Map();
  const existing = await Position.find({}).lean();
  const byHemisCode = new Map(existing.filter((p) => p.hemisCode).map((p) => [p.hemisCode, p]));
  const byTitle = new Map(existing.map((p) => [title(p.title).toLowerCase(), p]));

  for (const [code, name] of wanted) {
    let doc = byHemisCode.get(code);
    if (doc) stats.mavjudKodBilan++;
    else if ((doc = byTitle.get(name.toLowerCase()))) {
      stats.mavjudNomBilan++;
      if (APPLY) await Position.updateOne({ _id: doc._id }, { $set: { hemisCode: code } });
    } else {
      stats.yangi++;
      doc = APPLY ? await Position.create({ title: name, hemisCode: code }) : { _id: `dry-${code}` };
    }
    posByCode.set(code, doc._id);
  }

  // foydalanuvchilar
  const links = await FaceLink.find({}).select("user hemisId").lean();
  const users = new Map(
    (await UserModel.find({ _id: { $in: links.map((l) => l.user) } }).select("position").lean()).map((u) => [String(u._id), u]),
  );
  const uStats = { bogLanadi: 0, allaqachonBor: 0, topilmadi: 0 };
  const ops = [];
  for (const l of links) {
    const u = users.get(String(l.user));
    if (u?.position) { uStats.allaqachonBor++; continue; }
    const rows = byKey.get(String(l.hemisId));
    const main = rows && (rows.find((r) => /asosiy/i.test(r.employmentForm?.name || "")) || rows[0]);
    const sp = main?.staffPosition;
    const posId = sp?.name && posByCode.get(String(sp.code ?? sp.name));
    if (!posId) { uStats.topilmadi++; continue; }
    uStats.bogLanadi++;
    ops.push({ updateOne: { filter: { _id: l.user, position: null }, update: { $set: { position: posId } } } });
  }

  console.log(APPLY ? "== YOZISH ==" : "== QURUQ YURISH (yozilmaydi) ==");
  console.log("Lavozimlar:", JSON.stringify(stats));
  console.log("Foydalanuvchilar:", JSON.stringify(uStats));
  if (APPLY && ops.length) {
    const r = await UserModel.bulkWrite(ops, { ordered: false });
    console.log(`Foydalanuvchi yangilandi: ${r.modifiedCount}`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
