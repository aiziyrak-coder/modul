"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { ROLES } = require("../src/config/constants");

const DRY = process.argv.includes("--dry");

const TEACHING_ROLES = [ROLES.OQITUVCHI, ROLES.KAFEDRA_MUDIRI];

const POSITION_BY_ROLE = {
  [ROLES.KAFEDRA_MUDIRI]: /dotsent/i,
  [ROLES.OQITUVCHI]: /assistent/i,
};

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `[TeacherProfiles Seed] MongoDB ga ulandi${DRY ? "  —  🔍 DRY-RUN (hech narsa yozilmaydi)" : ""}\n`,
  );

  const User = require("../src/modules/4.01-auth/user/user.model");
  const Role = require("../src/modules/4.01-auth/role/role.model");
  const TeacherProfile = require("../src/modules/4.03-teacher/teacher/teacher.model");
  const Department = require("../src/references/department/department.model");
  const Position = require("../src/references/position/position.model");

  const roles = await Role.find({ title: { $in: TEACHING_ROLES } })
    .select("_id title")
    .lean();
  if (!roles.length) {
    console.error(
      "  ✖ TO'XTATILDI: dars o'tadigan rol topilmadi " +
        `(${TEACHING_ROLES.join(", ")}). Avval seed/studyload-roles.seed.js.`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }
  const roleTitleById = new Map(roles.map((r) => [String(r._id), r.title]));

  const positions = await Position.find({}).select("_id title").lean();
  const findPosition = (roleTitle) => {
    const rx = POSITION_BY_ROLE[roleTitle];
    if (!rx) return null;
    return positions.find((p) => rx.test(p.title || "")) || null;
  };

  const users = await User.find({ role: { $in: roles.map((r) => r._id) } })
    .select("_id firstName lastName oneIdPin role department active")
    .lean();

  console.log(`  Dars o'tadigan rollarda ${users.length} ta user topildi\n`);

  const departments = await Department.find({})
    .select("_id title faculty")
    .lean();
  const depById = new Map(departments.map((d) => [String(d._id), d]));

  let created = 0, updated = 0, skipped = 0, noDep = 0;

  for (const u of users) {
    const nom = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.oneIdPin;
    const roleTitle = roleTitleById.get(String(u.role)) || "?";

    if (!u.department) {
      console.log(
        `  ⊘ CHETLAB   ${String(u.oneIdPin).padEnd(15)} ${nom} — department YO'Q ` +
          "(scope'li rol uni ko'rmaydi, profil shovqin bo'lardi)",
      );
      noDep += 1;
      continue;
    }

    const dep = depById.get(String(u.department));
    const pos = findPosition(roleTitle);
    const want = {
      department: u.department,
      faculty: dep?.faculty || null,
      position: pos?._id || null,
    };

    const existing = await TeacherProfile.findOne({ user: u._id });

    if (existing) {
      const depDrift =
        String(existing.department || "") !== String(want.department || "");
      const facDrift =
        String(existing.faculty || "") !== String(want.faculty || "");
      const posMissing = !existing.position && !!want.position;

      if (!depDrift && !facDrift && !posMissing) {
        console.log(`  ~ SKIP      ${String(u.oneIdPin).padEnd(15)} ${nom} (profil bor, o'zgarishsiz)`);
        skipped += 1;
        continue;
      }

      const nima = [
        depDrift && "department",
        facDrift && "faculty",
        posMissing && `lavozim → ${pos?.title}`,
      ]
        .filter(Boolean)
        .join(", ");
      console.log(
        `  ↻ YANGILAN  ${String(u.oneIdPin).padEnd(15)} ${nom} — ${nima}`,
      );
      if (!DRY) {
        if (depDrift) existing.department = want.department;
        if (facDrift) existing.faculty = want.faculty;
        if (posMissing) existing.position = want.position;
        await existing.save();
      }
      updated += 1;
      continue;
    }

    console.log(
      `  + YARATILAD ${String(u.oneIdPin).padEnd(15)} ${nom.padEnd(20)} ` +
        `${roleTitle.padEnd(16)} ${dep?.title || "?"}` +
        (pos ? `  · ${pos.title}` : "  · lavozimsiz"),
    );
    if (!DRY) {
      await TeacherProfile.create({
        user: u._id,
        ...want,
        active: true,
        hrApprovalStatus: "approved",
        hrComment: "Seed fixture (teacher-profiles.seed.js)",
      });
    }
    created += 1;
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  ${DRY ? "Yaratilardi " : "Yaratildi   "}: ${created}`);
  console.log(`  ${DRY ? "Yangilanardi" : "Yangilandi  "}: ${updated}`);
  console.log(`  O'tkazildi   : ${skipped}`);
  console.log(`  Chetlab (departmentsiz): ${noDep}`);
  if (DRY) {
    console.log("\n  🔍 DRY-RUN — DB o'zgarmadi. Yozish uchun `--dry` siz ishga tushiring.");
  } else {
    const total = await TeacherProfile.countDocuments({ active: true });
    console.log(`\n  Jami faol profil: ${total}`);
    console.log("  Tekshirish: 4.2 → Taqsimot → detal → \"+ Biriktirish\" → O'qituvchi select");
  }
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[TeacherProfiles Seed] XATO:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
