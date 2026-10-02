"use strict";

const ContingentReport = require("./contingentReport.model");
const { ErrorHandler } = require("#shared/error");
const { PAGINATION, ROLES } = require("#config/constants");
const DirectionModel = require("#references/direction/direction.model");
const FacultyModel = require("#references/faculty/faculty.model");
const {
  personName,
  formatUzDateQuoted,
} = require("#modules/4.02-studyLoad/_shared/signatories");
const {
  andFilters,
} = require("#modules/4.02-studyLoad/_shared/chainVisibility");
const {
  STEP_ROLES,
  SUBMITTER_ROLES,
  buildChainSteps,
} = require("./contingentReport.chain");
const {
  PREFILL_CELLS,
  buildPrefillRows,
  mergePrefill,
  rowKey,
} = require("./contingentReport.prefill");
const { collectInvariantViolations } = require("./contingentReport.invariants");

const SAFE_EXCLUDE = {
  "verify.token": 0,
  "approvalSteps.eriSignature": 0,
  "approvalSteps.signature": 0,
};
const EXCLUDE = { __v: 0, ...SAFE_EXCLUDE };
const SAFE_EXCLUDE_LIST = { rows: 0, foreignByCountry: 0, __v: 0, ...SAFE_EXCLUDE };

async function createReport({
  facultyId,
  facultyTitle,
  academicYearId,
  academicYearTitle,
  asOfDate,
  userId,
}) {
  const existing = await ContingentReport.findOne({
    faculty: facultyId,
    academicYear: academicYearId,
    active: true,
  })
    .select("_id status")
    .lean();
  if (existing) {
    throw new ErrorHandler(
      409,
      `${academicYearTitle || "Tanlangan"} o'quv yili uchun bu fakultetda hisobot allaqachon bor`,
      `Mavjud hujjat: ${existing._id} (${existing.status})`,
    );
  }

  const built = await buildPrefillRows({ facultyId, academicYearId });
  const doc = new ContingentReport({
    faculty: facultyId,
    facultyTitle: facultyTitle || "",
    academicYear: academicYearId,
    academicYearTitle: academicYearTitle || "",
    asOfDate: asOfDate || new Date(),
    rows: built.rows,
    lastPrefilledAt: new Date(),
    createdBy: userId || null,
  });
  try {
    await doc.save();
  } catch (err) {
    if (err && err.code === 11000) {
      throw new ErrorHandler(409, "Bu fakultet va o'quv yili uchun hisobot allaqachon bor");
    }
    throw err;
  }
  return { doc, meta: built.meta };
}

const EDITABLE_STATUSES = new Set(["draft", "rejected"]);

function assertEditable(doc) {
  if (!EDITABLE_STATUSES.has(doc.status)) {
    throw new ErrorHandler(
      409,
      doc.status === "approved"
        ? "Tasdiqlangan hisobot o'zgartirilmaydi"
        : "Ko'rib chiqishdagi hisobot o'zgartirilmaydi — avval qaytarilsin",
    );
  }
}

async function applyPrefill(doc, { force = false } = {}) {
  assertEditable(doc);
  const built = await buildPrefillRows({
    facultyId: doc.faculty,
    academicYearId: doc.academicYear,
  });
  const counters = mergePrefill(doc, built, { force });
  doc.lastPrefilledAt = new Date();
  doc.markModified("rows");
  return { ...counters, meta: built.meta };
}

async function loadRowDirections(doc, rows) {
  const dirIds = [...new Set(rows.map((r) => String(r.direction)))];
  const directions = dirIds.length
    ? await DirectionModel.find({ _id: { $in: dirIds }, active: true })
        .select("title directionCode faculty")
        .lean()
    : [];
  const dirById = new Map(directions.map((d) => [String(d._id), d]));
  for (const id of dirIds) {
    const d = dirById.get(id);
    if (!d) throw new ErrorHandler(400, `Yo'nalish topilmadi: ${id}`);
    if (String(d.faculty || "") !== String(doc.faculty)) {
      throw new ErrorHandler(400, `"${d.title}" yo'nalishi bu fakultetga tegishli emas`);
    }
  }
  return dirById;
}

