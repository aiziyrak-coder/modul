"use strict";

const winston = require("#shared/winston.logger");
const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const { revoke } = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const { CHAIN_REGISTRY } = require("#modules/4.02-studyLoad/_shared/chainRegistry");
const {
  safeDispatchMany,
  getDepartmentHeadUserIds,
} = require("#modules/4.02-studyLoad/_shared/chainNotify");
const {
  findActiveDependents,
  markInactiveDependentsStale,
} = require("./finalStepRevoke.dependents");

const REVOKE_ACTION = "revoked_final";
const REVOKE_REASON = "Tasdiq bekor qilindi";
const NOTICE_TITLE = "Tasdiq bekor qilindi";

const stepApprover = (steps, key) =>
  (steps || []).find((s) => s.step === key)?.approvedBy || null;

const departmentHeads = (doc) => getDepartmentHeadUserIds(doc.department);

const refTitle = (v) =>
  v && typeof v === "object" && typeof v.title === "string" ? v.title : "";

const joinParts = (...parts) =>
  parts.map((p) => String(p ?? "").trim()).filter(Boolean).join(", ");

const ordinal = (n, unit) => (Number(n) > 0 ? `${Number(n)}-${unit}` : "");

const ENTITY_CONFIG = {
  workingSchedule: {
    label: "Ishchi o'quv reja",
    eventType: "workingSchedule_rejected",
    link: (id) => `/study-load/working-schedules/${id}`,
    recipients: (d) => [stepApprover(d.approvalHistory, "methodical")],
    describe: (d) => d.title || joinParts(d.year, ordinal(d.currentCourse, "kurs")),
  },
  workload: {
    label: "Yuklama",
    eventType: "workload_rejected",
    link: (id) => `/study-load/workloads/${id}`,
    recipients: departmentHeads,
    docComment: true,
    describe: (d) => d.title || refTitle(d.department),
  },
  workloadDistribution: {
    label: "Taqsimot",
    eventType: "workload_rejected",
    link: (id) => `/study-load/distributions/${id}`,
    recipients: departmentHeads,
    docComment: true,
    describe: (d) => d.title || joinParts(refTitle(d.department), ordinal(d.course, "kurs")),
  },
  syllabus: {
    label: "Sillabus",
    eventType: "syllabus_rejected",
    link: (id) => `/study-load/syllabi/${id}/edit`,
    recipients: (d) => [d.author?.teacher],
    describe: (d) => d.title || joinParts(refTitle(d.science), ordinal(d.semester, "semestr")),
  },
  scienceProgram: {
    label: "Fan dasturi",
    eventType: "scienceProgram_rejected",
    link: (id) => `/study-load/science-programs/${id}/edit`,
    recipients: (d) => [d.user],
    describe: (d) => d.title || joinParts(refTitle(d.science), ordinal(d.semester, "semestr")),
  },
  workloadSummary: {
    label: "Kafedralar soatlar hisobi",
    eventType: "workloadSummary_rejected",
    link: (id) => `/study-load/workload-summaries/${id}`,
    recipients: (d) => [d.createdBy || stepApprover(d.approvalSteps, "methodical")],
    describe: (d) => (d.academicYearTitle ? `${d.academicYearTitle} o'quv yili` : ""),
  },
  contingentReport: {
    label: "Talabalar kontingenti hisoboti",
    eventType: "contingentReport_rejected",
    link: (id) => `/study-load/contingent-reports/${id}`,
    recipients: (d) => [d.createdBy],
    describe: (d) => joinParts(d.facultyTitle, d.academicYearTitle),
  },
};

function noticeBody(entity, doc, comment) {
  const cfg = ENTITY_CONFIG[entity];
  const name = cfg.describe ? cfg.describe(doc) : "";
  return name ? `${cfg.label} «${name}». Sabab: ${comment}` : `${cfg.label}. Sabab: ${comment}`;
}

function getFinalStep(doc, stepsField) {
  const steps = doc && doc[stepsField];
  if (!Array.isArray(steps) || steps.length === 0) return null;
  return steps[steps.length - 1];
}

function assertFinalActor(role, finalStep, stepRoles, isSuper) {
  if (!finalStep) {
    throw new ErrorHandler(400, "Yakuniy tasdiq bosqichi topilmadi");
  }
  if (finalStep.status !== "approved") {
    throw new ErrorHandler(
      409,
      "Yakuniy bosqich tasdiqlanmagan — tasdiqni bekor qilib bo'lmaydi",
    );
  }
  if (isSuper) return;
  const required = stepRoles[finalStep.step];
  if (!required || role !== required) {
    throw new ErrorHandler(
      403,
      `Tasdiqlangan hujjatni faqat yakuniy "${finalStep.step}" bosqichi egasi ("${required || "—"}") qaytara oladi`,
      undefined,
      { reason: "final_step_only" },
    );
  }
}

