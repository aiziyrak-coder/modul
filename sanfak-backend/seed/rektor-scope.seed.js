"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");
const onlyArg = (process.argv.find((a) => a.startsWith("--only=")) || "").split("=")[1];
const ONLY = ["council", "practice", "both"].includes(onlyArg) ? onlyArg : null;

const COUNCIL = ["councilMember", "councilTask", "rankApplication", "votingSession", "anonymousVote", "announcement"];
const PRACTICE = ["practice", "medicalOrganization", "practiceStudent", "orgType", "province", "region", "district"];

const line = (c = "─") => console.log(c.repeat(66));

async function main() {
  if (!ONLY) {
    console.log("\n  Rejim ko'rsatilmagan. Variantlar:");
    console.log("    --only=council   → rektor faqat 4.09 Kengashni ko'radi");
    console.log("    --only=practice  → rektor faqat 4.13 Amaliyotni ko'radi");
    console.log("    --only=both      → ikkisi ham (cheklov olib tashlanadi)\n");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_HOST);
  const roles = mongoose.connection.db.collection("roles");
  const role = await roles.findOne({ title: "rektor" });
  if (!role) {
    console.log("  ⚠ `rektor` roli topilmadi.");
    await mongoose.disconnect();
    return;
  }

  const key = role.permissions ? "permissions" : "sections";
  const cur = role[key] || [];
  const nameOf = (s) => s.section || s.module;

  const drop = ONLY === "council" ? PRACTICE : ONLY === "practice" ? COUNCIL : [];
  const kept = cur.filter((s) => !drop.includes(nameOf(s)));
  const removed = cur.filter((s) => drop.includes(nameOf(s)));

  console.log(`\n[rektor-scope] rejim: --only=${ONLY}  ·  ${APPLY ? "APPLY" : "DRY-RUN"}`);
  line("═");
  console.log("  OLDIN :", cur.map(nameOf).sort().join(", ") || "—");
  console.log("  KEYIN :", kept.map(nameOf).sort().join(", ") || "—");
  console.log(`  Olib tashlanadi: ${removed.length} ta` + (removed.length ? ` (${removed.map(nameOf).join(", ")})` : ""));

  if (ONLY === "both") {
    line();
    console.log("  `--only=both` cheklovni olib tashlaydi, lekin O'CHIRILGAN");
    console.log("  section'larni QAYTARMAYDI. Ularni tiklash uchun:");
    console.log("    node seed/council-roles.seed.js");
    console.log("    node seed/practice-roles.seed.js");
  }

  if (removed.length === 0 && ONLY !== "both") {
    line("═");
    console.log("  Allaqachon shu doirada — o'zgartirish kerak emas.\n");
    await mongoose.disconnect();
    return;
  }

  if (APPLY && removed.length) {
    await roles.updateOne({ _id: role._id }, { $set: { [key]: kept } });
    line("═");
    console.log("  ✅ Qo'llandi.");
  } else if (!APPLY) {
    line("═");
    console.log("  DRY-RUN — hech narsa yozilmadi.");
    console.log(`  Qo'llash uchun: node seed/rektor-scope.seed.js --only=${ONLY} --apply`);
  }
  console.log("  Teskarisiga o'tish: --only=" + (ONLY === "council" ? "practice" : "council") + " yoki mos rol seedini qayta yugurtirish\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[rektor-scope] XATO:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
