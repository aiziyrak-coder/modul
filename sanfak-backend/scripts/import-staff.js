// cam.fermi.uz xodimlari (stdin, TAB bilan ajratilgan) + HEMIS xodim yozuvlari -> foydalanuvchilar.
//
// stdin qatori: camId \t full_name \t pinfl \t hemis_id \t position \t active(t/f) \t type
//   node scripts/import-staff.js          -> QURUQ YURISH: bazaga yozmaydi, faqat SONLARNI chiqaradi
//   node scripts/import-staff.js --apply  -> yozadi
//
// Qoidalar:
//  * faqat type=xodim, faol, JSHSHIR 14 raqam;
//  * HEMIS yozuviga aniq bog'langanlar (cam.hemis_id == HEMIS id/meta_id/employee_id_number) yaratiladi;
//    bog'lanmaganlar yoki bir nechta variantga mos kelganlar YARATILMAYDI — ro'yxatga olinadi;
//  * rol faqat ISHONCHLI lavozimlarga beriladi; rektor/prorektor/dekan kabi yuqori rollar avtomatik berilmaydi;
//  * mavjud JSHSHIRli hisobga tegilmaydi.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

const { roleForPosition } = require("../src/modules/4.14-hemis/hemis.roles");

const readStdin = () =>
  new Promise((resolve, reject) => {
    let d = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => resolve(d));
    process.stdin.on("error", reject);
  });

(async () => {
  const input = await readStdin();
  const camRows = input
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => l.split("\t"))
    .filter((p) => p.length >= 7)
    .map(([camId, fullName, pinfl, hemisId, position, active, type]) => ({
      camId, fullName, pinfl: String(pinfl || "").replace(/\D/g, ""), hemisId: String(hemisId || "").trim(),
      position, active: active === "t" || active === "true", type,
    }));

  await mongoose.connect(process.env.MONGO_HOST, { autoIndex: false, autoCreate: false });
  const { HemisRecord } = require("../src/modules/4.14-hemis/hemis.model");
  const UserModel = require("../src/modules/4.01-auth/user/user.model");
  const RoleModel = require("../src/modules/4.01-auth/role/role.model");
  const FaceLink = require("../src/modules/4.15-faceLogin/faceLink.model");

  // HEMIS xodimlarini bir necha kalit bo'yicha indekslaymiz
  const emp = await HemisRecord.find({ type: "employee", missing: false }).select("data").lean();
  const byKey = new Map(); // kalit -> Set(HEMIS shaxs id)
  const personRows = new Map(); // HEMIS shaxs id -> [qatorlar]
  for (const r of emp) {
    const d = r.data;
    const pid = String(d.id);
    if (!personRows.has(pid)) personRows.set(pid, []);
    personRows.get(pid).push(d);
    for (const k of [d.id, d.meta_id, d.employee_id_number]) {
      if (k === undefined || k === null) continue;
      const key = String(k);
      if (!byKey.has(key)) byKey.set(key, new Set());
      byKey.get(key).add(pid);
    }
  }

  const roles = new Map((await RoleModel.find({}).select("_id title").lean()).map((r) => [r.title, r._id]));

  const stats = {
    camJami: camRows.length, xodim: 0, faol: 0, pinfloYaroqli: 0,
    hemisBogLangan: 0, hemisTopilmadi: 0, hemisBirNechta: 0,
    allaqachonBor: 0, yaratiladi: 0, rolBilan: 0, rolsiz: 0, takrorPinfl: 0,
  };
  const byRole = {};
  const rolsizLavozim = {};
  const seenPin = new Set();
  const toCreate = [];

  for (const c of camRows) {
    if (c.type !== "xodim") continue;
    stats.xodim++;
    if (!c.active) continue;
    stats.faol++;
    if (!/^\d{14}$/.test(c.pinfl)) continue;
    stats.pinfloYaroqli++;
    if (seenPin.has(c.pinfl)) { stats.takrorPinfl++; continue; }
    seenPin.add(c.pinfl);

    const cand = byKey.get(c.hemisId);
    if (!c.hemisId || !cand) { stats.hemisTopilmadi++; continue; }
    if (cand.size > 1) { stats.hemisBirNechta++; continue; }
    stats.hemisBogLangan++;

    const rows = personRows.get([...cand][0]);
    const base = rows[0];
    // bir necha lavozim bo'lsa eng kuchli rolni tanlaymiz
    let best = null;
    for (const r of rows) {
      const m = roleForPosition(r.staffPosition?.name);
      if (m && (!best || m.rank > best.rank)) best = m;
    }
    const roleTitle = best && roles.has(best.role) ? best.role : null;

    toCreate.push({
      c, base, roleTitle,
      posName: rows.map((r) => r.staffPosition?.name).filter(Boolean)[0] || "(lavozim yo'q)",
    });
  }

  // mavjud JSHSHIRlar
  const existing = new Set(
    (await UserModel.find({ oneIdPin: { $in: toCreate.map((x) => x.c.pinfl) } }).select("+oneIdPin").lean()).map((u) => u.oneIdPin),
  );
  const final = toCreate.filter((x) => {
    if (existing.has(x.c.pinfl)) { stats.allaqachonBor++; return false; }
    return true;
  });
  for (const x of final) {
    stats.yaratiladi++;
    if (x.roleTitle) { stats.rolBilan++; byRole[x.roleTitle] = (byRole[x.roleTitle] || 0) + 1; }
    else { stats.rolsiz++; rolsizLavozim[x.posName] = (rolsizLavozim[x.posName] || 0) + 1; }
  }

  console.log(APPLY ? "== YOZISH ==" : "== QURUQ YURISH (bazaga yozilmaydi) ==");
  console.log(JSON.stringify(stats, null, 2));
  console.log("Rol bo'yicha:", JSON.stringify(byRole));
  console.log("Rolsiz qoladigan lavozimlar:", JSON.stringify(rolsizLavozim));

  if (APPLY) {
    await FaceLink.createIndexes();
    let ok = 0, fail = 0;
    for (const x of final) {
      try {
        const d = x.base;
        const user = await UserModel.create({
          firstName: d.first_name || x.c.fullName.split(" ")[1] || "-",
          lastName: d.second_name || x.c.fullName.split(" ")[0] || "-",
          middleName: d.third_name || null,
          oneIdPin: x.c.pinfl,
          role: x.roleTitle ? roles.get(x.roleTitle) : null,
          active: true,
        });
        await FaceLink.updateOne(
          { camStaffId: x.c.camId },
          { $set: { user: user._id, hemisId: x.c.hemisId, source: "import" } },
          { upsert: true },
        );
        ok++;
      } catch (e) {
        fail++;
        console.error("xato:", e.message.slice(0, 120)); // shaxsiy ma'lumot chiqarilmaydi
      }
    }
    console.log(`Yaratildi: ${ok}, xato: ${fail}`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
