"use strict";

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const WorkloadSummaryModel = require("#modules/4.02-studyLoad/workloadSummary/workloadSummary.model");
const SyllabusModel = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const workloadScope = require("#modules/4.02-studyLoad/workload/workload.scope");
const workloadDistributionScope = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.scope");
const syllabusScope = require("#modules/4.02-studyLoad/syllabus/syllabus.scope");
const { ROLES } = require("#config/constants");

const ACTIVE_STATUSES = ["in_review", "approved"];

const DEPENDENT_SCOPE = {
  workload: workloadScope(),
  workloadDistribution: workloadDistributionScope({ bypassRoles: [ROLES.REJA_MOLIYA] }),
  syllabus: syllabusScope(),
  workloadSummary: null,
};

function scopeFor(type, user) {
  if (!user || !(type in DEPENDENT_SCOPE)) return Promise.resolve(null);
  const mw = DEPENDENT_SCOPE[type];
  if (!mw || user.role?.title === ROLES.SUPER_ADMIN) return Promise.resolve({});
  return new Promise((resolve) => {
    const req = { user };
    mw(req, {}, (err) => resolve(err ? null : req.scope || {}));
  });
}

async function visibleIds(src, rows, scope) {
  if (!scope) return new Set();
  if (Object.keys(scope).length === 0) return new Set(rows.map((d) => String(d._id)));
  const inScope = await src.Model.find({
    $and: [{ _id: { $in: rows.map((d) => d._id) } }, scope],
  })
    .select("_id")
    .lean();
  return new Set(inScope.map((d) => String(d._id)));
}

function describeRows(src, rows, visible) {
  const shown = rows.filter((d) => visible.has(String(d._id)));
  const items = shown.map((d) => ({
    type: src.type,
    id: String(d._id),
    title: src.titleOf(d) || null,
    status: d.status,
  }));
  const hidden = rows.length - shown.length;
  if (hidden > 0) items.push({ type: src.type, count: hidden, hidden: true });
  return items;
}

async function planIdsOfSchedule(scheduleId) {
  const plans = await WorkingPlanModel.find({ workingSchedule: scheduleId })
    .select("_id")
    .lean();
  return plans.map((p) => p._id);
}

const SOURCES = {
  async workingSchedule(doc) {
    const planIds = await planIdsOfSchedule(doc._id);
    if (planIds.length === 0) return [];
    return [
      {
        type: "workload",
        Model: WorkloadModel,
        filter: { "directions.workingPlan": { $in: planIds } },
        titleOf: (d) => d.title,
        stale: true,
      },
    ];
  },
  async workload(doc) {
    return [
      {
        type: "workloadDistribution",
        Model: WorkloadDistributionModel,
        filter: { workload: doc._id },
        titleOf: (d) => d.title,
        stale: true,
      },
      {
        type: "workloadSummary",
        Model: WorkloadSummaryModel,
        filter: { "includedWorkloads.workload": doc._id },
        titleOf: (d) => d.academicYearTitle,
        stale: false,
      },
    ];
  },
  async scienceProgram(doc) {
    return [
      {
        type: "syllabus",
        Model: SyllabusModel,
        filter: { scienceProgram: doc._id },
        titleOf: (d) => d.scienceLabel || d.label,
        stale: false,
      },
    ];
  },
};

const sourcesOf = async (entity, doc) =>
  SOURCES[entity] ? SOURCES[entity](doc) : [];

async function findActiveDependents(entity, doc, user) {
  const out = [];
  for (const src of await sourcesOf(entity, doc)) {
    const rows = await src.Model.find({
      ...src.filter,
      status: { $in: ACTIVE_STATUSES },
      active: { $ne: false },
    })
      .select("_id status title academicYearTitle scienceLabel label")
      .lean();
    if (rows.length === 0) continue;
    const visible = await visibleIds(src, rows, await scopeFor(src.type, user));
    out.push(...describeRows(src, rows, visible));
  }
  return out;
}

const NOT_STALE_STATUSES = [...ACTIVE_STATUSES, "superseded"];

async function markInactiveDependentsStale(entity, doc) {
  let marked = 0;
  for (const src of await sourcesOf(entity, doc)) {
    if (!src.stale) continue;
    const r = await src.Model.updateMany(
      {
        ...src.filter,
        status: { $nin: NOT_STALE_STATUSES },
        active: { $ne: false },
      },
      { $set: { needsRecalculation: true } },
    );
    marked += r?.modifiedCount || 0;
  }
  return marked;
}

module.exports = {
  ACTIVE_STATUSES,
  findActiveDependents,
  markInactiveDependentsStale,
};
