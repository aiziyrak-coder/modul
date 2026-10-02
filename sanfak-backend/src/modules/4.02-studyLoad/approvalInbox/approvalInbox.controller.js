"use strict";

const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const { ROLES } = require("#config/constants");
const {
  CHAIN_REGISTRY,
} = require("#modules/4.02-studyLoad/_shared/chainRegistry");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const workloadScope = require("#modules/4.02-studyLoad/workload/workload.scope");
const {
  workloadTotalHours,
} = require("#modules/4.02-studyLoad/_shared/workloadTotals");

const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const workloadDistributionScope = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.scope");

const ScienceProgramModel = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const scienceProgramScope = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.scope");

const SyllabusModel = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const syllabusScope = require("#modules/4.02-studyLoad/syllabus/syllabus.scope");

const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const workingScheduleScope = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.scope");
const { workingPlanTotalHoursBySchedule } = require("./approvalInbox.workingPlanTotals");

const WorkloadSummaryModel = require("#modules/4.02-studyLoad/workloadSummary/workloadSummary.model");
const workloadSummaryScope = () => (req, _res, next) => {
  req.scope = {};
  next();
};

const ContingentReportModel = require("#modules/4.02-studyLoad/contingentReport/contingentReport.model");
const contingentReportScope = require("#modules/4.02-studyLoad/contingentReport/contingentReport.scope");

require("#references/academicYear/academicYear.model");
require("#references/department/department.model");
require("#references/direction/direction.model");

const runScope = (mw, user) =>
  new Promise((resolve, reject) => {
    const shim = { user };
    mw(shim, {}, (err) => (err ? reject(err) : resolve(shim.scope || {})));
  });

function getPath(obj, path) {
  if (!path || !obj) return null;
  const value = path
    .split(".")
    .reduce(
      (acc, key) => (acc === null || acc === undefined ? acc : acc[key]),
      obj,
    );
  return value === undefined ? null : value;
}

function refToPlain(ref) {
  if (!ref || !ref._id) return null;
  return { _id: String(ref._id), title: ref.title ?? null };
}

const ENTITIES = [
  {
    key: "workload",
    Model: WorkloadModel,
    scope: workloadScope(),
    stepsField: CHAIN_REGISTRY.workload.stepsField,
    titleField: "title",
    hasDepartment: true,
    hasAcademicYear: true,
    totalHourPath: null,
    totalHourSelect: "directions",
    totalHourFn: workloadTotalHours,
    stepRoles: CHAIN_REGISTRY.workload.stepRoles,
  },
  {
    key: "distribution",
    Model: WorkloadDistributionModel,
    scope: workloadDistributionScope(),
    stepsField: CHAIN_REGISTRY.workloadDistribution.stepsField,
    titleField: "title",
    hasDepartment: true,
    hasAcademicYear: true,
    totalHourPath: "totalHour",
    stepRoles: CHAIN_REGISTRY.workloadDistribution.stepRoles,
  },
  {
    key: "scienceProgram",
    Model: ScienceProgramModel,
    scope: scienceProgramScope(),
    stepsField: CHAIN_REGISTRY.scienceProgram.stepsField,
    titleField: "title",
    hasDepartment: false,
    hasAcademicYear: true,
    totalHourPath: "totalHours",
    stepRoles: CHAIN_REGISTRY.scienceProgram.stepRoles,
  },
  {
    key: "syllabus",
    Model: SyllabusModel,
    scope: syllabusScope(),
    stepsField: CHAIN_REGISTRY.syllabus.stepsField,
    titleField: "title",
    hasDepartment: false,
    hasAcademicYear: false,
    totalHourPath: "hoursByType.totalHours",
    submittedAtField: "submittedAt",
    stepRoles: CHAIN_REGISTRY.syllabus.stepRoles,
  },
  {
    key: "workingSchedule",
    Model: WorkingScheduleModel,
    scope: workingScheduleScope(),
    stepsField: CHAIN_REGISTRY.workingSchedule.stepsField,
    titleField: "title",
    hasDepartment: false,
    departmentRefField: "direction",
    hasAcademicYear: true,
    totalHourPath: null,
    totalHourBatch: workingPlanTotalHoursBySchedule,
    stepRoles: CHAIN_REGISTRY.workingSchedule.stepRoles,
  },
  {
    key: "workloadSummary",
    Model: WorkloadSummaryModel,
    scope: workloadSummaryScope(),
    stepsField: CHAIN_REGISTRY.workloadSummary.stepsField,
    titleField: "academicYearTitle",
    hasDepartment: false,
    hasAcademicYear: true,
    totalHourPath: "snapshot.totals.total",
    stepRoles: CHAIN_REGISTRY.workloadSummary.stepRoles,
  },
  {
    key: "contingentReport",
    Model: ContingentReportModel,
    scope: contingentReportScope(),
    stepsField: CHAIN_REGISTRY.contingentReport.stepsField,
    titleField: "facultyTitle",
    hasDepartment: false,
    hasAcademicYear: true,
    totalHourPath: null,
    submittedAtField: "submittedAt",
    stepRoles: CHAIN_REGISTRY.contingentReport.stepRoles,
  },
];

