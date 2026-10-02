const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const AttestationResult = require("#modules/4.05-residency/residencyAttestation/residencyAttestationResult.model");
const DailyLog = require("#modules/4.05-residency/dailyLog/dailyLog.model");
const {
  applyAcademicYearFilter,
} = require("#modules/4.05-residency/_services/academicYearFilter");

const scoreMatch = (ids) => ({
  resident: { $in: ids },
  active: true,
  included: true,
  score: { $ne: null },
});

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

function academicYearRange(academicYear, now = new Date()) {
  const m = /^(\d{4})[-/](\d{4})$/.exec(String(academicYear || "").trim());
  if (m) {
    return {
      from: new Date(Date.UTC(Number(m[1]), 8, 1)),
      to: new Date(Date.UTC(Number(m[2]), 7, 31, 23, 59, 59)),
    };
  }
  const to = now;
  const from = new Date(now.getTime());
  from.setUTCMonth(from.getUTCMonth() - 11);
  from.setUTCDate(1);
  return { from, to };
}

function attendanceDateMatch(query) {
  const title = query.academicYearTitle || query.academicYear;
  if (!/^(\d{4})[-/](\d{4})$/.test(String(title || "").trim())) return {};
  const { from, to } = academicYearRange(title);
  return { date: { $gte: from, $lte: to } };
}

function residentFilter({ academicYear, specialty, program }) {
  const f = { active: true, deletedAt: null };
  applyAcademicYearFilter(f, academicYear);
  if (specialty) f.specialty = specialty;
  if (program) f.program = program;
  return f;
}

async function summary(query) {
  const residents = await Resident.find(residentFilter(query))
    .select("program fundingType specialty specialtyTitle")
    .lean();

  const ids = residents.map((r) => r._id);
  const magistrants = residents.filter((r) => r.program === "magistratura").length;
  const rezidentlar = residents.filter((r) => r.program === "ordinatura").length;
  const byudjet = residents.filter((r) => r.fundingType === "byudjet").length;
  const shartnoma = residents.filter((r) => r.fundingType === "shartnoma").length;

  const dateMatch = attendanceDateMatch(query);

  const [att] = ids.length
    ? await Attendance.aggregate([
        { $match: { resident: { $in: ids }, ...dateMatch } },
        {
          $group: {
            _id: null,
            present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
            excused: { $sum: { $cond: [{ $eq: ["$status", "excused"] }, 1, 0] } },
          },
        },
      ])
    : [];

  const [asm] = ids.length
    ? await AttestationResult.aggregate([
        { $match: scoreMatch(ids) },
        { $group: { _id: null, avgScore: { $avg: "$score" }, completed: { $sum: 1 } } },
      ])
    : [];

  const total = (att?.present || 0) + (att?.absent || 0) + (att?.excused || 0);
  const avgAttendance = total ? Number(((att.present / total) * 100).toFixed(1)) : 0;

  return {
    totalStudents: residents.length,
    magistrants,
    rezidentlar,
    byudjet,
    shartnoma,
    avgAttendance,
    avgScore: asm?.avgScore != null ? Number(asm.avgScore.toFixed(1)) : 0,
    completedAssessments: asm?.completed || 0,
  };
}

async function attendanceMonthly(query) {
  const ids = await Resident.find(residentFilter(query)).distinct("_id");
  const dateMatch = attendanceDateMatch(query);
  if (!ids.length) return [];

  const rows = await Attendance.aggregate([
    { $match: { resident: { $in: ids }, ...dateMatch } },
    {
      $group: {
        _id: { y: { $year: "$date" }, m: { $month: "$date" } },
        present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
        excused: { $sum: { $cond: [{ $eq: ["$status", "excused"] }, 1, 0] } },
      },
    },
    { $sort: { "_id.y": 1, "_id.m": 1 } },
  ]);

  return rows.map((r) => {
    const total = r.present + r.absent + r.excused;
    return {
      year: r._id.y,
      month: r._id.m,
      label: MONTHS[r._id.m - 1],
      present: r.present,
      absent: r.absent,
      excused: r.excused,
      percent: total ? Number(((r.present / total) * 100).toFixed(1)) : 0,
    };
  });
}

