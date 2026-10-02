"use strict";
const mongoose = require("mongoose");
const { ErrorHandler } = require("#shared/error");

const WorkingSchedule = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const Distribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const Syllabus = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const LearningProcess = require("#modules/4.02-studyLoad/learningProcess/learningProcess.model");
const TeacherLeave = require("#modules/4.02-studyLoad/teacherLeave/teacherLeave.model");

const Group = require("#references/group/group.model");
const LanguageOfInstruction = require("#references/languageOfInstruction/languageOfInstruction.model");

const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");
const { ROLES } = require("#config/constants");

const {
  loadRefMaps,
  idsInFaculty,
  leafHourCreditTotals,
} = require("#modules/4.02-studyLoad/_services/oubStatsAggregations");

const {
  shadowedIds,
  excludeShadow,
  WORKLOAD_GROUP,
  DISTRIBUTION_GROUP,
} = require("./studyLoadStatistics.shadow");

const LIVE = { active: true };
const HUJJAT_HOLATLARI = ["draft", "new", "in_review", "approved", "rejected"];
const UNKNOWN = "unknown";

const bosh = () => Object.fromEntries(HUJJAT_HOLATLARI.map((k) => [k, 0]));
const foiz = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

async function holatlar(Model, extraMatch) {
  const match = { ...LIVE, ...(extraMatch || {}), status: { $ne: "superseded" } };
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  const out = bosh();
  let total = 0;
  rows.forEach((r) => {
    total += r.n;
    if (r._id in out) out[r._id] = r.n;
  });
  return { total, ...out };
}

async function rektorNavbati(Model, stepsField) {
  const rows = await Model.aggregate([
    { $match: { ...LIVE, status: "in_review" } },
    {
      $match: {
        $expr: {
          $and: [
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: { $ifNull: [`$${stepsField}`, []] },
                      as: "s",
                      cond: { $and: [{ $eq: ["$$s.step", "rektor"] }, { $eq: ["$$s.status", "pending"] }] },
                    },
                  },
                },
                0,
              ],
            },
            {
              $eq: [
                {
                  $size: {
                    $filter: {
                      input: { $ifNull: [`$${stepsField}`, []] },
                      as: "s",
                      cond: { $and: [{ $ne: ["$$s.step", "rektor"] }, { $ne: ["$$s.status", "approved"] }] },
                    },
                  },
                },
                0,
              ],
            },
          ],
        },
      },
    },
    { $group: { _id: null, n: { $sum: 1 }, oldest: { $min: "$updatedAt" } } },
  ]);
  const r = rows?.[0];
  return {
    count: r?.n ?? 0,
    oldestDays: r?.oldest ? Math.floor((Date.now() - new Date(r.oldest).getTime()) / 86_400_000) : null,
  };
}