function applyRevoke(step, userId, comment) {
  step.status = "rejected";
  step.approvedBy = userId || null;
  step.date = new Date();
  step.comment = comment;
  return step;
}

const DEFAULT_REVOCABLE = ["approved"];

async function saveIfStillApproved(doc, statuses = DEFAULT_REVOCABLE) {
  doc.$where =
    statuses.length === 1 ? { status: statuses[0] } : { status: { $in: statuses } };
  try {
    await doc.save();
  } catch (err) {
    if (err?.name === "DocumentNotFoundError" || err?.name === "VersionError") {
      throw new ErrorHandler(
        409,
        "Hujjat holati o'zgargan — sahifani yangilab, qayta urinib ko'ring",
      );
    }
    throw err;
  } finally {
    doc.$where = undefined;
  }
}

function assertRevocable(doc, revocableStatuses) {
  const statuses = revocableStatuses || DEFAULT_REVOCABLE;
  if (!statuses.includes(doc.status)) {
    throw new ErrorHandler(409, "Bu holatdagi hujjatning tasdig'ini bekor qilib bo'lmaydi");
  }
  return statuses;
}

async function assertNoActiveDependents(entity, doc, user) {
  const dependents = await findActiveDependents(entity, doc, user);
  if (dependents.length === 0) return;
  throw new ErrorHandler(
    409,
    "Bu hujjatdan hosil bo'lgan faol hujjatlar bor — avval ularni qaytaring",
    undefined,
    { reason: "active_dependents", dependents },
  );
}

async function afterRevoke(entity, doc, afterSave) {
  let marked = 0;
  try {
    marked = await markInactiveDependentsStale(entity, doc);
  } catch (err) {
    winston.warn(`[finalStepRevoke] ${entity} needsRecalculation xato: ${err.message}`);
  }
  if (afterSave) {
    try {
      await afterSave(doc);
    } catch (err) {
      winston.warn(`[finalStepRevoke] ${entity} PDF yangilash xato: ${err.message}`);
    }
  }
  return marked;
}

function notifyInBackground(entity, doc, step, comment) {
  const cfg = ENTITY_CONFIG[entity];
  Promise.resolve()
    .then(async () => {
      const ids = (await cfg.recipients(doc)).filter(Boolean);
      await safeDispatchMany(ids, {
        eventType: cfg.eventType,
        title: NOTICE_TITLE,
        body: noticeBody(entity, doc, comment),
        link: cfg.link(doc._id),
        metadata: { documentId: doc._id, entity, step: step.step, action: REVOKE_ACTION },
      });
    })
    .catch((err) =>
      winston.warn(`[finalStepRevoke] ${entity} bildirishnoma xato: ${err.message}`),
    );
}

async function runFinalRevoke({ entity, doc, req, res, next, afterSave, revocableStatuses }) {
  try {
    const statuses = assertRevocable(doc, revocableStatuses);
    const { stepsField, stepRoles } = CHAIN_REGISTRY[entity];
    const comment = String(req.body?.comment ?? "").trim();
    if (!comment) {
      throw new ErrorHandler(400, "Tasdiqni bekor qilish uchun sabab (comment) majburiy");
    }
    const role = req.user?.role?.title;
    const step = getFinalStep(doc, stepsField);
    assertFinalActor(role, step, stepRoles, role === ROLES.SUPER_ADMIN);
    await assertNoActiveDependents(entity, doc, req.user);

    applyRevoke(step, req.user?._id, comment);
    doc.status = "rejected";
    if (ENTITY_CONFIG[entity].docComment) doc.comment = comment;
    revoke(doc, REVOKE_REASON);
    await saveIfStillApproved(doc, statuses);
    const marked = await afterRevoke(entity, doc, afterSave);

    res.status(200).json({
      message: `${ENTITY_CONFIG[entity].label}: yakuniy tasdiq bekor qilindi`,
      action: REVOKE_ACTION,
      rejectedStep: step.step,
      status: doc.status,
      comment,
      dependentsMarkedStale: marked,
    });
    notifyInBackground(entity, doc, step, comment);
    return undefined;
  } catch (err) {
    return next(
      err.statusCode
        ? err
        : new ErrorHandler(400, "Tasdiqni bekor qilishda xatolik", err.message),
    );
  }
}

module.exports = {
  REVOKE_ACTION,
  REVOKE_REASON,
  DEFAULT_REVOCABLE,
  ENTITY_CONFIG,
  noticeBody,
  getFinalStep,
  assertRevocable,
  assertFinalActor,
  applyRevoke,
  saveIfStillApproved,
  runFinalRevoke,
};
