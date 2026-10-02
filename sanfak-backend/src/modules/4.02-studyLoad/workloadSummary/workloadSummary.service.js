"use strict";

const WorkloadSummary = require("./workloadSummary.model");
const { ErrorHandler } = require("#shared/error");
const { PAGINATION } = require("#config/constants");
const DepartmentModel = require("#references/department/department.model");
const workloadService = require("#modules/4.02-studyLoad/workload/workload.service");
const {
  buildChainVisibilityFilter,
  andFilters,
  VISIBILITY_BYPASS,
} = require("#modules/4.02-studyLoad/_shared/chainVisibility");
const { CHAIN_REGISTRY } = require("#modules/4.02-studyLoad/_shared/chainRegistry");
const { revoke } = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const {
  buildSummaryRows,
  sumRows,
} = require("#modules/4.02-studyLoad/_excel/workloadSummary.xlsx");

const EXCLUDE = { __v: 0 };

async function buildSnapshot(academicYearId) {
  const docs = await workloadService.loadSummaryWorkloads({
    academicYear: academicYearId,
  });
  const rows = buildSummaryRows(docs);
  const totals = sumRows(rows);

  const covered = new Set(rows.map((r) => String(r.departmentId)));
  const departments = await DepartmentModel.find({ active: true }, { title: 1 })
    .lean()
    .exec();
  const missingDepartments = departments
    .filter((d) => !covered.has(String(d._id)))
    .map((d) => d.title)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "uz"));

  const includedWorkloads = docs.map((w) => ({
    workload: w._id,
    updatedAt: w.updatedAt || null,
  }));

  return {
    snapshot: {
      rows,
      totals,
      rowCount: rows.length,
      generatedAt: new Date(),
      missingDepartments,
    },
    includedWorkloads,
    workloadCount: docs.length,
    duplicateDepartments: findDuplicateDepartments(docs),
  };
}

function findDuplicateDepartments(docs) {
  const byDepartment = new Map();
  for (const w of docs) {
    const id = String(w.department?._id || w.department);
    if (!byDepartment.has(id)) {
      byDepartment.set(id, { department: id, title: w.department?.title || "", workloads: [] });
    }
    byDepartment.get(id).workloads.push(String(w._id));
  }
  return [...byDepartment.values()].filter((d) => d.workloads.length > 1);
}

async function createSummary({ academicYearId, academicYearTitle, userId }) {
  const built = await buildSnapshot(academicYearId);

  if (built.workloadCount === 0) {
    throw new ErrorHandler(
      409,
      `${academicYearTitle || "Tanlangan"} o'quv yilida tasdiqlangan yuklama topilmadi`,
      "Hisobot faqat tasdiqlangan yuklamalardan tuziladi.",
    );
  }

  if (built.duplicateDepartments.length > 0) {
    throw new ErrorHandler(
      409,
      `${built.duplicateDepartments.length} ta kafedrada bir o'quv yili uchun bir nechta tasdiqlangan yuklama bor — hisobot tuzilmaydi`,
      built.duplicateDepartments.map((d) => d.title || d.department).join("; "),
      { reason: "duplicate_approved_workloads", departments: built.duplicateDepartments },
    );
  }

  const doc = new WorkloadSummary({
    academicYear: academicYearId,
    academicYearTitle: academicYearTitle || "",
    snapshot: built.snapshot,
    includedWorkloads: built.includedWorkloads,
    createdBy: userId || null,
  });
  return doc.save();
}

async function computeStaleness(doc) {
  if (!doc) return null;
  const built = await workloadService.loadSummaryWorkloads({
    academicYear: doc.academicYear?._id || doc.academicYear,
  });

  const before = new Map(
    (doc.includedWorkloads || []).map((w) => [
      String(w.workload?._id || w.workload),
      w.updatedAt ? new Date(w.updatedAt).getTime() : 0,
    ]),
  );

  let added = 0;
  let changed = 0;
  for (const w of built) {
    const key = String(w._id);
    if (!before.has(key)) {
      added += 1;
      continue;
    }
    const then = before.get(key);
    const now = w.updatedAt ? new Date(w.updatedAt).getTime() : 0;
    if (now > then) changed += 1;
  }
  const removed = [...before.keys()].filter(
    (id) => !built.some((w) => String(w._id) === id),
  ).length;

  return {
    isStale: added + changed + removed > 0,
    added,
    changed,
    removed,
  };
}

