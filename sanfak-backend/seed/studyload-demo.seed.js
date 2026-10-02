"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const DRY = process.argv.includes("--dry");

const DIRECTION_TITLE = "Davolash ishi";
const ACADEMIC_YEAR_TITLES = ["2026/2027", "2027/2028"];
const DEPARTMENT_TITLE = "Ichki kasalliklar kafedrasi";
const TARGET_BLOCK_TITLE = "Majburiy fanlar";

const log = (s = "") => console.log(s);

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  log(
    `[StudyLoadDemo Seed] MongoDB${DRY ? "  —  🔍 DRY-RUN (hech narsa yozilmaydi)" : ""}\n`,
  );

  const Direction = require("../src/references/direction/direction.model");
  const AcademicYear = require("../src/references/academicYear/academicYear.model");
  const Department = require("../src/references/department/department.model");
  const Group = require("../src/references/group/group.model");
  const Science = require("../src/references/science/science.model");
  const WorkingSchedule = require("../src/modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
  const WorkingPlan = require("../src/modules/4.02-studyLoad/workingPlan/workingPlan.model");

  const [direction, department] = await Promise.all([
    Direction.findOne({ title: DIRECTION_TITLE }).select("_id title").lean(),
    Department.findOne({ title: DEPARTMENT_TITLE }).select("_id title").lean(),
  ]);

  if (!direction || !department) {
    console.error(
      `  ✖ TO'XTATILDI — topilmadi: ` +
        [!direction && `yo'nalish "${DIRECTION_TITLE}"`, !department && `kafedra "${DEPARTMENT_TITLE}"`]
          .filter(Boolean)
          .join(", "),
    );
    console.error("    Avval `node seed/index.js` (reference ma'lumot) ni ishlating.");
    await mongoose.disconnect();
    process.exit(1);
  }

  for (const yearTitle of ACADEMIC_YEAR_TITLES) {
    log(`\n╔═══ O'QUV YILI: ${yearTitle} ${"═".repeat(Math.max(0, 34 - yearTitle.length))}`);
    await seedOneYear({
      yearTitle, direction, department,
      AcademicYear, Group, Science, WorkingSchedule, WorkingPlan,
    });
  }

  log("\n═══════════════════════════════════════════════════");
  if (DRY) {
    log("  🔍 DRY-RUN — DB o'zgarmadi. Yozish uchun `--dry` siz ishlating.");
  } else {
    log("  ✓ Demo ma'lumot tayyor.");
  }
  log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
}

async function seedOneYear(ctx) {
  const {
    yearTitle, direction, department,
    AcademicYear, Group, Science, WorkingSchedule, WorkingPlan,
  } = ctx;

  const academicYear = await AcademicYear.findOne({ title: yearTitle })
    .select("_id title")
    .lean();
  if (!academicYear) {
    log(`  ⚠ SKIP — o'quv yili "${yearTitle}" topilmadi`);
    return;
  }

  const schedule = await WorkingSchedule.findOne({
    direction: direction._id,
    academicYear: academicYear._id,
  });

  if (!schedule) {
    log(`  ⚠ SKIP — "${DIRECTION_TITLE}" / ${yearTitle} uchun ishchi grafik yo'q`);
    return;
  }

  log(`  Grafik: ${schedule._id}  (kurs ${schedule.currentCourse}, ${schedule.status})\n`);

  log("── 1. KONTINGENT (grafikka guruh biriktirish) ──");
  const groups = await Group.find({ direction: direction._id, active: true })
    .select("_id title lang academicYear")
    .lean();

  if (!groups.length) {
    log(`  ⚠ SKIP — "${DIRECTION_TITLE}" yo'nalishida faol guruh yo'q`);
    return;
  }

  const langCount = new Set(groups.map((g) => String(g.lang))).size;
  log(`  Topildi: ${groups.length} guruh, ${langCount} xil til`);
  groups.forEach((g) => log(`    · ${g.title}`));
  log(
    `  → getGroupStats: groupCount=${groups.length}, streamCount=${langCount}` +
      (groups.length === langCount
        ? "  ⚠ teng — ma'ruza/amaliy ko'paytiruvchisi farqlanmaydi"
        : "  ✓ farqli"),
  );

  const already = (schedule.groups || []).map(String);
  const toAttach = groups.filter((g) => !already.includes(String(g._id)));

  if (!toAttach.length) {
    log("  ~ Guruhlar allaqachon biriktirilgan\n");
  } else {
    log(`  ${DRY ? "+ BIRIKTIRILARDI" : "+ BIRIKTIRILDI"}: ${toAttach.length} guruh`);
    if (!DRY) {
      schedule.groups = [...(schedule.groups || []), ...toAttach.map((g) => g._id)];
      await schedule.save();
    }
    log("");
  }

  log("── 2. GURUHLARGA O'QUV YILI ──");
  const needYear = groups.filter(
    (g) => String(g.academicYear || "") !== String(academicYear._id),
  );
  if (!needYear.length) {
    log("  ~ Hammasida allaqachon to'g'ri\n");
  } else {
    log(`  ${DRY ? "↻ YOZILARDI" : "↻ YOZILDI"}: ${needYear.length} guruhga ${academicYear.title}`);
    if (!DRY) {
      await Group.updateMany(
        { _id: { $in: needYear.map((g) => g._id) } },
        { $set: { academicYear: academicYear._id } },
      );
    }
    log("");
  }

  log("── 3. ISHCHI REJA FANLARIGA KAFEDRA ──");
  const plan = await WorkingPlan.findOne({ workingSchedule: schedule._id });

  if (!plan) {
    log("  ⚠ SKIP — bu grafik uchun ishchi reja yo'q");
    return;
  }

  log(`  Reja: ${plan._id}`);

  let touched = 0;
  let skippedOther = 0;
  const scienceCache = new Map();

  const ensureScience = async (title) => {
    if (scienceCache.has(title)) return scienceCache.get(title);
    let doc = await Science.findOne({ title }).select("_id").lean();
    if (!doc && !DRY) {
      doc = await Science.create({ title, department: department._id });
    }
    scienceCache.set(title, doc || null);
    return doc || null;
  };

  for (const [semKey, semData] of plan.semesters.entries()) {
    for (const block of semData.blocks || []) {
      const isTarget = block.title === TARGET_BLOCK_TITLE;

      for (const sci of block.sciences || []) {
        if (!isTarget) {
          skippedOther += 1;
          continue;
        }
        if (String(sci.department || "") === String(department._id)) continue;

        const ref = await ensureScience(sci.title);
        log(
          `    ${DRY ? "↻" : "+"} sem${semKey}  "${String(sci.title).slice(0, 40)}"` +
            (ref ? "" : "  (science ref yaratilardi)"),
        );
        if (!DRY) {
          sci.department = department._id;
          if (ref && !sci.science) sci.science = ref._id;
        }
        touched += 1;
      }
    }
  }

  if (!DRY && touched) {
    plan.markModified("semesters");
    await plan.save();
  }

  log(
    `\n  "${TARGET_BLOCK_TITLE}" fanlari: ${touched} ta ${DRY ? "yangilanardi" : "yangilandi"}`,
  );
  log(
    `  Boshqa bloklar (masalan "Tanlov fanlari"): ${skippedOther} ta ATAYIN tegilmadi\n` +
      "    → kafedra filtri haqiqatan ishlayotganini ko'rsatish uchun",
  );

  log(
    `  → POST /api/workloads  { department: "${department._id}", academicYear: "${academicYear._id}" }`,
  );
}

main().catch(async (err) => {
  console.error("[StudyLoadDemo Seed] XATO:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
