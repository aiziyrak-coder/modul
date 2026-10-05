// HEMIS xodim suratlaridan yuz izi hosil qilish (yuz bilan kirish uchun), faqat tasdiqlangan yuzi YO'Q xodimlarga.
//   node scripts/enroll-hemis-photos.js [--limit N]          -> SINOV: hech narsa saqlanmaydi, faqat sonlar
//   node scripts/enroll-hemis-photos.js --apply [--limit N]  -> saqlaydi (source="hemis")
// Himoya: yuz aniq topilishi (det_score >= 0.6), bitta surat ikki hisobga ishlatilmagan bo'lishi
// (boshqa xodim izi bilan o'xshashlik < 0.8). Chegaralar (0.52 / 0.07) o'zgarmaydi.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
const MIN_DET = 0.6;
const DUP_SIM = 0.8;
const CONCURRENCY = 3;

const norm = (a) => {
  const n = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  return n ? Float32Array.from(a, (x) => x / n) : null;
};
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

async function embedFromUrl(url) {
  let res;
  try { res = await fetch(url, { signal: AbortSignal.timeout(20000) }); } catch { return { fail: "yuklanmadi" }; }
  const type = res.headers.get("content-type") || "";
  if (!res.ok || !type.startsWith("image/")) return { fail: "surat_yoq" };
  const buf = Buffer.from(await res.arrayBuffer());
  const form = new FormData();
  form.append("image", new Blob([buf], { type: "image/jpeg" }), "p.jpg");
  let r;
  try {
    r = await fetch(`${process.env.FACE_API_URL.replace(/\/+$/, "")}/embed`, { method: "POST", body: form, signal: AbortSignal.timeout(30000) });
  } catch { return { fail: "xizmat_xato" }; }
  if (r.status === 413 || r.status === 422) return { fail: "yuz_yoq" };
  if (!r.ok) return { fail: "xizmat_xato" };
  const j = await r.json();
  if (!Array.isArray(j.embedding)) return { fail: j.too_small ? "yuz_kichik" : "yuz_yoq" };
  if ((j.det_score ?? 0) < MIN_DET) return { fail: "yuz_xira" };
  return { emb: j.embedding, faces: j.faces };
}

(async () => {
  if (!process.env.FACE_API_URL) throw new Error("FACE_API_URL sozlanmagan");
  await mongoose.connect(process.env.MONGO_HOST, { autoIndex: false, autoCreate: false });
  const FaceTemplate = require("../src/modules/4.15-faceLogin/faceTemplate.model");
  const FaceLink = require("../src/modules/4.15-faceLogin/faceLink.model");
  const UserModel = require("../src/modules/4.01-auth/user/user.model");
  const { HemisRecord } = require("../src/modules/4.14-hemis/hemis.model");

  const existing = await FaceTemplate.find({ active: true }).select("+embedding user kind camPersonId").lean();
  const haveUser = new Set(existing.filter((t) => t.user).map((t) => String(t.user)));
  const known = existing.filter((t) => t.kind === "xodim" && t.user).map((t) => ({ user: String(t.user), v: norm(t.embedding) })).filter((x) => x.v);

  const emp = await HemisRecord.find({ type: "employee", missing: false }).select("data").lean();
  const byKey = new Map();
  for (const r of emp) for (const k of [r.data.id, r.data.meta_id, r.data.employee_id_number]) {
    if (k == null) continue;
    if (!byKey.has(String(k))) byKey.set(String(k), []);
    byKey.get(String(k)).push(r.data);
  }

  const links = await FaceLink.find({ hemisId: { $ne: null } }).select("user hemisId").lean();
  const users = new Map((await UserModel.find({ _id: { $in: links.map((l) => l.user) } }).select("role").lean()).map((u) => [String(u._id), u]));
  const todo = links.filter((l) => !haveUser.has(String(l.user)) && users.has(String(l.user))).slice(0, LIMIT);

  const stats = { nomzod: todo.length, saqlandi: 0, takroriySurat: 0 };
  const fails = {};
  const newOnes = [];
  let idx = 0;
  const worker = async () => {
    while (idx < todo.length) {
      const l = todo[idx++];
      const rows = byKey.get(String(l.hemisId)) || [];
      const main = rows.find((r) => /asosiy/i.test(r.employmentForm?.name || "")) || rows[0];
      const url = main?.image || main?.image_full;
      if (!url) { fails.surat_yoq = (fails.surat_yoq || 0) + 1; continue; }
      const out = await embedFromUrl(url);
      if (out.fail) { fails[out.fail] = (fails[out.fail] || 0) + 1; continue; }
      const v = norm(out.emb);
      const dup = [...known, ...newOnes].some((k) => k.user !== String(l.user) && dot(v, k.v) >= DUP_SIM);
      if (dup) { stats.takroriySurat++; continue; }
      newOnes.push({ user: String(l.user), v, emb: out.emb, hemisId: l.hemisId });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (APPLY) {
    await FaceTemplate.createIndexes();
    for (const n of newOnes) {
      await FaceTemplate.updateOne(
        { camPersonId: `hemis:${n.hemisId}` },
        { $set: { kind: "xodim", user: n.user, embedding: n.emb, active: true, source: "hemis", syncedAt: new Date() } },
        { upsert: true },
      );
    }
    stats.saqlandi = newOnes.length;
  }
  console.log(APPLY ? "== YOZISH ==" : "== SINOV (saqlanmaydi) ==");
  console.log(JSON.stringify({ ...stats, tayyor: newOnes.length, muvaffaqiyatsiz: fails }));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
