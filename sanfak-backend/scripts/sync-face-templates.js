// cam.fermi.uz da TASDIQLANGAN yuz izlarini (xodim + talaba) nusxalash. stdin, TAB bilan:
//   camId \t type(xodim|talaba) \t embedding(JSON, 512 son)
//   node scripts/sync-face-templates.js [--dry-run] [--force]
// Himoya: kelgan yuzlar soni hozirgi faollarning yarmidan kam bo'lsa (kamera bazasi javob bermay bo'sh
// chiqqan bo'lishi mumkin) hech narsa o'zgarmaydi — aks holda hamma yuz bilan kira olmay qolardi.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const DIM = 512;
const dry = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

const readStdin = () =>
  new Promise((resolve, reject) => {
    let d = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => resolve(d));
    process.stdin.on("error", reject);
  });

(async () => {
  const rows = [];
  let bad = 0;
  for (const line of (await readStdin()).split(/\r?\n/)) {
    if (!line) continue;
    const [camId, kind, raw] = line.split("\t");
    if (!camId || !["xodim", "talaba"].includes(kind)) { bad++; continue; }
    let vec;
    try { vec = JSON.parse(raw); } catch { bad++; continue; }
    if (!Array.isArray(vec) || vec.length !== DIM || vec.some((x) => typeof x !== "number")) { bad++; continue; }
    rows.push({ camId: String(camId), kind, vec });
  }

  await mongoose.connect(process.env.MONGO_HOST, { autoIndex: false, autoCreate: false });
  const FaceTemplate = require("../src/modules/4.15-faceLogin/faceTemplate.model");
  const FaceLink = require("../src/modules/4.15-faceLogin/faceLink.model");
  await FaceTemplate.createIndexes();

  const active = await FaceTemplate.countDocuments({ active: true, source: { $in: ["cam", null] } });
  if (!force && active && rows.length < active * 0.5) {
    console.log(`TO'XTATILDI: ${rows.length} ta yuz keldi, bazada ${active} ta faol. Hech narsa o'zgarmadi.`);
    await mongoose.disconnect();
    return process.exit(2);
  }

  const links = new Map((await FaceLink.find({}).select("camStaffId user").lean()).map((l) => [l.camStaffId, l.user]));
  const now = new Date();
  let xodimBogLangan = 0, xodimBogLanmagan = 0, talaba = 0;
  const ops = rows.map((r) => {
    const user = r.kind === "xodim" ? links.get(r.camId) || null : null;
    if (r.kind === "talaba") talaba++;
    else if (user) xodimBogLangan++;
    else xodimBogLanmagan++;
    return {
      updateOne: {
        filter: { camPersonId: r.camId },
        update: { $set: { kind: r.kind, user, embedding: r.vec, active: true, source: "cam", syncedAt: now } },
        upsert: true,
      },
    };
  });

  let o = { deactivated: 0 };
  if (!dry) {
    if (ops.length) await FaceTemplate.bulkWrite(ops, { ordered: false });
    // bu safar kelmaganlar (yuzi tasdig'i bekor bo'lgan, o'chirilgan) — faolsizlantiriladi
    const r = await FaceTemplate.updateMany(
      { active: true, source: { $in: ["cam", null] }, syncedAt: { $lt: now } },
      { $set: { active: false } },
    );
    o.deactivated = r.modifiedCount || 0;
  }
  console.log(
    `${dry ? "SINOV (saqlanmadi) " : ""}keldi=${rows.length} xodim_bog'langan=${xodimBogLangan} ` +
      `xodim_bog'lanmagan=${xodimBogLanmagan} talaba(raqib)=${talaba} yaroqsiz=${bad} faolsizlantirildi=${o.deactivated}`,
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
