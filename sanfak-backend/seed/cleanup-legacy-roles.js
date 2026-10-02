"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { ROLES } = require("../src/config/constants");

const apply = process.argv.includes("--apply");

const REMAP = {
  tm_rahbar: "prorektor",
  tm_ijrochi: "oqituvchi",
  tasktest_member: "oqituvchi",
  tasktest_deptlead: "kafedra_mudiri",
  tasktest_faclead: "dekan",
};

const DELETE_EMPTY = ["tm_kategoriya_admin"];

const KEEP = ["tasktest_noperm"];

const line = (s = "") => console.log(s);
const fail = (msg) => {
  console.error(`\n  ✖ TO'XTATILDI: ${msg}`);
  process.exitCode = 1;
};

(async () => {
  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;
  const rolesCol = db.collection("roles");
  const usersCol = db.collection("users");

  const canon = new Set(Object.values(ROLES));
  const allRoles = await rolesCol.find({}).project({ title: 1, scopeLevel: 1, permissions: 1 }).toArray();
  const byTitle = new Map(allRoles.map((r) => [r.title, r]));
  const nonCanonical = allRoles.filter((r) => !canon.has(r.title));

  line(`\nBazada ${allRoles.length} rol · kanonik ${canon.size} · kanonik EMAS ${nonCanonical.length}`);

  if (!nonCanonical.length) {
    line("\n  Kanonik bo'lmagan rol yo'q — baza allaqachon toza.");
    await mongoose.disconnect();
    return;
  }

  const handled = new Set([...Object.keys(REMAP), ...DELETE_EMPTY, ...KEEP]);
  const unhandled = nonCanonical.filter((r) => !handled.has(r.title));
  if (unhandled.length) {
    return fail(
      `xaritada yo'q kanonik bo'lmagan rol(lar): ${unhandled.map((r) => r.title).join(", ")}. ` +
        `Skriptni yangilang — jimgina o'tkazib yuborilmaydi.`,
    );
  }

  for (const [from, to] of Object.entries(REMAP)) {
    if (!byTitle.has(from)) continue;
    if (!byTitle.has(to)) return fail(`maqsad rol topilmadi: "${to}" (manba: ${from})`);
  }

  line("\n── KO'CHIRISH REJASI ──────────────────────────────────────────────");
  const plan = [];
  for (const [from, to] of Object.entries(REMAP)) {
    const src = byTitle.get(from);
    if (!src) {
      line(`  (o'tkazildi) ${from} — rol yo'q, allaqachon tozalangan`);
      continue;
    }
    const dst = byTitle.get(to);
    const users = await usersCol
      .find({ role: src._id })
      .project({ firstName: 1, lastName: 1, oneIdPin: 1 })
      .toArray();
    plan.push({ src, dst, users });
    line(
      `  ${from} (${src.scopeLevel}, ${(src.permissions || []).length} sec) → ` +
        `${to} (${dst.scopeLevel}, ${(dst.permissions || []).length} sec) · ${users.length} user`,
    );
    users.forEach((u) =>
      line(`      ${(u.oneIdPin || "(PINsiz)").padEnd(16)} ${u.lastName} ${u.firstName}`),
    );
    if (src.scopeLevel !== dst.scopeLevel) {
      line(`      ⚠ scopeLevel o'zgaradi: ${src.scopeLevel} → ${dst.scopeLevel}`);
    }
  }

  line("\n── O'CHIRISH REJASI ───────────────────────────────────────────────");
  const toDelete = [...Object.keys(REMAP), ...DELETE_EMPTY]
    .map((t) => byTitle.get(t))
    .filter(Boolean);
  toDelete.forEach((r) => line(`  ${r.title}`));
  line("\n── QOLDIRILADI ────────────────────────────────────────────────────");
  KEEP.forEach((t) => line(`  ${t} — 0 ruxsatli negative-test fixture'i`));

  line("\n── HAVOLA SKANERI (barcha kolleksiyalar) ──────────────────────────");
  const doomedIds = toDelete.map((r) => r._id);
  const collections = await db.listCollections().toArray();
  const foreign = [];
  for (const { name } of collections) {
    if (name === "roles") continue;
    for (const field of ["role", "roles", "roleId", "defaultRole"]) {
      const n = await db.collection(name).countDocuments({ [field]: { $in: doomedIds } }).catch(() => 0);
      if (n > 0) {
        const expected = name === "users" && field === "role";
        foreign.push({ name, field, n, expected });
        line(`  ${expected ? "·" : "⚠"} ${name}.${field} → ${n} ta hujjat${expected ? " (kutilgan)" : " (KUTILMAGAN)"}`);
      }
    }
  }
  if (!foreign.length) line("  (havola topilmadi)");
  const unexpected = foreign.filter((f) => !f.expected);
  if (unexpected.length) {
    return fail(
      `kutilmagan havolalar bor: ${unexpected.map((f) => `${f.name}.${f.field}`).join(", ")}. ` +
        `Ular avval hal qilinishi kerak.`,
    );
  }

  if (!apply) {
    line("\n[DRY] Hech narsa o'zgartirilmadi. Bajarish: --apply\n");
    await mongoose.disconnect();
    return;
  }

  line("\n── BAJARILMOQDA ───────────────────────────────────────────────────");
  let moved = 0;
  for (const { src, dst, users } of plan) {
    if (!users.length) continue;
    const res = await usersCol.updateMany({ role: src._id }, { $set: { role: dst._id } });
    moved += res.modifiedCount;
    line(`  ${src.title} → ${dst.title}: ${res.modifiedCount} user ko'chirildi`);
  }

  const stillReferenced = [];
  for (const r of toDelete) {
    const n = await usersCol.countDocuments({ role: r._id });
    if (n > 0) stillReferenced.push(`${r.title} (${n} user)`);
  }
  if (stillReferenced.length) {
    return fail(`ko'chirishdan keyin ham havola qoldi: ${stillReferenced.join(", ")} — HECH NARSA O'CHIRILMADI`);
  }

  const del = await rolesCol.deleteMany({ _id: { $in: doomedIds } });
  line(`  ${del.deletedCount} ta bo'sh rol o'chirildi`);

  const after = await rolesCol.find({}).project({ title: 1 }).toArray();
  const leftNonCanon = after.filter((r) => !canon.has(r.title)).map((r) => r.title);
  const orphanUsers = await usersCol.countDocuments({
    role: { $nin: after.map((r) => r._id), $ne: null },
  });

  line("\n── YAKUNIY HOLAT ──────────────────────────────────────────────────");
  line(`  rollar: ${allRoles.length} → ${after.length}`);
  line(`  ko'chirilgan userlar: ${moved}`);
  line(`  kanonik bo'lmagan qolgani: ${leftNonCanon.length ? leftNonCanon.join(", ") : "(yo'q)"}`);
  line(`  rolsiz qolgan (orphan) userlar: ${orphanUsers}`);
  if (orphanUsers > 0) fail("orphan user bor — tekshiring!");
  line("");

  await mongoose.disconnect();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