function resolveSource(old, incoming) {
  const source = {};
  for (const cell of PREFILL_CELLS) {
    const wasGroups = Boolean(old && old.source && old.source[cell] === "groups");
    source[cell] = wasGroups && old[cell] === incoming[cell] ? "groups" : "manual";
  }
  return source;
}

async function applyContent(doc, { asOfDate, rows, foreignByCountry }) {
  assertEditable(doc);
  const dirById = await loadRowDirections(doc, rows);
  const previous = new Map(
    doc.rows.map((r) => [`${rowKey(r)}|${r.category}`, r.toObject ? r.toObject() : r]),
  );

  doc.rows = rows.map((r) => {
    const d = dirById.get(String(r.direction));
    const old = previous.get(`${rowKey(r)}|${r.category || "milliy"}`);
    const { source: _clientSource, ...clean } = r;
    return {
      ...clean,
      directionCode: d.directionCode || "",
      directionTitle: d.title || "",
      source: resolveSource(old, r),
    };
  });
  doc.foreignByCountry = (foreignByCountry || []).map((f) => ({
    ...f,
    country: String(f.country).trim(),
  }));
  if (asOfDate) doc.asOfDate = asOfDate;
  return doc;
}

const filterFrom = (query, visibility) => {
  const requested = {};
  if (query.academicYear) requested.academicYear = query.academicYear;
  if (query.faculty) requested.faculty = query.faculty;
  if (query.status) requested.status = query.status;
  const filter = andFilters(requested, visibility);
  filter.active = true;
  return filter;
};

async function paginateReports(query, visibility = {}) {
  return ContingentReport.paginate(filterFrom(query, visibility), {
    page: Math.max(parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE, 1),
    limit: Math.min(
      parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT,
    ),
    select: SAFE_EXCLUDE_LIST,
    populate: [
      { path: "faculty", select: "title" },
      { path: "academicYear", select: "name title" },
    ],
    sort: { createdAt: -1 },
    lean: true,
  });
}