async function attendanceBreakdown(query) {
  const ids = await Resident.find(residentFilter(query)).distinct("_id");
  const dateMatch = attendanceDateMatch(query);
  if (!ids.length) {
    return { present: 0, absent: 0, excused: 0, total: 0, late: 0, avgLateMinutes: 0 };
  }

  const [row] = await Attendance.aggregate([
    { $match: { resident: { $in: ids }, ...dateMatch } },
    {
      $group: {
        _id: null,
        present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
        excused: { $sum: { $cond: [{ $eq: ["$status", "excused"] }, 1, 0] } },
        late: { $sum: { $cond: ["$late", 1, 0] } },
        lateMinutesSum: {
          $sum: { $cond: [{ $gt: ["$lateMinutes", null] }, "$lateMinutes", 0] },
        },
        lateWithMinutes: {
          $sum: { $cond: [{ $gt: ["$lateMinutes", null] }, 1, 0] },
        },
      },
    },
  ]);
  const present = row?.present || 0;
  const absent = row?.absent || 0;
  const excused = row?.excused || 0;
  const late = row?.late || 0;
  const withMinutes = row?.lateWithMinutes || 0;
  return {
    present,
    absent,
    excused,
    total: present + absent + excused,
    late,
    avgLateMinutes: withMinutes
      ? Number(((row?.lateMinutesSum || 0) / withMinutes).toFixed(1))
      : 0,
  };
}

