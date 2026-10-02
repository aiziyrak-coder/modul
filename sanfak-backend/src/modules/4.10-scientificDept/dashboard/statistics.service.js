const mongoose = require("mongoose");
const { ROLES } = require("#config/constants");
const { resolveUserFacultyId } = require("#shared/userScope");

const Article = require("../article/article.model");
const Thesis = require("../thesis/thesis.model");
const Monograph = require("../monograph/monograph.model");
const Methodical = require("../methodicalRecommendation/methodicalRecommendation.model");
const Patent = require("../patent/patent.model");
const Copyright = require("../copyright/copyright.model");
const Conference = require("../conference/conference.model");
const Defense = require("../defense/defense.model");
const ScientificDegree = require("../scientificDegree/scientificDegree.model");
const ScientificTitle = require("../scientificTitle/scientificTitle.model");
const WorkPlan = require("../departmentWorkPlan/departmentWorkPlan.model");
const AnnualReport = require("../annualReport/annualReport.model");
const EconomicContract = require("../economicContract/economicContract.model");
const HIndexProfile = require("../hIndexProfile/hIndexProfile.model");
const QualifyingApplicant = require("../qualifyingApplicant/qualifyingApplicant.model");
const ExamSpecialty = require("../examSpecialty/examSpecialty.model");

const GLOBAL_ROLES = [
  ROLES.ILMIY_BOLIM,
  ROLES.PROREKTOR,
  ROLES.REKTOR,
  ROLES.ILMIY_KENGASH_KOTIBI,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
];

const scopeFor = (user, authorField) => {
  const role = user.role?.title;
  if (GLOBAL_ROLES.includes(role)) return {};
  if (role === ROLES.OQITUVCHI) {
    return authorField ? { [authorField]: user._id } : { _id: null };
  }
  const deptId = user.department?._id || user.department || null;
  const facultyId = resolveUserFacultyId(user);
  if (role === ROLES.KAFEDRA_MUDIRI) return deptId ? { department: deptId } : { _id: null };
  if (role === ROLES.DEKAN) return facultyId ? { faculty: facultyId } : { _id: null };
  return {};
};

