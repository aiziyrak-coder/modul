"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const WRITE = process.argv.includes("--write");
const DRY = !WRITE;

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const FACULTY_TITLE = "Davolash fakulteti";
const DEPARTMENT_TITLE = "Ichki kasalliklar kafedrasi";
const GROUP_TITLE = "Dav-101";
const SCIENCE_A_TITLE = "Anatomiya";
const SCIENCE_B_TITLE = "Fiziologiya";
const ACADEMIC_YEAR_TITLE = "2025/2026";

const iso = (s) => new Date(s);

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  log(`\n[domain-demo-data] ${DRY ? "🔍 DRY-RUN (hech narsa yozilmaydi)" : "✍️  WRITE"}`);
  line("═");

  const Faculty = require("../src/references/faculty/faculty.model");
  const Department = require("../src/references/department/department.model");
  const Group = require("../src/references/group/group.model");
  const Science = require("../src/references/science/science.model");
  const AcademicYear = require("../src/references/academicYear/academicYear.model");
  const User = require("../src/modules/4.01-auth/user/user.model");
  const Role = require("../src/modules/4.01-auth/role/role.model");

  const Student = require("../src/domain/student/student.model");
  const Exam = require("../src/domain/exam/exam.model");
  const Gradebook = require("../src/domain/gradebook/gradebook.model");
  const Attendance = require("../src/domain/attendance/attendance.model");
  const Schedule = require("../src/domain/schedule/schedule.model");

  const [faculty, department, group, scienceA, scienceB, academicYear] = await Promise.all([
    Faculty.findOne({ title: FACULTY_TITLE }).select("_id title").lean(),
    Department.findOne({ title: DEPARTMENT_TITLE }).select("_id title faculty").lean(),
    Group.findOne({ title: GROUP_TITLE }).select("_id title direction").lean(),
    Science.findOne({ title: SCIENCE_A_TITLE }).select("_id title").lean(),
    Science.findOne({ title: SCIENCE_B_TITLE }).select("_id title").lean(),
    AcademicYear.findOne({ title: ACADEMIC_YEAR_TITLE }).select("_id title").lean(),
  ]);

  const missing = [
    !faculty && `fakultet "${FACULTY_TITLE}"`,
    !department && `kafedra "${DEPARTMENT_TITLE}"`,
    !group && `guruh "${GROUP_TITLE}"`,
    !scienceA && `fan "${SCIENCE_A_TITLE}"`,
    !scienceB && `fan "${SCIENCE_B_TITLE}"`,
    !academicYear && `o'quv yili "${ACADEMIC_YEAR_TITLE}"`,
  ].filter(Boolean);

  if (missing.length) {
    console.error(`  ✖ TO'XTATILDI — topilmadi: ${missing.join(", ")}`);
    console.error("    Avval `npm run seed:refs` ni ishlating.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const roles = await Role.find({ title: { $in: ["oqituvchi", "kafedra_mudiri"] } })
    .select("_id title")
    .lean();
  const roleIdByTitle = new Map(roles.map((r) => [r.title, String(r._id)]));

  const teacherPool = await User.find({
    department: department._id,
    role: { $in: roles.map((r) => r._id) },
    active: true,
  })
    .select("_id firstName lastName role")
    .lean();

  const findTeacher = (fullName) =>
    teacherPool.find((u) => `${u.firstName} ${u.lastName}` === fullName);
  const findAnyByRoleTitle = (roleTitle) =>
    teacherPool.find((u) => String(u.role) === roleIdByTitle.get(roleTitle));

  const teacherA = findTeacher("Dilnoza Yusupova") || findAnyByRoleTitle("oqituvchi");
  const teacherB =
    findTeacher("Akmal Karimov") ||
    teacherPool.find((u) => findAnyByRoleTitle("oqituvchi") && String(u._id) !== String(teacherA?._id)) ||
    teacherA;
  const kafedraMudiri = findAnyByRoleTitle("kafedra_mudiri");

  if (!teacherA || !kafedraMudiri) {
    console.error(
      `  ✖ TO'XTATILDI — "${DEPARTMENT_TITLE}" kafedrasida kamida 1 "oqituvchi" + 1 "kafedra_mudiri" topilmadi.`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  log(`  Fakultet   : ${faculty.title}`);
  log(`  Kafedra    : ${department.title}`);
  log(`  Guruh      : ${group.title}`);
  log(`  Fanlar     : ${scienceA.title}, ${scienceB.title}`);
  log(`  O'quv yili : ${academicYear.title}`);
  log(`  O'qituvchi : ${teacherA.firstName} ${teacherA.lastName}${teacherB && teacherB._id.toString() !== teacherA._id.toString() ? `, ${teacherB.firstName} ${teacherB.lastName}` : ""}`);
  log(`  Kaf.mudiri : ${kafedraMudiri.firstName} ${kafedraMudiri.lastName}\n`);

  const ctx = {
    faculty, department, group, scienceA, scienceB, academicYear,
    teacherA, teacherB, kafedraMudiri,
  };

  const stats = {};
  const countBefore = {};
  for (const [key, Model] of [
    ["students", Student], ["exams", Exam], ["gradebooks", Gradebook],
    ["studentAttendances", Attendance], ["schedules", Schedule],
  ]) {
    countBefore[key] = await Model.countDocuments();
  }

  line("─");
  log("── 1. TALABALAR (domain/student) ──");
  const students = await ensureStudents(Student, ctx);

  line("─");
  log("── 2. IMTIHONLAR (domain/exam) ──");
  await ensureExams(Exam, ctx, students);

  line("─");
  log("── 3. JURNALLAR (domain/gradebook) ──");
  await ensureGradebooks(Gradebook, ctx, students);

  line("─");
  log("── 4. DAVOMAD (domain/attendance) ──");
  await ensureAttendances(Attendance, ctx, students);

  line("─");
  log("── 5. DARS JADVALI (domain/schedule) ──");
  await ensureSchedules(Schedule, ctx);

  line("═");
  const Models = {
    students: Student, exams: Exam, gradebooks: Gradebook,
    studentAttendances: Attendance, schedules: Schedule,
  };
  log("  Kolleksiya bo'yicha yozuv soni (oldin → keyin*):");
  for (const key of Object.keys(Models)) {
    const after = DRY ? countBefore[key] : await Models[key].countDocuments();
    log(`    ${key.padEnd(20)} ${countBefore[key]} → ${after}${DRY ? "  (*DRY — real emas)" : ""}`);
  }

  line("═");
  if (DRY) {
    log("  🔍 DRY-RUN — DB o'zgarmadi. Yozish uchun `--write` bilan ishlating.");
  } else {
    log("  ✓ Domain demo ma'lumot tayyor.");
    log("  Tekshirish:");
    log("    GET /api/exams        (teacher populate)");
    log("    GET /api/gradebooks");
    log("    GET /api/student-attendance");
    log("    GET /api/schedule");
  }
  line("═");

  await mongoose.disconnect();
}

async function ensureOne(Model, match, buildDoc, describe) {
  const existing = await Model.findOne(match).select("_id").lean();
  if (existing) {
    log(`  ~ MAVJUD — ${describe}`);
    return existing._id;
  }
  if (DRY) {
    log(`  + YARATILARDI — ${describe}`);
    return null;
  }
  const doc = await Model.create(buildDoc());
  log(`  + YARATILDI — ${describe}`);
  return doc._id;
}

async function ensureStudents(Student, ctx) {
  const { group, faculty } = ctx;
  const roster = [
    { code: "DEMO-STU-001", firstName: "Sardor", lastName: "Aliyev", middleName: "Botirovich", gender: "male", status: "active" },
    { code: "DEMO-STU-002", firstName: "Malika", lastName: "Yusupova", middleName: "Baxtiyorovna", gender: "female", status: "active" },
    { code: "DEMO-STU-003", firstName: "Jasur", lastName: "Ergashev", middleName: "Anvarovich", gender: "male", status: "active" },
    { code: "DEMO-STU-004", firstName: "Nilufar", lastName: "Karimova", middleName: "Shavkatovna", gender: "female", status: "active" },
    { code: "DEMO-STU-005", firstName: "Aziz", lastName: "Toshmatov", middleName: "Rustamovich", gender: "male", status: "active" },
    { code: "DEMO-STU-006", firstName: "Dilnoza", lastName: "Rashidova", middleName: "Ilxomovna", gender: "female", status: "leave" },
  ];

  const created = [];
  for (const s of roster) {
    const id = await ensureOne(
      Student,
      { studentId: s.code },
      () => ({
        firstName: s.firstName,
        lastName: s.lastName,
        middleName: s.middleName,
        gender: s.gender,
        birthDate: iso("2006-03-15"),
        studentId: s.code,
        group: group._id,
        faculty: faculty._id,
        direction: group.direction || null,
        course: 1,
        semester: 1,
        enrollmentYear: 2025,
        studyType: "grant",
        educationForm: "kunduzgi",
        status: s.status,
        active: true,
      }),
      `${s.code} — ${s.lastName} ${s.firstName} (${s.status})`,
    );
    created.push({ ...s, _id: id });
  }

  if (DRY) {
    const existing = await Student.find({ studentId: { $in: roster.map((r) => r.code) } })
      .select("_id studentId status")
      .lean();
    const byCode = new Map(existing.map((e) => [e.studentId, e]));
    for (const s of created) {
      const e = byCode.get(s.code);
      if (e) s._id = e._id;
    }
  }

  return created.filter((s) => s.status === "active");
}

async function ensureExams(Exam, ctx, students) {
  const { group, scienceA, scienceB, faculty, department, academicYear, teacherA, teacherB, kafedraMudiri } = ctx;
  const stubResults = () => students.filter((s) => s._id).map((s) => ({ student: s._id }));

  await ensureOne(
    Exam,
    { science: scienceA._id, teacher: teacherA._id, examType: "midterm", date: iso("2026-09-10") },
    () => ({
      groups: [group._id], science: scienceA._id, teacher: teacherA._id,
      faculty: faculty._id, department: department._id,
      examType: "midterm", date: iso("2026-09-10"), startTime: "09:00", duration: 90,
      academicYear: academicYear._id, semester: 1,
      results: stubResults(),
      status: "scheduled",
      note: "Oraliq nazorat — QA demo",
    }),
    `${scienceA.title} — midterm 2026-09-10 (scheduled)`,
  );

  await ensureOne(
    Exam,
    { science: scienceA._id, teacher: teacherA._id, examType: "final", date: iso("2026-07-15") },
    () => {
      const active = students.filter((s) => s._id);
      const results = active.map((s, i) => {
        if (i === active.length - 1) return { student: s._id, absent: true, passed: false, grade: null, letterGrade: null, gradedAt: iso("2026-07-15") };
        const grade = [92, 78, 55, 68][i] ?? 70;
        const passed = grade >= 60;
        const letterGrade = grade >= 90 ? "A" : grade >= 70 ? "B" : grade >= 60 ? "C" : "F";
        return { student: s._id, grade, passed, letterGrade, absent: false, gradedAt: iso("2026-07-15") };
      });
      return {
        groups: [group._id], science: scienceA._id, teacher: teacherA._id,
        faculty: faculty._id, department: department._id,
        examType: "final", date: iso("2026-07-15"), startTime: "10:00", duration: 120,
        academicYear: academicYear._id, semester: 1,
        results,
        status: "completed",
        approvedBy: kafedraMudiri._id,
        note: "Yakuniy nazorat — QA demo (o'tkazilgan)",
      };
    },
    `${scienceA.title} — final 2026-07-15 (completed, natijalar bilan)`,
  );

  await ensureOne(
    Exam,
    { science: scienceB._id, teacher: teacherB._id, examType: "retake", date: iso("2026-08-25") },
    () => ({
      groups: [group._id], science: scienceB._id, teacher: teacherB._id,
      faculty: faculty._id, department: department._id,
      examType: "retake", date: iso("2026-08-25"), startTime: "14:00", duration: 90,
      academicYear: academicYear._id, semester: 1,
      results: stubResults(),
      status: "postponed",
      note: "Auditoriya band bo'lgani sababli ko'chirildi — QA demo",
    }),
    `${scienceB.title} — retake 2026-08-25 (postponed)`,
  );
}

async function ensureGradebooks(Gradebook, ctx, students) {
  const { group, scienceA, scienceB, faculty, department, academicYear, teacherA, teacherB } = ctx;
  const active = students.filter((s) => s._id);

  const buildSummary = (grades) =>
    active.map((s, i) => {
      const overall = grades[i] ?? 70;
      const passed = overall >= 60;
      const letterGrade = overall >= 90 ? "A" : overall >= 70 ? "B" : overall >= 60 ? "C" : "F";
      return {
        student: s._id,
        attendedHours: 8, missedHours: 2, attendanceRate: 80,
        midterm: Math.round(overall * 0.4), final: Math.round(overall * 0.6),
        overall, letterGrade, passed,
      };
    });

  const buildLessons = () => [
    {
      date: iso("2026-07-01"), topic: "Kirish mavzu", lessonType: "lecture", hours: 2,
      entries: active.map((s, i) => ({
        student: s._id,
        attendance: ["present", "present", "late", "absent"][i] || "present",
        grade: i === 3 ? null : 60 + i * 5,
      })),
    },
    {
      date: iso("2026-07-08"), topic: "Davomi", lessonType: "lecture", hours: 2,
      entries: active.map((s, i) => ({
        student: s._id,
        attendance: ["present", "excused", "present", "present"][i] || "present",
        grade: 65 + i * 4,
      })),
    },
  ];

  await ensureOne(
    Gradebook,
    { group: group._id, science: scienceA._id, semester: 1, academicYear: academicYear._id, lessonType: "lecture" },
    () => ({
      group: group._id, science: scienceA._id, teacher: teacherA._id,
      faculty: faculty._id, department: department._id,
      academicYear: academicYear._id, semester: 1, lessonType: "lecture", totalHours: 4,
      lessons: buildLessons(),
      summary: buildSummary([92, 78, 55, 68]),
      status: "active",
      note: "QA demo — faol jurnal",
    }),
    `${scienceA.title} / sem1 / lecture (active)`,
  );

  await ensureOne(
    Gradebook,
    { group: group._id, science: scienceB._id, semester: 1, academicYear: academicYear._id, lessonType: "seminar" },
    () => ({
      group: group._id, science: scienceB._id, teacher: teacherB._id,
      faculty: faculty._id, department: department._id,
      academicYear: academicYear._id, semester: 1, lessonType: "seminar", totalHours: 4,
      lessons: buildLessons(),
      summary: buildSummary([85, 60, 74, 58]),
      status: "active",
      note: "QA demo — faol jurnal (seminar)",
    }),
    `${scienceB.title} / sem1 / seminar (active)`,
  );

  await ensureOne(
    Gradebook,
    { group: group._id, science: scienceA._id, semester: 2, academicYear: academicYear._id, lessonType: "lecture" },
    () => ({
      group: group._id, science: scienceA._id, teacher: teacherA._id,
      faculty: faculty._id, department: department._id,
      academicYear: academicYear._id, semester: 2, lessonType: "lecture", totalHours: 4,
      lessons: buildLessons(),
      summary: buildSummary([88, 71, 90, 62]),
      status: "closed",
      closedAt: iso("2026-06-30"),
      note: "QA demo — yopilgan jurnal",
    }),
    `${scienceA.title} / sem2 / lecture (closed)`,
  );
}

async function ensureAttendances(Attendance, ctx, students) {
  const { group, scienceA, scienceB, academicYear, teacherA, teacherB } = ctx;
  const active = students.filter((s) => s._id);

  const buildAttendances = (pattern) =>
    active.map((s, i) => ({ student: s._id, status: pattern[i] || "present" }));

  await ensureOne(
    Attendance,
    { group: group._id, science: scienceA._id, teacher: teacherA._id, date: iso("2026-07-01") },
    () => ({
      group: group._id, science: scienceA._id, teacher: teacherA._id,
      date: iso("2026-07-01"), lessonType: "lecture",
      academicYear: academicYear._id, semester: 1,
      attendances: buildAttendances(["present", "present", "late", "absent"]),
    }),
    `${scienceA.title} — 2026-07-01 (present/late/absent aralash)`,
  );

  await ensureOne(
    Attendance,
    { group: group._id, science: scienceB._id, teacher: teacherB._id, date: iso("2026-07-03") },
    () => ({
      group: group._id, science: scienceB._id, teacher: teacherB._id,
      date: iso("2026-07-03"), lessonType: "seminar",
      academicYear: academicYear._id, semester: 1,
      attendances: buildAttendances(["present", "excused", "present", "present"]),
    }),
    `${scienceB.title} — 2026-07-03 (excused bilan)`,
  );

  await ensureOne(
    Attendance,
    { group: group._id, science: scienceA._id, teacher: teacherA._id, date: iso("2026-07-08") },
    () => ({
      group: group._id, science: scienceA._id, teacher: teacherA._id,
      date: iso("2026-07-08"), lessonType: "lecture",
      academicYear: academicYear._id, semester: 1,
      attendances: buildAttendances(["absent", "present", "present", "late"]),
    }),
    `${scienceA.title} — 2026-07-08 (yana boshqa kombinatsiya)`,
  );
}

async function ensureSchedules(Schedule, ctx) {
  const { group, scienceA, scienceB, academicYear, teacherA, teacherB } = ctx;

  await ensureOne(
    Schedule,
    { dayOfWeek: 1, group: group._id, science: scienceA._id, teacher: teacherA._id, lessonType: "maruza", academicYear: academicYear._id },
    () => ({
      dayOfWeek: 1, group: group._id, science: scienceA._id, teacher: teacherA._id,
      lessonType: "maruza", semester: 1, academicYear: academicYear._id, weekType: "both", active: true,
    }),
    `Dushanba — ${scienceA.title} (maruza, ${teacherA.firstName})`,
  );

  await ensureOne(
    Schedule,
    { dayOfWeek: 2, group: group._id, science: scienceB._id, teacher: teacherB._id, lessonType: "amaliy", academicYear: academicYear._id },
    () => ({
      dayOfWeek: 2, group: group._id, science: scienceB._id, teacher: teacherB._id,
      lessonType: "amaliy", semester: 1, academicYear: academicYear._id, weekType: "odd", active: true,
    }),
    `Seshanba — ${scienceB.title} (amaliy, ${teacherB.firstName}, toq hafta)`,
  );

  await ensureOne(
    Schedule,
    { dayOfWeek: 3, group: group._id, science: scienceA._id, teacher: teacherA._id, lessonType: "seminar", academicYear: academicYear._id },
    () => ({
      dayOfWeek: 3, group: group._id, science: scienceA._id, teacher: teacherA._id,
      lessonType: "seminar", semester: 1, academicYear: academicYear._id, weekType: "even", active: true,
    }),
    `Chorshanba — ${scienceA.title} (seminar, juft hafta)`,
  );
}

main().catch(async (err) => {
  console.error("[domain-demo-data] XATO:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
