const { ROLES } = require("#config/constants");
const { resolveUserFacultyId } = require("#shared/userScope");

const Article = require("../article/article.model");
const Thesis = require("../thesis/thesis.model");
const Methodical = require("../methodicalRecommendation/methodicalRecommendation.model");
const Monograph = require("../monograph/monograph.model");
const WorkPlan = require("../departmentWorkPlan/departmentWorkPlan.model");
const AnnualReport = require("../annualReport/annualReport.model");
const Conference = require("../conference/conference.model");
const EconomicContract = require("../economicContract/economicContract.model");
const HIndexProfile = require("../hIndexProfile/hIndexProfile.model");
const ScientificDegree = require("../scientificDegree/scientificDegree.model");
const ScientificTitle = require("../scientificTitle/scientificTitle.model");
const Patent = require("../patent/patent.model");
const Copyright = require("../copyright/copyright.model");

const roleOf = (user) => user.role?.title;

const GLOBAL_ROLES = [
  ROLES.ILMIY_BOLIM,
  ROLES.PROREKTOR,
  ROLES.REKTOR,
  ROLES.ILMIY_KENGASH_KOTIBI,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
];

const scopeFor = (user, authorField) => {
  const role = roleOf(user);
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

const statusCounts = async (Model, scope, statuses) => {
  const out = { total: 0 };
  statuses.forEach((s) => (out[s] = 0));
  if (scope._id === null) return out;
  const rows = await Model.aggregate([
    { $match: { active: true, ...scope } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  rows.forEach((r) => {
    out.total += r.n;
    if (r._id && statuses.includes(r._id)) out[r._id] = r.n;
  });
  return out;
};

const plainCount = async (Model, scope) => {
  if (scope._id === null) return 0;
  return Model.countDocuments({ active: true, ...scope });
};

const recentArticlesFor = async (user) => {
  const scope = scopeFor(user, "author");
  if (scope._id === null) return [];
  return Article.find({ active: true, ...scope })
    .sort({ createdAt: -1 })
    .limit(6)
    .populate([
      { path: "author", select: "firstName lastName" },
      { path: "department", select: "title" },
      { path: "faculty", select: "title" },
      { path: "journal", select: "name type" },
    ])
    .lean();
};

async function getStats(user) {
  const WORK = ["new", "pending", "approved", "rejected"];

  const [article, thesis, methodical, monograph, workPlan, annualReport, economicContract] =
    await Promise.all([
      statusCounts(Article, scopeFor(user, "author"), WORK),
      statusCounts(Thesis, scopeFor(user, "author"), WORK),
      statusCounts(Methodical, scopeFor(user, "author"), WORK),
      statusCounts(Monograph, scopeFor(user, "author"), WORK),
      statusCounts(WorkPlan, scopeFor(user, null), WORK),
      statusCounts(AnnualReport, scopeFor(user, null), WORK),
      statusCounts(EconomicContract, scopeFor(user, "teacher"), ["new", "approved", "rejected"]),
    ]);

  const [conferenceTotal, hIndexTotal, reportTotal] = await Promise.all([
    Conference.countDocuments({ active: true }),
    plainCount(HIndexProfile, scopeFor(user, "teacher")),
    Promise.all([
      ScientificDegree.countDocuments({ active: true }),
      ScientificTitle.countDocuments({ active: true }),
      Patent.countDocuments({ active: true }),
      Copyright.countDocuments({ active: true }),
    ]).then((c) => c.reduce((a, b) => a + b, 0)),
  ]);

  const recentArticles = await recentArticlesFor(user);

  const role = roleOf(user);
  let signaturePending = 0;
  let methodicalSignPending = 0;
  let monographSignPending = 0;
  let approvalPending = 0;

  if (role === ROLES.ILMIY_KENGASH_KOTIBI) {
    const [m, mo] = await Promise.all([
      Methodical.countDocuments({
        active: true,
        ilmiyApprovedAt: { $ne: null },
        kotibSignedAt: null,
        status: { $ne: "rejected" },
      }),
      Monograph.countDocuments({
        active: true,
        ilmiyApprovedAt: { $ne: null },
        kotibSignedAt: null,
        status: { $ne: "rejected" },
      }),
    ]);
    methodicalSignPending = m;
    monographSignPending = mo;
    signaturePending = m + mo;
  } else if (role === ROLES.REKTOR) {
    signaturePending = await Methodical.countDocuments({
      active: true,
      kotibSignedAt: { $ne: null },
      rektorSignedAt: null,
      status: { $ne: "rejected" },
    });
  } else if (role === ROLES.PROREKTOR) {
    signaturePending = await Monograph.countDocuments({
      active: true,
      kotibSignedAt: { $ne: null },
      prorektorSignedAt: null,
      status: { $ne: "rejected" },
    });
  } else if (role === ROLES.DEKAN) {
    const facScope = scopeFor(user, null);
    if (facScope._id !== null) {
      const [wp, ar] = await Promise.all([
        WorkPlan.countDocuments({
          active: true,
          ...facScope,
          dekanApprovedAt: null,
          status: { $in: ["new", "pending"] },
        }),
        AnnualReport.countDocuments({
          active: true,
          ...facScope,
          dekanApprovedAt: null,
          status: { $in: ["new", "pending"] },
        }),
      ]);
      approvalPending = wp + ar;
    }
  }

  return {
    role: role || null,
    article,
    thesis,
    methodical,
    monograph,
    workPlan,
    annualReport,
    economicContract,
    conference: { total: conferenceTotal },
    hIndex: { total: hIndexTotal },
    reportTotal,
    signaturePending,
    methodicalSignPending,
    monographSignPending,
    approvalPending,
    recentArticles,
  };
}

module.exports = { getStats, scopeFor };