const ENTITY_KEYS = ENTITIES.map((e) => e.key);

function buildSelect(entity) {
  const fields = ["_id", entity.titleField, entity.stepsField, "updatedAt"];
  if (entity.hasDepartment) fields.push("department");
  if (entity.departmentRefField) fields.push(entity.departmentRefField);
  if (entity.hasAcademicYear) fields.push("academicYear");
  if (entity.totalHourPath) fields.push(entity.totalHourPath.split(".")[0]);
  if (entity.totalHourSelect) fields.push(entity.totalHourSelect);
  if (entity.submittedAtField) fields.push(entity.submittedAtField);
  return fields.join(" ");
}

function departmentOf(entity, doc) {
  if (entity.hasDepartment) return refToPlain(doc.department);
  if (entity.departmentRefField) return refToPlain(doc[entity.departmentRefField]);
  return null;
}

async function applyTotalHourBatch(entity, results) {
  if (!entity.totalHourBatch || !results.length) return;
  const byId = await entity.totalHourBatch(results.map((r) => r.id));
  for (const r of results) r.totalHour = byId.get(r.id) ?? null;
}

async function collectEntityInbox(entity, req, isSuper) {
  const userRole = req.user?.role?.title;
  const myStepKeys = Object.keys(entity.stepRoles).filter(
    (step) => entity.stepRoles[step] === userRole,
  );

  if (!isSuper && myStepKeys.length === 0) return [];

  const scopeFilter = await runScope(entity.scope, req.user);

  const filter = { status: "in_review", active: true, ...scopeFilter };
  if (!isSuper) {
    filter[entity.stepsField] = {
      $elemMatch: { step: { $in: myStepKeys }, status: "pending" },
    };
  }

  let query = entity.Model.find(filter).select(buildSelect(entity));
  if (entity.hasDepartment) query = query.populate("department", "title");
  if (entity.departmentRefField) {
    query = query.populate(entity.departmentRefField, "title");
  }
  if (entity.hasAcademicYear) query = query.populate("academicYear", "title");

  const docs = await query.lean().exec();

  const results = [];
  for (const doc of docs) {
    const steps = doc[entity.stepsField] || [];
    const current = steps.find((s) => s.status === "pending");
    if (!current) continue;

    if (!isSuper && !myStepKeys.includes(current.step)) continue;

    const firstStep = steps[0];
    const ownSubmittedAt = entity.submittedAtField
      ? doc[entity.submittedAtField]
      : null;
    const submittedAt =
      ownSubmittedAt || (firstStep && firstStep.date) || doc.updatedAt || null;

    results.push({
      entity: entity.key,
      id: String(doc._id),
      title: doc[entity.titleField] || null,
      step: current.step,
      department: departmentOf(entity, doc),
      academicYear: entity.hasAcademicYear ? refToPlain(doc.academicYear) : null,
      submittedAt,
      totalHour: entity.totalHourFn
        ? entity.totalHourFn(doc) ?? null
        : entity.totalHourPath
          ? getPath(doc, entity.totalHourPath) ?? null
          : null,
    });
  }
  await applyTotalHourBatch(entity, results);
  return results;
}

module.exports = {
  ENTITY_KEYS,

  list: async (req, res, next) => {
    try {
      const { entity: entityFilter } = req.query || {};
      if (entityFilter && !ENTITY_KEYS.includes(entityFilter)) {
        return next(
          new ErrorHandler(
            400,
            `Noma'lum entity: "${entityFilter}"`,
            `Ruxsat etilgan: ${ENTITY_KEYS.join(", ")}`,
          ),
        );
      }

      const isSuper = req.user?.role?.title === ROLES.SUPER_ADMIN;
      const targets = entityFilter
        ? ENTITIES.filter((e) => e.key === entityFilter)
        : ENTITIES;

      const perEntity = await Promise.all(
        targets.map((entity) => collectEntityInbox(entity, req, isSuper)),
      );

      const items = perEntity
        .flat()
        .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

      return res.status(200).json(items);
    } catch (err) {
      winston.error(`approvalInbox.list xatosi: ${err.message}`);
      return next(
        new ErrorHandler(500, "Tasdiqlash panelini yuklashda xatolik", err.message),
      );
    }
  },
};