async function assertFreshForFinalApproval(doc) {
  const st = await computeStaleness(doc);
  if (!st?.isStale) return;
  throw new ErrorHandler(
    409,
    "Hisobot eskirgan — tuzilgandan keyin manba yuklamalar o'zgargan " +
      `(yangi: ${st.added}, o'zgargan: ${st.changed}, olib tashlangan: ${st.removed}). ` +
      "Yakuniy tasdiqlab bo'lmaydi: hisobotni rad eting va yangi hisobot tuzing.",
  );
}

const ENTITY_KEY = "workloadSummary";

function visibilityFor({ userRole, userId } = {}) {
  const chain = buildChainVisibilityFilter(ENTITY_KEY, userRole, { userId });
  const seesDrafts =
    VISIBILITY_BYPASS.includes(userRole) || userRole === STEP_ROLES.methodical;
  if (seesDrafts) return chain;
  return andFilters(chain, {
    status: { $nin: CHAIN_REGISTRY[ENTITY_KEY].draftStatuses },
  });
}

function readFilter(id, viewer) {
  const filter = andFilters({ _id: id }, visibilityFor(viewer));
  filter.active = true;
  return filter;
}

const filterFrom = (query, viewer) => {
  const requested = {};
  if (query.academicYear) requested.academicYear = query.academicYear;
  if (query.status) requested.status = query.status;
  const filter = andFilters(requested, visibilityFor(viewer));
  filter.active = true;
  return filter;
};

async function paginateSummaries(query, viewer) {
  return WorkloadSummary.paginate(filterFrom(query, viewer), {
    page: Math.max(parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE, 1),
    limit: Math.min(
      parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT,
    ),
    select: { "snapshot.rows": 0, includedWorkloads: 0, __v: 0 },
    populate: [{ path: "academicYear", select: "name title" }],
    sort: { createdAt: -1 },
    lean: true,
  });
}

async function findSummaryById(id, viewer) {
  return WorkloadSummary.findOne(readFilter(id, viewer), EXCLUDE)
    .populate([
      { path: "academicYear", select: "name title" },
      { path: "createdBy", select: "firstName lastName middleName" },
      {
        path: "approvalSteps.approvedBy",
        select: "firstName lastName middleName",
      },
    ])
    .lean()
    .exec();
}

const { STEP_ROLES, DELETABLE_STATUSES } = require("./workloadSummary.chain");
const { ROLES } = require("#config/constants");
const {
  personName,
  formatUzDateQuoted,
} = require("#modules/4.02-studyLoad/_shared/signatories");

const getCurrentStep = (steps = []) =>
  steps.find((s) => s.status === "pending") || null;

const allApproved = (steps = []) =>
  steps.length > 0 && steps.every((s) => s.status === "approved");

const LOCKED_STATUSES = new Set(["approved", "superseded"]);

function assertNotLocked(doc) {
  if (LOCKED_STATUSES.has(doc.status)) {
    throw new ErrorHandler(
      409,
      doc.status === "approved"
        ? "Tasdiqlangan hisobot o'zgartirilmaydi"
        : "Bu hisobot o'z kuchini yo'qotgan",
      "Yangi hisobot tuzing.",
    );
  }
}

function stampSignature(step, { signature, eri, eriSignature, eriSerial }) {
  step.signature = signature || null;
  if (eri) {
    step.eriSignature = eri.signature;
    step.eriSerial = eri.serialNumber || null;
    step.eriSignedAt = eri.signedAt || new Date();
  } else if (eriSignature) {
    step.eriSignature = eriSignature;
    step.eriSerial = eriSerial || null;
    step.eriSignedAt = new Date();
  }
}

function submitSummary(doc, { userRole, userId, ...sig }) {
  assertNotLocked(doc);
  if (doc.status !== "draft") {
    throw new ErrorHandler(409, "Faqat qoralama holatidagi hisobot yuboriladi");
  }
  const isSuper = userRole === ROLES.SUPER_ADMIN;
  if (!isSuper && userRole !== STEP_ROLES.methodical) {
    throw new ErrorHandler(
      403,
      `Hisobotni faqat "${STEP_ROLES.methodical}" yubora oladi`,
    );
  }

  const first = doc.approvalSteps.find((s) => s.step === "methodical");
  if (first) {
    first.status = "approved";
    first.approvedBy = userId || null;
    first.date = new Date();
    stampSignature(first, sig);
  }
  doc.status = "in_review";
  return doc;
}

