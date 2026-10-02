const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const {
  resolveByTitle,
} = require("../src/modules/4.11-giftedStudent/_services/academicYearRefPlugin");
const AcademicYear = require("../src/references/academicYear/academicYear.model");
const Course = require("../src/references/course/course.model");
const Faculty = require("../src/references/faculty/faculty.model");
const Direction = require("../src/references/direction/direction.model");
const Group = require("../src/references/group/group.model");

const WRITE = process.argv.includes("--write");

const resolveUnique = (rows, title, parentField, parentId) => {
  const matches = rows.filter((r) => {
    if (r.title !== title) return false;
    if (parentField) return String(r[parentField]) === String(parentId);
    return true;
  });
  if (matches.length === 1) return { id: matches[0]._id };
  if (matches.length > 1) return { ambiguous: matches.map((m) => String(m._id)) };
  return { id: null };
};

async function run() {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;
  const gs = db.collection("giftedstudents");

  console.log(`\n  DB: ${mongoose.connection.name}`);
  console.log(`  Rejim: ${WRITE ? "--write (YOZADI)" : "dry-run (hech narsa yozilmaydi)"}\n`);

  const LIVE = { active: { $ne: false } };
  const facs = await db.collection("faculties").find(LIVE).toArray();
  const dirs = await db.collection("directions").find(LIVE).toArray();
  const grps = await db.collection("groups").find(LIVE).toArray();

  const students = await gs.find({ deletedAt: null }).toArray();
  let touched = 0;
  const missed = { faculty: 0, direction: 0, group: 0 };
  const ambiguous = [];
  const blockedByParent = [];

  for (const s of students) {
    const set = {};

    let facId = s.facultyId ?? null;
    if (s.faculty && !facId) {
      const r = resolveUnique(facs, s.faculty);
      if (r.ambiguous) {
        ambiguous.push({ who: s.fullName, field: "faculty", title: s.faculty, ids: r.ambiguous });
      } else if (r.id) {
        facId = r.id;
        set.facultyId = r.id;
      } else {
        missed.faculty++;
      }
    }

    let dirId = s.directionId ?? null;
    if (s.direction && !dirId) {
      if (!facId) {
        blockedByParent.push({ who: s.fullName, field: "direction", title: s.direction, need: "faculty" });
      } else {
        const r = resolveUnique(dirs, s.direction, "faculty", facId);
        if (r.ambiguous) {
          ambiguous.push({ who: s.fullName, field: "direction", title: s.direction, ids: r.ambiguous });
        } else if (r.id) {
          dirId = r.id;
          set.directionId = r.id;
        } else {
          missed.direction++;
        }
      }
    }

    if (s.group && !s.groupId) {
      if (!dirId) {
        blockedByParent.push({ who: s.fullName, field: "group", title: s.group, need: "direction" });
      } else {
        const r = resolveUnique(grps, s.group, "direction", dirId);
        if (r.ambiguous) {
          ambiguous.push({ who: s.fullName, field: "group", title: s.group, ids: r.ambiguous });
        } else if (r.id) {
          set.groupId = r.id;
        } else {
          missed.group++;
        }
      }
    }

    if (Object.keys(set).length) {
      if (WRITE) await gs.updateOne({ _id: s._id }, { $set: set });
      touched++;
      console.log(`  ${WRITE ? "OK" : "->"} [${s.fullName}] ${Object.keys(set).join(", ")}`);
    }
  }

  console.log(
    `\n  ${touched}/${students.length} yozuv ${WRITE ? "yangilandi" : "yangilanadi"}. ` +
      `Mos kelmagan (snapshot qoladi): faculty=${missed.faculty}, direction=${missed.direction}, group=${missed.group}.`,
  );

  if (blockedByParent.length) {
    console.log(`\n  OGOHLANTIRISH — ota-ona resolve bo'lmagani uchun o'tkazib yuborildi (${blockedByParent.length}):`);
    for (const b of blockedByParent) {
      console.log(`     [${b.who}] ${b.field}="${b.title}" — avval ${b.need} kerak`);
    }
    console.log(`     Bu ATAYLAB: ota-onasiz bog'lash institut bo'ylab bir xil nomli`);
    console.log(`     begona qatorga ulanib ketishi mumkin edi.`);
  }

  if (ambiguous.length) {
    console.log(`\n  NOANIQ — yozilmadi (${ambiguous.length}):`);
    for (const a of ambiguous) {
      console.log(`     [${a.who}] ${a.field}="${a.title}" -> ${a.ids.length} ta moslik: ${a.ids.join(", ")}`);
    }
    console.log(`     Ma'lumotnomada bir xil sarlavhali qatorlar bor. Avval dublikatni hal`);
    console.log(`     qiling (yoki keraksizini \`active: false\` qiling), keyin qayta ishga tushiring.`);
  }

  console.log("\n  ── O'quv yili (academicYearId) ──");
  const YEAR_COLLECTIONS = ["giftedstudents", "scholarships", "scholarshipapplications"];
  let yearTouched = 0;
  let yearMissed = 0;
  const plannedRef = new Map();
  for (const name of YEAR_COLLECTIONS) {
    const col = db.collection(name);
    const pending = await col
      .find({
        academicYear: { $nin: [null, ""] },
        $or: [{ academicYearId: null }, { academicYearId: { $exists: false } }],
      })
      .toArray();

    let n = 0;
    for (const d of pending) {
      const ref = await resolveByTitle(d.academicYear);
      if (!ref) {
        yearMissed++;
        continue;
      }
      if (WRITE) await col.updateOne({ _id: d._id }, { $set: { academicYearId: ref } });
      else plannedRef.set(String(d._id), ref);
      n++;
    }
    yearTouched += n;
    console.log(`     ${name.padEnd(24)} ${n}/${pending.length} ${WRITE ? "yangilandi" : "yangilanadi"}`);
  }
  console.log(
    `     Jami ${yearTouched} ta bog'lanish` +
      (yearMissed ? ` · ${yearMissed} ta sarlavha ma'lumotnomada topilmadi (satr qoladi)` : ""),
  );

  console.log("\n  ── Snapshot sarlavhasini kanonik shaklga ──");
  const titleById = new Map(
    (await AcademicYear.find({}).select("title").lean()).map((r) => [String(r._id), r.title]),
  );
  let renamed = 0;
  for (const name of YEAR_COLLECTIONS) {
    const col = db.collection(name);
    const linked = await col
      .find({ deletedAt: null, $or: [{ academicYearId: { $ne: null } }, { _id: { $in: [...plannedRef.keys()].map((k) => new mongoose.Types.ObjectId(k)) } }] })
      .toArray();
    let n = 0;
    for (const d of linked) {
      const ref = d.academicYearId ?? plannedRef.get(String(d._id));
      const canonical = ref ? titleById.get(String(ref)) : null;
      if (!canonical || canonical === d.academicYear) continue;
      if (WRITE) await col.updateOne({ _id: d._id }, { $set: { academicYear: canonical } });
      n++;
    }
    renamed += n;
    console.log(`     ${name.padEnd(24)} ${n}/${linked.length} ${WRITE ? "o'zgartirildi" : "o'zgartiriladi"}`);
  }
  console.log(`     Jami ${renamed} ta sarlavha`);

  console.log("\n  ── Kurs (courseId / allowedCourseIds) ──");
  const courseByNumber = new Map();
  for (const c of await Course.find({}).select("title").lean()) {
    const m = String(c.title ?? "").match(/^(\d+)-kurs$/);
    if (m && !courseByNumber.has(Number(m[1]))) courseByNumber.set(Number(m[1]), c._id);
  }

  let courseTouched = 0;
  let courseMissed = 0;
  const gsPending = await gs
    .find({
      deletedAt: null,
      course: { $ne: null },
      $or: [{ courseId: null }, { courseId: { $exists: false } }],
    })
    .toArray();
  for (const d of gsPending) {
    const ref = courseByNumber.get(Number(d.course));
    if (!ref) {
      courseMissed++;
      continue;
    }
    if (WRITE) await gs.updateOne({ _id: d._id }, { $set: { courseId: ref } });
    courseTouched++;
  }
  console.log(
    `     giftedstudents           ${courseTouched}/${gsPending.length} ${WRITE ? "yangilandi" : "yangilanadi"}` +
      (courseMissed ? ` · ${courseMissed} ta kurs ma'lumotnomada yo'q (son qoladi)` : ""),
  );

  let allowedTouched = 0;
  let allowedUnmapped = 0;
  const schCol = db.collection("scholarships");
  const schPending = await schCol
    .find({
      deletedAt: null,
      allowedCourses: { $exists: true, $ne: [] },
      $or: [{ allowedCourseIds: null }, { allowedCourseIds: { $exists: false } }, { allowedCourseIds: [] }],
    })
    .toArray();
  for (const d of schPending) {
    const refs = [];
    for (const v of d.allowedCourses ?? []) {
      const ref = courseByNumber.get(Number(v));
      if (ref) refs.push(ref);
      else allowedUnmapped++;
    }
    if (!refs.length) continue;
    if (WRITE) await schCol.updateOne({ _id: d._id }, { $set: { allowedCourseIds: refs } });
    allowedTouched++;
  }
  console.log(
    `     scholarships             ${allowedTouched}/${schPending.length} ${WRITE ? "yangilandi" : "yangilanadi"}` +
      (allowedUnmapped ? ` · ${allowedUnmapped} ta qiymat ma'lumotnomada yo'q (satrda qoladi)` : ""),
  );

  console.log("\n-- Fakultet/yo'nalish/guruh snapshotlari --");
  const SNAPSHOT_REFS = [
    { ref: "facultyId", snapshot: "faculty", model: Faculty, label: "fakultet" },
    { ref: "directionId", snapshot: "direction", model: Direction, label: "yo'nalish" },
    { ref: "groupId", snapshot: "group", model: Group, label: "guruh" },
  ];
  let snapRenamed = 0;
  for (const { ref, snapshot, model, label } of SNAPSHOT_REFS) {
    const rows = await model.find({}).select("title").lean();
    const byId = new Map(rows.map((r) => [String(r._id), r.title]));
    const linked = await gs.find({ deletedAt: null, [ref]: { $ne: null } }).toArray();
    let n = 0;
    for (const d of linked) {
      const title = byId.get(String(d[ref]));
      if (!title || title === d[snapshot]) continue;
      if (WRITE) await gs.updateOne({ _id: d._id }, { $set: { [snapshot]: title } });
      n++;
    }
    snapRenamed += n;
    console.log(`     ${label.padEnd(24)} ${n}/${linked.length} ${WRITE ? "tekislandi" : "tekislanadi"}`);
  }
  console.log(`     Jami ${snapRenamed} ta snapshot`);

  if (!WRITE && (touched || yearTouched || renamed || courseTouched || allowedTouched || snapRenamed)) {
    console.log(`\n  Dry-run — hech narsa yozilmadi. Qo'llash uchun: --write`);
  }
  console.log("");
  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("Backfill XATO:", err.message);
    process.exit(1);
  });
}

module.exports = { run, resolveUnique };