async function overview() {
  const [ws, wl, ds, sp, sy, inboxWs, inboxWl, hoursAgg, vacAgg] = await Promise.all([
    holatlar(WorkingSchedule),
    holatlar(Workload),
    holatlar(Distribution),
    holatlar(ScienceProgram),
    holatlar(Syllabus),

    rektorNavbati(WorkingSchedule, "approvalHistory"),
    rektorNavbati(Workload, "approvalSteps"),

    Distribution.aggregate([
      { $match: LIVE },
      {
        $group: {
          _id: null,
          distributed: { $sum: "$totalHour" },
          residue: { $sum: "$residueHour" },
        },
      },
    ]),

    Distribution.aggregate([
      { $match: LIVE },
      { $unwind: "$teachers" },
      { $match: { "teachers.isVacant": true } },
      {
        $group: {
          _id: "$department",
          count: { $sum: 1 },
          hours: { $sum: "$teachers.totalHour" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "d",
          pipeline: [{ $project: { title: 1 } }],
        },
      },
      { $unwind: { path: "$d", preserveNullAndEmptyArrays: true } },
    ]),
  ]);

  const h = hoursAgg?.[0] ?? { distributed: 0, residue: 0 };
  const vacCount = vacAgg.reduce((s, r) => s + r.count, 0);
  const vacHours = vacAgg.reduce((s, r) => s + (r.hours ?? 0), 0);

  const jami = ws.total + wl.total + ds.total + sp.total + sy.total;
  const tasdiq = ws.approved + wl.approved + ds.approved + sp.approved + sy.approved;

  const oldest = [inboxWs.oldestDays, inboxWl.oldestDays].filter((x) => x != null);

  return {
    rectorInbox: {
      workingSchedule: inboxWs.count,
      workload: inboxWl.count,
      total: inboxWs.count + inboxWl.count,
      oldestWaitingDays: oldest.length ? Math.max(...oldest) : null,
    },
    documents: {
      workingSchedule: ws,
      workload: wl,
      distribution: ds,
      scienceProgram: sp,
      syllabus: sy,
      readiness: foiz(tasdiq, jami),
    },
    hours: {
      distributed: h.distributed ?? 0,
      residue: h.residue ?? 0,
      coverage: foiz((h.distributed ?? 0) - (h.residue ?? 0), h.distributed ?? 0),
    },
    vacancies: {
      count: vacCount,
      hours: vacHours,
      byDepartment: vacAgg
        .map((r) => ({ department: r.d?.title ?? null, count: r.count, hours: r.hours ?? 0 }))
        .filter((r) => r.department),
    },
  };
}

function resolveFacultyId(scope, query, scopeLevel) {
  if (scopeLevel === "department") {
    throw new ErrorHandler(
      403,
      "Bu sahifa fakultet yoki institut darajasidagi rollar uchun (kafedra darajasi qo'llab-quvvatlanmaydi)",
    );
  }
  if (scope?.user) {
    throw new ErrorHandler(403, "Bu sahifa fakultet yoki institut darajasidagi rollar uchun");
  }
  const queryFaculty = query.faculty ? new mongoose.Types.ObjectId(query.faculty) : null;
  if (scope?.faculty) {
    const scopeFaculty = new mongoose.Types.ObjectId(scope.faculty);
    if (queryFaculty && String(queryFaculty) !== String(scopeFaculty)) {
      throw new ErrorHandler(403, "So'ralgan fakultet sizning doirangizdan tashqarida");
    }
    return scopeFaculty;
  }
  return queryFaculty;
}

async function countByStatus(Model, match, doneStatus) {
  const live = { ...match, status: { $ne: "superseded" } };
  const rows = await Model.aggregate([{ $match: live }, { $group: { _id: "$status", n: { $sum: 1 } } }]);
  const total = rows.reduce((s, r) => s + r.n, 0);
  const done = rows.find((r) => r._id === doneStatus)?.n ?? 0;
  return { total, done };
}

async function contingentBlock(facultyId, academicYearId, dirFaculty) {
  const match = { active: true };
  if (academicYearId) match.academicYear = academicYearId;
  if (facultyId) match.direction = { $in: idsInFaculty(dirFaculty, facultyId) };

  const rows = await Group.aggregate([
    { $match: match },
    {
      $lookup: {
        from: LanguageOfInstruction.collection.name,
        localField: "lang",
        foreignField: "_id",
        as: "l",
        pipeline: [{ $project: { title: 1 } }],
      },
    },
    { $unwind: { path: "$l", preserveNullAndEmptyArrays: true } },
    { $group: { _id: "$l.title", groups: { $sum: 1 }, students: { $sum: "$studentNumber" } } },
    { $sort: { _id: 1 } },
  ]);

  const groups = rows.reduce((s, r) => s + r.groups, 0);
  const students = rows.reduce((s, r) => s + (r.students ?? 0), 0);
  const byLanguage = rows.map((r) => ({
    language: r._id ?? "Noma'lum",
    groups: r.groups,
    students: r.students ?? 0,
  }));
  return { groups, students, byLanguage };
}

async function distributionHours(facultyId, academicYearId, deptFaculty, shadow = []) {
  const match = { active: true };
  if (academicYearId) match.academicYear = academicYearId;
  if (facultyId) match.department = { $in: idsInFaculty(deptFaculty, facultyId) };
  excludeShadow(match, shadow);

  const rows = await Distribution.aggregate([
    { $match: match },
    { $group: { _id: null, distributed: { $sum: "$totalHour" }, residue: { $sum: "$residueHour" } } },
  ]);
  const r = rows[0] ?? { distributed: 0, residue: 0 };
  return { distributed: r.distributed ?? 0, residue: r.residue ?? 0 };
}

async function vacanciesBlock(facultyId, academicYearId, deptFaculty, shadow = []) {
  const match = { active: true };
  if (academicYearId) match.academicYear = academicYearId;
  if (facultyId) match.department = { $in: idsInFaculty(deptFaculty, facultyId) };
  excludeShadow(match, shadow);

  const rows = await Distribution.aggregate([
    { $match: match },
    { $unwind: "$teachers" },
    { $match: { "teachers.isVacant": true } },
    { $group: { _id: null, count: { $sum: 1 }, hours: { $sum: "$teachers.totalHour" } } },
  ]);
  const r = rows[0] ?? { count: 0, hours: 0 };
  return { count: r.count ?? 0, hours: r.hours ?? 0 };
}

async function assignedTeacherCount(facultyId, academicYearId, deptFaculty) {
  const match = { active: true };
  if (academicYearId) match.academicYear = academicYearId;
  if (facultyId) match.department = { $in: idsInFaculty(deptFaculty, facultyId) };

  const rows = await Distribution.aggregate([
    { $match: match },
    { $unwind: "$teachers" },
    { $match: { "teachers.isVacant": false, "teachers.teacher": { $ne: null } } },
    { $group: { _id: "$teachers.teacher" } },
  ]);
  return rows.length;
}

async function teachersBlock(facultyId, academicYearId, deptFaculty) {
  const role = await Role.findOne({ title: ROLES.OQITUVCHI }).select("_id").lean();
  if (!role) return { total: 0, assigned: 0, unassigned: 0, assignedPercent: 0, unknownFaculty: 0 };

  const userMatch = { role: role._id, active: true };
  if (facultyId) {
    userMatch.$or = [
      { department: { $in: idsInFaculty(deptFaculty, facultyId) } },
      { department: null, faculty: facultyId },
    ];
  }
  const rows = await User.aggregate([
    { $match: userMatch },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unknownFaculty: {
          $sum: {
            $cond: [{ $and: [{ $eq: ["$department", null] }, { $eq: ["$faculty", null] }] }, 1, 0],
          },
        },
      },
    },
  ]);
  const total = rows[0]?.total ?? 0;
  const unknownFaculty = rows[0]?.unknownFaculty ?? 0;

  const assigned = await assignedTeacherCount(facultyId, academicYearId, deptFaculty);
  const unassigned = Math.max(0, total - assigned);
  return { total, assigned, unassigned, assignedPercent: foiz(assigned, total), unknownFaculty };
}

