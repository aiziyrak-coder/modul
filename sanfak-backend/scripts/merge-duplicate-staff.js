// Bir odamning ikki hisobini birlashtirish: kameradan yaratilgan (JSHSHIRli, HEMIS bilan bog'lanmagan) hisob va
// HEMIS'dan yaratilgan (JSHSHIRsiz) hisob ism-familiya bo'yicha 1:1 mos kelsa — JSHSHIRli hisob SAQLANADI,
// u HEMIS yozuviga ulanadi, takroriy (JSHSHIRsiz, yangi) hisob o'chiriladi.
//   node scripts/merge-duplicate-staff.js          -> QURUQ YURISH (faqat sonlar)
//   node scripts/merge-duplicate-staff.js --apply  -> birlashtiradi
// Noaniq (bir nechta nomzod) yoki mos kelmaganlarga TEGILMAYDI.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

// ism-familiyani solishtirish kaliti: kirill/lotin, tutuq belgisi, x/h, q/k, ikkilangan harflar, -xon/-jon/-bek
const CYR = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"j",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"s",ч:"ch",ш:"sh",щ:"sh",ъ:"",ы:"i",ь:"",э:"e",ю:"yu",я:"ya",ў:"u",қ:"k",ғ:"g",ҳ:"h" };
const nm = (v, strip) => {
  let s = String(v || "").toLowerCase().split("").map((c) => (CYR[c] !== undefined ? CYR[c] : c)).join("");
  s = s.replace(/o[‘’`ʻʼ']/g, "u").replace(/[‘’`ʻʼ']/g, "").replace(/x/g, "h").replace(/q/g, "k").replace(/[^a-z]/g, "");
  s = s.replace(/(?<=[aeiou])y(?=[aeiou])/g, "").replace(/iy/g, "i").replace(/(.)\1/g, "$1");
  if (strip) for (const suf of ["hon", "jon", "bek"]) if (s.endsWith(suf) && s.length - suf.length >= 3) { s = s.slice(0, -suf.length); break; }
  return s;
};
const keyOf = (u) => `${nm(u.lastName, false)}|${nm(u.firstName, true)}`;

(async () => {
  await mongoose.connect(process.env.MONGO_HOST, { autoIndex: false, autoCreate: false });
  const UserModel = require("../src/modules/4.01-auth/user/user.model");
  const FaceLink = require("../src/modules/4.15-faceLogin/faceLink.model");
  const FaceTemplate = require("../src/modules/4.15-faceLogin/faceTemplate.model");

  const links = await FaceLink.find({}).lean();
  const camLinks = links.filter((l) => !l.hemisId && !String(l.camStaffId).startsWith("hemis:"));
  const hemisLinks = links.filter((l) => String(l.camStaffId).startsWith("hemis:"));
  const users = new Map(
    (await UserModel.find({ _id: { $in: links.map((l) => l.user) } }).select("firstName lastName oneIdPin lastSeen").lean()).map((u) => [String(u._id), u]),
  );

  const hemisByKey = new Map();
  for (const l of hemisLinks) {
    const u = users.get(String(l.user));
    if (!u) continue;
    const k = keyOf(u);
    hemisByKey.set(k, [...(hemisByKey.get(k) || []), { link: l, user: u }]);
  }

  const stats = { kameradanHEMISsiz: camLinks.length, juftTopildi: 0, noaniq: 0, mosKelmadi: 0 };
  const pairs = [];
  for (const l of camLinks) {
    const u = users.get(String(l.user));
    if (!u) continue;
    const cands = hemisByKey.get(keyOf(u)) || [];
    if (cands.length === 1) { stats.juftTopildi++; pairs.push({ camLink: l, camUser: u, ...cands[0] }); }
    else if (cands.length > 1) stats.noaniq++;
    else stats.mosKelmadi++;
  }

  console.log(APPLY ? "== YOZISH ==" : "== QURUQ YURISH (yozilmaydi) ==");
  console.log(JSON.stringify(stats));

  if (APPLY) {
    let merged = 0;
    for (const p of pairs) {
      // takroriy hisob faqat JSHSHIRsiz va hech qachon kirmagan bo'lsa o'chiriladi
      if (p.user.oneIdPin || p.user.lastSeen) continue;
      await FaceLink.updateOne({ _id: p.camLink._id }, { $set: { hemisId: p.link.hemisId } });
      await FaceTemplate.updateMany({ user: p.user._id }, { $set: { user: p.camUser._id } });
      await FaceLink.deleteOne({ _id: p.link._id });
      await UserModel.deleteOne({ _id: p.user._id, oneIdPin: null });
      merged++;
    }
    console.log(`Birlashtirildi: ${merged}`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