async function findReportById(id, visibility = {}) {
  return ContingentReport.findOne({ _id: id, active: true, ...visibility }, EXCLUDE)
    .populate([
      { path: "faculty", select: "title" },
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

const getCurrentStep = (steps = []) =>
  steps.find((s) => s.status === "pending") || null;

const allApproved = (steps = []) =>
  steps.length > 0 && steps.every((s) => s.status === "approved");

function assertNotLocked(doc) {
  if (doc.status === "approved") {
    throw new ErrorHandler(409, "Tasdiqlangan hisobot o'zgartirilmaydi");
  }
}

const isSubmitter = (role) =>
  role === ROLES.SUPER_ADMIN || SUBMITTER_ROLES.includes(role);

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

function requireCurrentStep(doc, userRole, verb) {
  assertNotLocked(doc);
  if (doc.status !== "in_review") {
    throw new ErrorHandler(409, "Hisobot tasdiqlash bosqichida emas");
  }
  const step = getCurrentStep(doc.approvalSteps);
  if (!step) throw new ErrorHandler(400, "Kutilayotgan bosqich topilmadi");
  const required = STEP_ROLES[step.step];
  if (userRole !== ROLES.SUPER_ADMIN && userRole !== required) {
    throw new ErrorHandler(403, `"${step.step}" bosqichini faqat "${required}" ${verb}`);
  }
  return step;
}

function assertRowInvariants(doc) {
  const violations = collectInvariantViolations(doc);
  if (violations.length === 0) return;
  throw new ErrorHandler(
    409,
    `Jadvalda ${violations.length} ta qatorda yig'indi mos emas — avval jadvalni tuzating`,
    violations
      .slice(0, 5)
      .map((v) => `${v.label}: ${v.message}`)
      .join("; "),
    { reason: "row_invariants", rows: violations },
  );
}

function submitReport(doc, { userRole }) {
  assertNotLocked(doc);
  if (doc.status !== "draft") {
    throw new ErrorHandler(409, "Faqat qoralama holatidagi hisobot yuboriladi");
  }
  if (!isSubmitter(userRole)) {
    throw new ErrorHandler(
      403,
      "Hisobotni faqat dekan yoki fakultet kengash kotibi yubora oladi",
    );
  }
  if (!doc.rows || doc.rows.length === 0) {
    throw new ErrorHandler(409, "Bo'sh hisobot yuborilmaydi — avval jadvalni to'ldiring");
  }
  assertRowInvariants(doc);
  doc.status = "in_review";
  doc.submittedAt = new Date();
  return doc;
}

function approveStep(doc, { userRole, userId, protocol, ...sig }) {
  const step = requireCurrentStep(doc, userRole, "tasdiqlay oladi");
  assertRowInvariants(doc);
  step.status = "approved";
  step.approvedBy = userId || null;
  step.date = new Date();
  step.protocol = protocol || null;
  stampSignature(step, sig);

  if (allApproved(doc.approvalSteps)) doc.status = "approved";
  return {
    doc,
    approvedStep: step.step,
    nextStep: getCurrentStep(doc.approvalSteps)?.step || null,
  };
}

function rejectReport(doc, { userRole, userId, comment }) {
  const step = requireCurrentStep(doc, userRole, "rad eta oladi");
  step.status = "rejected";
  step.approvedBy = userId || null;
  step.date = new Date();
  step.comment = comment || null;
  doc.status = "rejected";
  return { doc, rejectedStep: step.step };
}

function reopenReport(doc, { userRole }) {
  assertNotLocked(doc);
  if (doc.status !== "rejected") {
    throw new ErrorHandler(409, "Faqat rad etilgan hisobot qayta ochiladi");
  }
  if (!isSubmitter(userRole)) {
    throw new ErrorHandler(
      403,
      "Hisobotni faqat dekan yoki fakultet kengash kotibi qayta ocha oladi",
    );
  }
  doc.approvalSteps = buildChainSteps();
  doc.status = "draft";
  doc.submittedAt = null;
  return doc;
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

async function removeReport(id, visibility = {}) {
  const doc = await ContingentReport.findOne({ _id: id, active: true, ...visibility });
  if (!doc) return null;
  if (!EDITABLE_STATUSES.has(doc.status)) {
    throw new ErrorHandler(409, "Faqat qoralama yoki rad etilgan hisobot o'chiriladi");
  }
  doc.active = false;
  await doc.save();
  return doc;
}

async function loadApprovedReports(academicYearId) {
  return ContingentReport.find({
    academicYear: academicYearId,
    status: "approved",
    active: true,
  })
    .select("faculty facultyTitle academicYearTitle asOfDate rows foreignByCountry approvalSteps")
    .lean();
}

function summaryAsOfDate(reports = []) {
  const stamps = reports
    .map((r) => (r.asOfDate ? new Date(r.asOfDate).getTime() : null))
    .filter((t) => Number.isFinite(t));
  return stamps.length ? new Date(Math.max(...stamps)) : new Date();
}

function toPublicDoc(doc) {
  const plain = doc && typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  if (plain.verify) {
    const { token: _token, ...verify } = plain.verify;
    plain.verify = verify;
  }
  if (Array.isArray(plain.approvalSteps)) {
    plain.approvalSteps = plain.approvalSteps.map((s) => {
      const { eriSignature: _e, signature: _s, ...rest } = s;
      return rest;
    });
  }
  return plain;
}

async function listActiveFaculties() {
  return FacultyModel.find({ active: true }).select("title").sort({ title: 1 }).lean();
}

module.exports = {
  createReport,
  applyPrefill,
  applyContent,
  resolveSource,
  assertEditable,
  paginateReports,
  findReportById,
  getCurrentStep,
  allApproved,
  assertNotLocked,
  submitReport,
  approveStep,
  rejectReport,
  reopenReport,
  buildSignatories,
  removeReport,
  loadApprovedReports,
  listActiveFaculties,
  summaryAsOfDate,
  toPublicDoc,
};