function approveStep(doc, { userRole, userId, ...sig }) {
  assertNotLocked(doc);
  if (doc.status !== "in_review") {
    throw new ErrorHandler(409, "Hisobot tasdiqlash bosqichida emas");
  }
  const step = getCurrentStep(doc.approvalSteps);
  if (!step) throw new ErrorHandler(400, "Kutilayotgan bosqich topilmadi");

  const required = STEP_ROLES[step.step];
  if (userRole !== ROLES.SUPER_ADMIN && userRole !== required) {
    throw new ErrorHandler(
      403,
      `"${step.step}" bosqichini faqat "${required}" tasdiqlay oladi`,
    );
  }

  step.status = "approved";
  step.approvedBy = userId || null;
  step.date = new Date();
  stampSignature(step, sig);

  if (allApproved(doc.approvalSteps)) doc.status = "approved";
  return { doc, approvedStep: step.step, nextStep: getCurrentStep(doc.approvalSteps)?.step || null };
}

function rejectSummary(doc, { userRole, userId, comment }) {
  assertNotLocked(doc);
  if (doc.status !== "in_review") {
    throw new ErrorHandler(409, "Hisobot tasdiqlash bosqichida emas");
  }
  const step = getCurrentStep(doc.approvalSteps);
  if (!step) throw new ErrorHandler(400, "Kutilayotgan bosqich topilmadi");

  const required = STEP_ROLES[step.step];
  if (userRole !== ROLES.SUPER_ADMIN && userRole !== required) {
    throw new ErrorHandler(
      403,
      `"${step.step}" bosqichini faqat "${required}" rad eta oladi`,
    );
  }

  step.status = "rejected";
  step.approvedBy = userId || null;
  step.date = new Date();
  step.comment = comment || null;
  doc.status = "rejected";
  return { doc, rejectedStep: step.step };
}

function reopenSummary(doc, { userRole }) {
  assertNotLocked(doc);
  if (doc.status !== "rejected") {
    throw new ErrorHandler(409, "Faqat rad etilgan hisobot qayta ochiladi");
  }
  const isSuper = userRole === ROLES.SUPER_ADMIN;
  if (!isSuper && userRole !== STEP_ROLES.methodical) {
    throw new ErrorHandler(
      403,
      `Hisobotni faqat "${STEP_ROLES.methodical}" qayta ocha oladi`,
    );
  }
  doc.approvalSteps.forEach((s) => {
    s.status = "pending";
    s.approvedBy = null;
    s.date = null;
    s.comment = null;
    s.signature = null;
    s.eriSignature = null;
    s.eriSerial = null;
    s.eriSignedAt = null;
  });
  doc.status = "draft";
  return doc;
}

async function supersedePrevious(doc) {
  const res = await WorkloadSummary.updateMany(
    {
      _id: { $ne: doc._id },
      academicYear: doc.academicYear,
      status: "approved",
      active: true,
    },
    { $set: { status: "superseded", supersededBy: doc._id, supersededAt: new Date() } },
  );
  return res.modifiedCount || res.nModified || 0;
}

function buildSignatories(doc) {
  const out = {};
  for (const step of doc.approvalSteps || []) {
    if (step.status !== "approved") continue;
    const name = personName(step.approvedBy);
    if (!name) continue;
    out[step.step] = {
      name,
      date: step.date ? formatUzDateQuoted(new Date(step.date)) : null,
    };
  }
  return out;
}

async function removeDraft(id, viewer) {
  const doc = await WorkloadSummary.findOne(readFilter(id, viewer));
  if (!doc) return null;
  if (!DELETABLE_STATUSES.includes(doc.status)) {
    throw new ErrorHandler(
      409,
      "Faqat qoralama yoki rad etilgan hisobot o'chiriladi",
      "Imzolangan hisobot tarixda qoladi.",
    );
  }
  if (doc.verify?.token && !doc.verify.revokedAt) revoke(doc, "Hisobot o'chirildi");
  doc.active = false;
  await doc.save();
  return doc;
}

module.exports = {
  buildSnapshot,
  createSummary,
  computeStaleness,
  assertFreshForFinalApproval,
  paginateSummaries,
  findSummaryById,
  visibilityFor,
  readFilter,
  getCurrentStep,
  allApproved,
  assertNotLocked,
  submitSummary,
  approveStep,
  rejectSummary,
  reopenSummary,
  supersedePrevious,
  buildSignatories,
  removeDraft,
  LOCKED_STATUSES,
};