async function specialtyDistribution(query) {
  const rows = await Resident.aggregate([
    { $match: residentFilter(query) },
    {
      $group: {
        _id: "$specialty",
        title: { $first: "$specialtyTitle" },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);
  return rows.map((r) => ({
    specialtyId: r._id,
    title: r.title || "Belgilanmagan",
    count: r.count,
  }));
}

async function fundingDistribution(query) {
  const rows = await Resident.aggregate([
    { $match: residentFilter(query) },
    { $group: { _id: "$fundingType", count: { $sum: 1 } } },
  ]);
  const get = (k) => rows.find((r) => r._id === k)?.count || 0;
  return { byudjet: get("byudjet"), shartnoma: get("shartnoma") };
}

async function scoreByScience(query) {
  const ids = await Resident.find(residentFilter(query)).distinct("_id");
  if (!ids.length) return [];

  const rows = await AttestationResult.aggregate([
    { $match: scoreMatch(ids) },
    {
      $lookup: {
        from: "residencyattestations",
        localField: "attestation",
        foreignField: "_id",
        as: "att",
      },
    },
    { $unwind: "$att" },
    {
      $group: {
        _id: "$att.scienceTitle",
        avgScore: { $avg: "$score" },
        count: { $sum: 1 },
      },
    },
    { $sort: { avgScore: -1 } },
  ]);

  return rows.map((r) => ({
    scienceId: null,
    title: r._id || "Belgilanmagan",
    avgScore: Number((r.avgScore || 0).toFixed(1)),
    count: r.count,
  }));
}

async function scoreDistribution(query) {
  const ids = await Resident.find(residentFilter(query)).distinct("_id");
  if (!ids.length) return { alo: 0, yaxshi: 0, qoniqarli: 0, qoniqarsiz: 0 };

  const [row] = await AttestationResult.aggregate([
    { $match: scoreMatch(ids) },
    {
      $group: {
        _id: null,
        alo: { $sum: { $cond: [{ $gte: ["$score", 86] }, 1, 0] } },
        yaxshi: {
          $sum: {
            $cond: [{ $and: [{ $gte: ["$score", 71] }, { $lt: ["$score", 86] }] }, 1, 0],
          },
        },
        qoniqarli: {
          $sum: {
            $cond: [{ $and: [{ $gte: ["$score", 56] }, { $lt: ["$score", 71] }] }, 1, 0],
          },
        },
        qoniqarsiz: { $sum: { $cond: [{ $lt: ["$score", 56] }, 1, 0] } },
      },
    },
  ]);
  return {
    alo: row?.alo || 0,
    yaxshi: row?.yaxshi || 0,
    qoniqarli: row?.qoniqarli || 0,
    qoniqarsiz: row?.qoniqarsiz || 0,
  };
}

async function studyPeriodDistribution(query) {
  const rows = await Resident.aggregate([
    { $match: residentFilter(query) },
    { $group: { _id: "$studyPeriod", count: { $sum: 1 } } },
  ]);

  const known = rows
    .filter((r) => typeof r._id === "number" && Number.isFinite(r._id))
    .map((r) => ({ years: r._id, title: `${r._id} yil`, count: r.count }))
    .sort((a, b) => a.years - b.years);

  const unknown = rows
    .filter((r) => typeof r._id !== "number" || !Number.isFinite(r._id))
    .reduce((n, r) => n + r.count, 0);

  if (unknown) known.push({ years: null, title: "Belgilanmagan", count: unknown });
  return known;
}

async function clinicalActivity(query) {
  const ids = await Resident.find(residentFilter(query)).distinct("_id");
  const empty = {
    total: 0,
    byStatus: { kutilmoqda: 0, tasdiqlangan: 0, qaytarilgan: 0 },
    activeResidents: 0,
    silentResidents: 0,
    avgPerResident: 0,
  };
  if (!ids.length) return empty;

  const [rows, writers] = await Promise.all([
    DailyLog.aggregate([
      { $match: { resident: { $in: ids } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    DailyLog.distinct("resident", { resident: { $in: ids } }),
  ]);

  const byStatus = { ...empty.byStatus };
  let total = 0;
  for (const r of rows) {
    total += r.n;
    if (Object.hasOwn(byStatus, r._id)) byStatus[r._id] = r.n;
  }

  return {
    total,
    byStatus,
    activeResidents: writers.length,
    silentResidents: ids.length - writers.length,
    avgPerResident: ids.length ? Number((total / ids.length).toFixed(1)) : 0,
  };
}

async function supervisorWorkload(query) {
  const rows = await Resident.aggregate([
    { $match: { ...residentFilter(query), supervisor: { $ne: null } } },
    {
      $group: {
        _id: "$supervisor",
        name: { $first: "$supervisorName" },
        total: { $sum: 1 },
        magistratura: {
          $sum: { $cond: [{ $eq: ["$program", "magistratura"] }, 1, 0] },
        },
        ordinatura: {
          $sum: { $cond: [{ $eq: ["$program", "ordinatura"] }, 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        let: { uid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
          { $project: { _id: 0, firstName: 1, lastName: 1, middleName: 1 } },
        ],
        as: "u",
      },
    },
    { $sort: { total: -1 } },
  ]);

  return rows.map((r) => {
    const u = r.u?.[0];
    const fromAccount = u
      ? [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ")
      : "";
    return {
      supervisorId: String(r._id),
      name: fromAccount || r.name || "Noma'lum",
      total: r.total,
      magistratura: r.magistratura,
      ordinatura: r.ordinatura,
    };
  });
}

async function fullReport(query) {
  const [
    summaryData,
    monthly,
    breakdown,
    specialties,
    funding,
    byScience,
    distribution,
    studyPeriods,
    clinical,
    supervisors,
  ] = await Promise.all([
    summary(query),
    attendanceMonthly(query),
    attendanceBreakdown(query),
    specialtyDistribution(query),
    fundingDistribution(query),
    scoreByScience(query),
    scoreDistribution(query),
    studyPeriodDistribution(query),
    clinicalActivity(query),
    supervisorWorkload(query),
  ]);

  return {
    summary: summaryData,
    attendanceMonthly: monthly,
    attendanceBreakdown: breakdown,
    specialtyDistribution: specialties,
    fundingDistribution: funding,
    scoreByScience: byScience,
    scoreDistribution: distribution,
    studyPeriodDistribution: studyPeriods,
    clinicalActivity: clinical,
    supervisorWorkload: supervisors,
  };
}

module.exports = {
  fullReport,
  summary,
  attendanceMonthly,
  attendanceBreakdown,
  specialtyDistribution,
  fundingDistribution,
  scoreByScience,
  scoreDistribution,
  studyPeriodDistribution,
  clinicalActivity,
  supervisorWorkload,
  academicYearRange,
  attendanceDateMatch,
};