async function documentsBlock(facultyId, dirFaculty, deptFaculty) {
  const syMatch = facultyId ? { faculty: facultyId } : undefined;
  const spMatch = facultyId
    ? { directions: { $in: idsInFaculty(dirFaculty, facultyId) } }
    : undefined;

  const tlMatch = { status: "pending", active: true };
  if (facultyId) {
    const teacherIds = await User.find({
      $or: [
        { department: { $in: idsInFaculty(deptFaculty, facultyId) } },
        { department: null, faculty: facultyId },
      ],
    })
      .select("_id")
      .lean();
    tlMatch.teacher = { $in: teacherIds.map((u) => u._id) };
  }

  const [sy, sp, teacherLeaveOpen] = await Promise.all([
    holatlar(Syllabus, syMatch),
    holatlar(ScienceProgram, spMatch),
    TeacherLeave.countDocuments(tlMatch),
  ]);
  const jami = sy.total + sp.total;
  const tasdiq = sy.approved + sp.approved;
  return { syllabus: sy, scienceProgram: sp, readiness: foiz(tasdiq, jami), teacherLeaveOpen };
}

async function oubOverview(scope, query, scopeLevel) {
  const facultyId = resolveFacultyId(scope, query, scopeLevel);
  const academicYearId = query.academicYear ? new mongoose.Types.ObjectId(query.academicYear) : null;

  const { dirFaculty, deptFaculty } = await loadRefMaps();

  const lpMatch = { active: true, deletedAt: null };
  if (facultyId) lpMatch.direction = { $in: idsInFaculty(dirFaculty, facultyId) };

  const wsMatch = { active: true };
  if (academicYearId) wsMatch.academicYear = academicYearId;
  if (facultyId) wsMatch.direction = { $in: idsInFaculty(dirFaculty, facultyId) };

  const wlMatch = { active: true };
  if (academicYearId) wlMatch.academicYear = academicYearId;
  if (facultyId) wlMatch.department = { $in: idsInFaculty(deptFaculty, facultyId) };

  const dsMatch = { active: true };
  if (academicYearId) dsMatch.academicYear = academicYearId;
  if (facultyId) dsMatch.department = { $in: idsInFaculty(deptFaculty, facultyId) };

  const [wlShadow, dsShadow] = await Promise.all([
    shadowedIds(Workload, wlMatch, WORKLOAD_GROUP),
    shadowedIds(Distribution, dsMatch, DISTRIBUTION_GROUP),
  ]);
  excludeShadow(wlMatch, wlShadow);
  excludeShadow(dsMatch, dsShadow);

  const [lp, ws, wl, ds, contingent, leaf, distHours, teachers, vacancies, documents] = await Promise.all([
    countByStatus(LearningProcess, lpMatch, "created"),
    countByStatus(WorkingSchedule, wsMatch, "approved"),
    countByStatus(Workload, wlMatch, "approved"),
    countByStatus(Distribution, dsMatch, "approved"),
    contingentBlock(facultyId, academicYearId, dirFaculty),
    leafHourCreditTotals({ academicYearId, facultyId, dirFaculty }),
    distributionHours(facultyId, academicYearId, deptFaculty, dsShadow),
    teachersBlock(facultyId, academicYearId, deptFaculty),
    vacanciesBlock(facultyId, academicYearId, deptFaculty, dsShadow),
    documentsBlock(facultyId, dirFaculty, deptFaculty),
  ]);

  const steps = [
    { key: "learningProcess", total: lp.total, done: lp.done },
    { key: "workingSchedule", total: ws.total, done: ws.done },
    { key: "workload", total: wl.total, done: wl.done },
    { key: "distribution", total: ds.total, done: ds.done },
  ];
  const stepsTotal = steps.reduce((s, x) => s + x.total, 0);
  const stepsDone = steps.reduce((s, x) => s + x.done, 0);

  return {
    filters: {
      academicYear: query.academicYear || null,
      faculty: facultyId ? String(facultyId) : null,
      scopeLevel: scope?.faculty ? "faculty" : "global",
    },
    studyPlans: { total: lp.total, approved: lp.done, percent: foiz(lp.done, lp.total) },
    contingent,
    execution: { steps, percent: foiz(stepsDone, stepsTotal) },
    hours: {
      planTotalHour: leaf.total.blocksHour,
      planTotalCredit: leaf.total.blocksCredit,
      planGrandTotalHour: leaf.total.grandHour,
      planGrandTotalCredit: leaf.total.grandCredit,
      distributedHour: distHours.distributed,
      residueHour: distHours.residue,
      coverage: foiz(distHours.distributed - distHours.residue, distHours.distributed),
    },
    teachers,
    vacancies,
    documents,
  };
}