async function statusBlock(Model, scope) {
  const rows = await Model.aggregate([
    { $match: { active: true, ...scope } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const out = { total: 0, new: 0, approved: 0, rejected: 0 };
  rows.forEach((r) => {
    out.total += r.count;
    const key = r._id || "new";
    if (out[key] === undefined) out[key] = 0;
    out[key] += r.count;
  });
  return out;
}

async function groupBy(Model, field, scope) {
  const rows = await Model.aggregate([
    { $match: { active: true, ...scope } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ]);
  return rows.filter((r) => r._id).map((r) => ({ key: String(r._id), count: r.count }));
}

async function nameMap(modelName, projection = { title: 1 }, label = (d) => d.title) {
  const docs = await mongoose.model(modelName).find({}, projection).lean();
  return new Map(docs.map((d) => [String(d._id), label(d)]));
}

async function crossSection(entries, field, user) {
  const out = new Map();
  for (const [name, Model, authorField] of entries) {
    const rows = await groupBy(Model, field, scopeFor(user, authorField));
    rows.forEach((r) => {
      if (!out.has(r.key)) out.set(r.key, {});
      out.get(r.key)[name] = r.count;
    });
  }
  return out;
}

async function topAuthors(user, limit = 10) {
  const models = [Article, Thesis, Monograph, Methodical, Patent, Copyright];
  const tally = new Map();
  for (const Model of models) {
    const rows = await groupBy(Model, "author", scopeFor(user, "author"));
    rows.forEach((r) => tally.set(r.key, (tally.get(r.key) || 0) + r.count));
  }
  const top = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  if (!top.length) return [];

  const users = await mongoose
    .model("user")
    .find({ _id: { $in: top.map(([id]) => id) } }, { firstName: 1, lastName: 1 })
    .lean();
  const nameOf = new Map(
    users.map((u) => [String(u._id), [u.lastName, u.firstName].filter(Boolean).join(" ")]),
  );
  return top.map(([id, count]) => ({ name: nameOf.get(id) || "—", count }));
}

async function getStatistics(user) {
  const ENTITIES = [
    ["article", Article, "author"],
    ["thesis", Thesis, "author"],
    ["monograph", Monograph, "author"],
    ["methodical", Methodical, "author"],
    ["patent", Patent, "author"],
    ["copyright", Copyright, "author"],
    ["defense", Defense, "author"],
    ["degree", ScientificDegree, "author"],
    ["title", ScientificTitle, "author"],
    ["workPlan", WorkPlan, null],
    ["annualReport", AnnualReport, null],
    ["economicContract", EconomicContract, "teacher"],
  ];

  const byType = {};
  for (const [name, Model, authorField] of ENTITIES) {
    byType[name] = await statusBlock(Model, scopeFor(user, authorField));
  }
  byType.conference = await statusBlock(Conference, {});

  const [facultyMap, departmentMap] = await Promise.all([
    nameMap("faculty"),
    nameMap("department"),
  ]);
  const CROSS = [
    ["article", Article, "author"],
    ["thesis", Thesis, "author"],
    ["monograph", Monograph, "author"],
    ["methodical", Methodical, "author"],
    ["patent", Patent, "author"],
    ["copyright", Copyright, "author"],
    ["defense", Defense, "author"],
    ["degree", ScientificDegree, "author"],
    ["title", ScientificTitle, "author"],
    ["workPlan", WorkPlan, null],
    ["annualReport", AnnualReport, null],
    ["economicContract", EconomicContract, "teacher"],
  ];
  const byFacultyMap = await crossSection(CROSS, "faculty", user);
  const byFaculty = [...byFacultyMap.entries()]
    .map(([id, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return { faculty: facultyMap.get(id) || "—", ...counts, total };
    })
    .sort((a, b) => b.total - a.total);

  const byDepartmentMap = await crossSection(CROSS, "department", user);
  const byDepartment = [...byDepartmentMap.entries()]
    .map(([id, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return { department: departmentMap.get(id) || "—", ...counts, total };
    })
    .sort((a, b) => b.total - a.total);

  const SPECIALTY_MODELS = [
    ["defense", Defense],
    ["degree", ScientificDegree],
    ["title", ScientificTitle],
  ];
  const specialtyTally = new Map();
  for (const [name, Model] of SPECIALTY_MODELS) {
    const rows = await groupBy(Model, "specialty", scopeFor(user, "author"));
    rows.forEach((r) => {
      if (!specialtyTally.has(r.key)) specialtyTally.set(r.key, { total: 0 });
      const cell = specialtyTally.get(r.key);
      cell[name] = r.count;
      cell.total += r.count;
    });
  }
  const bySpecialty = [...specialtyTally.entries()]
    .map(([specialty, counts]) => ({ specialty, ...counts }))
    .sort((a, b) => b.total - a.total);

  const methodicalScope = scopeFor(user, "author");
  const specialtyNames = await nameMap("methodicalSpecialty", { code: 1, name: 1 }, (d) =>
    [d.code, d.name].filter(Boolean).join(" — "),
  );
  const bySpecialtyRef = await groupBy(Methodical, "specialty", methodicalScope);
  const byLegacyDirection = await groupBy(Methodical, "direction", methodicalScope);
  const directionTally = new Map();
  for (const r of bySpecialtyRef) {
    const label = specialtyNames.get(r.key) || "—";
    directionTally.set(label, (directionTally.get(label) || 0) + r.count);
  }
  for (const r of byLegacyDirection) {
    directionTally.set(r.key, (directionTally.get(r.key) || 0) + r.count);
  }
  const byDirection = [...directionTally.entries()]
    .map(([direction, total]) => ({ direction, total }))
    .sort((a, b) => b.total - a.total);

  const yearNames = await nameMap("academicYear");
  const byYearMap = await crossSection(CROSS, "academicYear", user);
  const merged = new Map();
  for (const [rawYear, counts] of byYearMap.entries()) {
    const known = yearNames.get(rawYear);
    const orphanId = !known && /^[0-9a-f]{24}$/i.test(rawYear);
    const year = known || (orphanId ? "—" : rawYear);
    if (!merged.has(year)) merged.set(year, {});
    const cell = merged.get(year);
    Object.entries(counts).forEach(([k, v]) => {
      cell[k] = (cell[k] || 0) + v;
    });
  }
  const byYear = [...merged.entries()]
    .map(([year, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return { year, ...counts, total };
    })
    .sort((a, b) => a.year.localeCompare(b.year));

  const hScope = scopeFor(user, "teacher");
  const [hProfiles, hRows] = await Promise.all([
    HIndexProfile.countDocuments({ active: true, ...hScope }),
    HIndexProfile.find(
      { active: true, ...hScope },
      { scopusUrl: 1, scholarUrl: 1, scopusHIndex: 1, scholarHIndex: 1, scopusCitations: 1 },
    ).lean(),
  ]);
  const nums = (arr) => (arr.length ? arr : [0]);
  const scopusVals = hRows.filter((r) => r.scopusUrl).map((r) => r.scopusHIndex || 0);
  const scholarVals = hRows.filter((r) => r.scholarUrl).map((r) => r.scholarHIndex || 0);
  const avg = (a) => Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10;
  const hIndex = {
    profiles: hProfiles,
    scopusLinked: scopusVals.length,
    scholarLinked: scholarVals.length,
    scopusAvg: avg(nums(scopusVals)),
    scopusMax: Math.max(...nums(scopusVals)),
    scholarAvg: avg(nums(scholarVals)),
    scholarMax: Math.max(...nums(scholarVals)),
    citations: hRows.reduce((a, r) => a + (r.scopusCitations || 0), 0),
  };

  const contractScope = scopeFor(user, "teacher");
  const [amountAll, amountApproved] = await Promise.all([
    EconomicContract.aggregate([
      { $match: { active: true, ...contractScope } },
      { $group: { _id: null, sum: { $sum: "$amount" } } },
    ]),
    EconomicContract.aggregate([
      { $match: { active: true, status: "approved", ...contractScope } },
      { $group: { _id: null, sum: { $sum: "$amount" } } },
    ]),
  ]);
  const contracts = {
    count: byType.economicContract.total,
    totalAmount: amountAll[0]?.sum || 0,
    approvedAmount: amountApproved[0]?.sum || 0,
  };

  const examVisible = GLOBAL_ROLES.includes(user.role?.title);
  let exam = { total: 0, bySpecialty: [] };
  if (examVisible) {
    const rows = (await groupBy(QualifyingApplicant, "specialization", {}))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const specs = await ExamSpecialty.find(
      { code: { $in: rows.map((r) => r.key) } },
      { code: 1, name: 1 },
    ).lean();
    const nameOf = new Map(specs.map((sp) => [sp.code, sp.name]));
    exam = {
      ...(await statusBlock(QualifyingApplicant, {})),
      bySpecialty: rows.map((r) => ({
        key: r.key,
        label: nameOf.get(r.key) ? `${r.key} — ${nameOf.get(r.key)}` : r.key,
        count: r.count,
      })),
    };
  }

  return {
    byType,
    byFaculty,
    byDepartment,
    bySpecialty,
    byDirection,
    byYear,
    hIndex,
    contracts,
    exam,
    topAuthors: await topAuthors(user),
  };
}

const DATE_FORMAT = {
  day: "%Y-%m-%d",
  month: "%Y-%m",
  year: "%Y",
};

async function contractsSeries(user, { granularity = "month", from, to } = {}) {
  const fmt = DATE_FORMAT[granularity] || DATE_FORMAT.month;

  const match = { active: true, ...scopeFor(user, "teacher") };
  if (from || to) {
    match.contractDate = {};
    if (from) match.contractDate.$gte = new Date(from);
    if (to) match.contractDate.$lte = new Date(to);
  }

  const rows = await EconomicContract.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: fmt, date: "$contractDate" } },
        count: { $sum: 1 },
        amount: { $sum: "$amount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows
    .filter((r) => r._id)
    .map((r) => ({ period: r._id, count: r.count, amount: r.amount || 0 }));
}

module.exports = { getStatistics, contractsSeries, scopeFor };