async function oubFaculties(scope, query, scopeLevel) {
  const facultyId = resolveFacultyId(scope, query, scopeLevel);
  const academicYearId = query.academicYear ? new mongoose.Types.ObjectId(query.academicYear) : null;

  const { faculties, facultyTitle, dirFaculty, deptFaculty } = await loadRefMaps();
  const targetFaculties = facultyId
    ? faculties.filter((f) => String(f._id) === String(facultyId))
    : faculties;

  const shadowBase = { active: true };
  if (academicYearId) shadowBase.academicYear = academicYearId;
  if (facultyId) shadowBase.department = { $in: idsInFaculty(deptFaculty, facultyId) };
  const dsShadow = await shadowedIds(Distribution, shadowBase, DISTRIBUTION_GROUP);

  const [leaf, distRows, vacRows, contRows] = await Promise.all([
    leafHourCreditTotals({ academicYearId, facultyId, dirFaculty }),
    distributionByFaculty(academicYearId, facultyId, deptFaculty, dsShadow),
    vacancyByFaculty(academicYearId, facultyId, deptFaculty, dsShadow),
    contingentByFaculty(academicYearId, facultyId, dirFaculty),
  ]);

  const distMap = new Map(distRows.map((r) => [r._id, r]));
  const vacMap = new Map(vacRows.map((r) => [r._id, r]));

  const rows = targetFaculties.map((f) => {
    const key = String(f._id);
    const leafBucket = leaf.byFaculty.get(key) ?? { blocksHour: 0, blocksCredit: 0 };
    const dist = distMap.get(key) ?? { distributedHour: 0, residueHour: 0 };
    const vac = vacMap.get(key) ?? { count: 0, hours: 0 };
    const cont = contRows.get(key) ?? { groups: 0, students: 0, directions: 0 };
    return {
      facultyId: f._id,
      faculty: facultyTitle.get(key) ?? f.title,
      directions: cont.directions,
      groups: cont.groups,
      students: cont.students,
      totalCredit: leafBucket.blocksCredit,
      totalHour: leafBucket.blocksHour,
      distributedHour: dist.distributedHour,
      vacantHour: vac.hours,
      vacancies: vac.count,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.directions += r.directions;
      acc.groups += r.groups;
      acc.students += r.students;
      acc.totalCredit += r.totalCredit;
      acc.totalHour += r.totalHour;
      acc.distributedHour += r.distributedHour;
      acc.vacantHour += r.vacantHour;
      acc.vacancies += r.vacancies;
      return acc;
    },
    {
      directions: 0,
      groups: 0,
      students: 0,
      totalCredit: 0,
      totalHour: 0,
      distributedHour: 0,
      vacantHour: 0,
      vacancies: 0,
    },
  );

  return { academicYear: query.academicYear || null, rows, totals };
}

async function distributionByFaculty(academicYearId, facultyId, deptFaculty, shadow = []) {
  const match = { active: true };
  if (academicYearId) match.academicYear = academicYearId;
  if (facultyId) match.department = { $in: idsInFaculty(deptFaculty, facultyId) };
  excludeShadow(match, shadow);

  const rows = await Distribution.aggregate([{ $match: match }, { $group: { _id: "$department", distributedHour: { $sum: "$totalHour" }, residueHour: { $sum: "$residueHour" } } }]);
  const byFaculty = new Map();
  for (const r of rows) {
    const fac = deptFaculty.get(String(r._id)) || UNKNOWN;
    if (!byFaculty.has(fac)) byFaculty.set(fac, { distributedHour: 0, residueHour: 0 });
    const bucket = byFaculty.get(fac);
    bucket.distributedHour += r.distributedHour ?? 0;
    bucket.residueHour += r.residueHour ?? 0;
  }
  return [...byFaculty.entries()].map(([_id, v]) => ({ _id, ...v }));
}

async function vacancyByFaculty(academicYearId, facultyId, deptFaculty, shadow = []) {
  const match = { active: true };
  if (academicYearId) match.academicYear = academicYearId;
  if (facultyId) match.department = { $in: idsInFaculty(deptFaculty, facultyId) };
  excludeShadow(match, shadow);

  const rows = await Distribution.aggregate([
    { $match: match },
    { $unwind: "$teachers" },
    { $match: { "teachers.isVacant": true } },
    { $group: { _id: "$department", count: { $sum: 1 }, hours: { $sum: "$teachers.totalHour" } } },
  ]);
  const byFaculty = new Map();
  for (const r of rows) {
    const fac = deptFaculty.get(String(r._id)) || UNKNOWN;
    if (!byFaculty.has(fac)) byFaculty.set(fac, { count: 0, hours: 0 });
    const bucket = byFaculty.get(fac);
    bucket.count += r.count;
    bucket.hours += r.hours ?? 0;
  }
  return [...byFaculty.entries()].map(([_id, v]) => ({ _id, ...v }));
}

async function contingentByFaculty(academicYearId, facultyId, dirFaculty) {
  const match = { active: true };
  if (academicYearId) match.academicYear = academicYearId;
  if (facultyId) match.direction = { $in: idsInFaculty(dirFaculty, facultyId) };

  const rows = await Group.aggregate([
    { $match: match },
    { $group: { _id: "$direction", groups: { $sum: 1 }, students: { $sum: "$studentNumber" } } },
  ]);
  const byFaculty = new Map();
  for (const r of rows) {
    const fac = dirFaculty.get(String(r._id)) || UNKNOWN;
    if (!byFaculty.has(fac)) byFaculty.set(fac, { groups: 0, students: 0, directions: new Set() });
    const bucket = byFaculty.get(fac);
    bucket.groups += r.groups;
    bucket.students += r.students ?? 0;
    bucket.directions.add(String(r._id));
  }
  const out = new Map();
  for (const [fac, v] of byFaculty.entries()) {
    out.set(fac, { groups: v.groups, students: v.students, directions: v.directions.size });
  }
  return out;
}

async function oubTeachers(scope, query, scopeLevel) {
  const facultyId = resolveFacultyId(scope, query, scopeLevel);
  const academicYearId = query.academicYear ? new mongoose.Types.ObjectId(query.academicYear) : null;

  const { deptTitle, deptFaculty } = await loadRefMaps();

  const role = await Role.findOne({ title: ROLES.OQITUVCHI }).select("_id").lean();
  const roleId = role?._id ?? null;

  const userMatch = { role: roleId, active: true };
  if (facultyId) userMatch.department = { $in: idsInFaculty(deptFaculty, facultyId) };
  else userMatch.department = { $ne: null };

  const byDeptUsers = await User.aggregate([
    { $match: userMatch },
    { $group: { _id: "$department", teachers: { $sum: 1 } } },
  ]);

  const dsMatch = { active: true };
  if (academicYearId) dsMatch.academicYear = academicYearId;
  if (facultyId) dsMatch.department = { $in: idsInFaculty(deptFaculty, facultyId) };

  const assignedByDept = await Distribution.aggregate([
    { $match: dsMatch },
    { $unwind: "$teachers" },
    { $match: { "teachers.isVacant": false, "teachers.teacher": { $ne: null } } },
    {
      $group: {
        _id: { department: "$department", teacher: "$teachers.teacher" },
        hour: { $sum: "$teachers.totalHour" },
      },
    },
    { $group: { _id: "$_id.department", assigned: { $sum: 1 }, assignedHour: { $sum: "$hour" } } },
  ]);
  const vacancyByDept = await Distribution.aggregate([
    { $match: dsMatch },
    { $unwind: "$teachers" },
    { $match: { "teachers.isVacant": true } },
    { $group: { _id: "$department", count: { $sum: 1 }, hours: { $sum: "$teachers.totalHour" } } },
  ]);

  const assignedMap = new Map(assignedByDept.map((r) => [String(r._id), r]));
  const vacancyMap = new Map(vacancyByDept.map((r) => [String(r._id), r]));

  const byDepartment = byDeptUsers
    .filter((r) => r._id)
    .map((r) => {
      const key = String(r._id);
      const assigned = assignedMap.get(key)?.assigned ?? 0;
      const assignedHour = assignedMap.get(key)?.assignedHour ?? 0;
      const vac = vacancyMap.get(key) ?? { count: 0, hours: 0 };
      return {
        departmentId: r._id,
        department: deptTitle.get(key) ?? null,
        teachers: r.teachers,
        assigned,
        unassigned: Math.max(0, r.teachers - assigned),
        assignedHour,
        vacancies: vac.count,
        vacantHour: vac.hours ?? 0,
      };
    });

  const total = byDepartment.reduce((s, r) => s + r.teachers, 0);
  const assigned = byDepartment.reduce((s, r) => s + r.assigned, 0);
  const unassigned = Math.max(0, total - assigned);
  const unknownFaculty = byDeptUsers.filter((r) => !r._id).reduce((s, r) => s + r.teachers, 0);

  const vacTotal = {
    count: vacancyByDept.reduce((s, r) => s + r.count, 0),
    hours: vacancyByDept.reduce((s, r) => s + (r.hours ?? 0), 0),
  };
  const vacByDeptOut = vacancyByDept.map((r) => ({
    departmentId: r._id,
    department: deptTitle.get(String(r._id)) ?? null,
    count: r.count,
    hours: r.hours ?? 0,
  }));

  return {
    summary: { total, assigned, unassigned, assignedPercent: foiz(assigned, total), unknownFaculty },
    byDepartment,
    vacancies: { ...vacTotal, byDepartment: vacByDeptOut },
  };
}

module.exports = {
  overview,
  oubOverview,
  oubFaculties,
  oubTeachers,
  resolveFacultyId,
  documentsBlock,
};
