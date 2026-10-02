"use strict";

const crypto = require("crypto");
const winston = require("#shared/winston.logger");
const UserModel = require("#modules/4.01-auth/user/user.model");
const { personName } = require("#modules/4.02-studyLoad/_shared/signatories");
const {
  resolveStepLabel,
} = require("#modules/4.02-studyLoad/_shared/signatoryLabels");
const {
  getAcademicYearTitle,
} = require("#references/_services/academicYearResolver");
const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const SyllabusModel = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const ScienceProgramModel = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkloadSummaryModel = require("#modules/4.02-studyLoad/workloadSummary/workloadSummary.model");
const ContingentReportModel = require("#modules/4.02-studyLoad/contingentReport/contingentReport.model");
const TeacherLeaveModel = require("#modules/4.02-studyLoad/teacherLeave/teacherLeave.model");

const FORM_VERSION_LABELS = { v259: "259-son", v142: "142-son" };

const REGISTRY = [
  {
    kind: "workload",
    Model: WorkloadModel,
    supersedeVerify: true,
    populate: [{ path: "department", select: "title" }],
    buildTitle: async (doc) => {
      const dept =
        doc.department && doc.department.title ? doc.department.title : "Kafedra";
      let year = "";
      try {
        year = (await getAcademicYearTitle(doc.academicYear)) || "";
      } catch (err) {
        winston.error(`[documentVerify] academicYear title xato: ${err.message}`);
      }
      const yearPart = year ? `${year} o'quv yili ` : "";
      return `${dept} — ${yearPart}yuklamasi`.replace(/\s+/g, " ").trim();
    },
  },
  {
    kind: "workloadDistribution",
    Model: WorkloadDistributionModel,
    supersedeVerify: true,
    populate: [{ path: "department", select: "title" }],
    buildTitle: async (doc) => {
      const dept =
        doc.department && doc.department.title ? doc.department.title : "Kafedra";
      let year = "";
      try {
        year = (await getAcademicYearTitle(doc.academicYear)) || "";
      } catch (err) {
        winston.error(`[documentVerify] academicYear title xato: ${err.message}`);
      }
      const yearPart = year ? `${year} o'quv yili ` : "";
      return `${dept} — ${yearPart}yuklama taqsimoti`.replace(/\s+/g, " ").trim();
    },
  },
  {
    kind: "syllabus",
    Model: SyllabusModel,
    populate: [{ path: "science", select: "title" }],
    buildTitle: async (doc) => {
      const scienceName =
        (doc.science && doc.science.title) ||
        doc.scienceTitle ||
        doc.scienceLabel ||
        "Fan";
      const yearPart = doc.year ? `${doc.year}-yil ` : "";
      return `${scienceName} — ${yearPart}sillabusi`.replace(/\s+/g, " ").trim();
    },
  },
  {
    kind: "scienceProgram",
    Model: ScienceProgramModel,
    populate: [{ path: "science", select: "title" }],
    buildTitle: async (doc) => {
      const scienceName =
        (doc.science && doc.science.title) || doc.label || "Fan";
      const formLabel =
        FORM_VERSION_LABELS[doc.formVersion] || FORM_VERSION_LABELS.v259;
      return `${scienceName} — ${formLabel} fan dasturi`
        .replace(/\s+/g, " ")
        .trim();
    },
  },
  {
    kind: "workingSchedule",
    Model: WorkingScheduleModel,
    stepsPath: "approvalHistory",
    partialVerify: true,
    populate: [{ path: "direction", select: "title directionCode" }],
    buildTitle: async (doc) => {
      const dirCode =
        (doc.direction && doc.direction.directionCode) || "";
      const dirName = (doc.direction && doc.direction.title) || "Yo'nalish";
      const dirLabel = dirCode ? `${dirCode} – "${dirName}"` : `"${dirName}"`;
      let year = "";
      try {
        year = (await getAcademicYearTitle(doc.academicYear)) || "";
      } catch (err) {
        winston.error(`[documentVerify] academicYear title xato: ${err.message}`);
      }
      const stageRaw = doc.stage ? String(doc.stage) : "";
      const stagePart = stageRaw
        ? /bosqich|kurs/i.test(stageRaw)
          ? stageRaw
          : `${stageRaw} bosqich`
        : "";
      const tail = [year ? `${year} o'quv yili` : "", stagePart]
        .filter(Boolean)
        .join(", ");
      return `${dirLabel}${tail ? ` — ${tail}` : ""} ishchi o'quv rejasi`
        .replace(/\s+/g, " ")
        .trim();
    },
  },
  {
    kind: "workloadSummary",
    Model: WorkloadSummaryModel,
    populate: [],
    buildTitle: async (doc) => {
      let year = doc.academicYearTitle || "";
      if (!year) {
        try {
          year = (await getAcademicYearTitle(doc.academicYear)) || "";
        } catch (err) {
          winston.error(`[documentVerify] academicYear title xato: ${err.message}`);
        }
      }
      const yearPart = year ? `${year} o'quv yili — ` : "";
      return `${yearPart}kafedralar soatlar hisobi va ish o'rinlari`
        .replace(/\s+/g, " ")
        .trim();
    },
  },
  {
    kind: "contingentReport",
    Model: ContingentReportModel,
    populate: [],
    buildTitle: async (doc) => {
      let year = doc.academicYearTitle || "";
      if (!year) {
        try {
          year = (await getAcademicYearTitle(doc.academicYear)) || "";
        } catch (err) {
          winston.error(`[documentVerify] academicYear title xato: ${err.message}`);
        }
      }
      const faculty = doc.facultyTitle || "Fakultet";
      const yearPart = year ? `${year} o'quv yili ` : "";
      return `${faculty} — ${yearPart}talabalar kontingenti hisoboti`
        .replace(/\s+/g, " ")
        .trim();
    },
  },
  {
    kind: "teacherLeave",
    Model: TeacherLeaveModel,
    populate: [{ path: "teacher", select: "firstName lastName middleName" }],
    buildSteps: (doc) =>
      doc.status === "approved" && doc.approvedBy
        ? [{ step: "kafedra", status: "approved", approvedBy: doc.approvedBy, date: doc.approvalDate || null }]
        : [],
    buildTitle: async (doc) => {
      const who = personName(doc.teacher) || "";
      return `O'qituvchi arizasi bayonnomasi${who ? ` — ${who}` : ""}`;
    },
  },
];

const TOKEN_RX = /^[0-9a-f]{32}$/;

async function buildSnapshot(kind, doc) {
  const entry = REGISTRY.find((r) => r.kind === kind);
  const stepsField = (entry && entry.stepsPath) || "approvalSteps";
  const raw = entry && entry.buildSteps ? entry.buildSteps(doc) : doc[stepsField];
  const steps = Array.isArray(raw) ? raw : [];
  const approvedSteps = steps.filter((s) => s && s.status === "approved");
  const userIds = approvedSteps
    .map((s) => s.approvedBy)
    .filter((id) => id != null);

  let userMap = new Map();
  if (userIds.length) {
    const users = await UserModel.find({ _id: { $in: userIds } })
      .select("firstName lastName middleName")
      .lean();
    userMap = new Map(users.map((u) => [String(u._id), u]));
  }

  return approvedSteps.map((s) => ({
    step: s.step,
    label: resolveStepLabel(kind, s.step),
    shortName: personName(userMap.get(String(s.approvedBy))) || "",
    date: s.date || null,
  }));
}

function resolveRegistryEntry(doc) {
  const modelName = doc && doc.constructor && doc.constructor.modelName;
  return REGISTRY.find((r) => r.Model.modelName === modelName) || null;
}

async function issueToken(doc, userId) {
  try {
    const entry = resolveRegistryEntry(doc);
    const kind = entry ? entry.kind : null;
    const token = crypto.randomBytes(16).toString("hex");
    const snapshot = await buildSnapshot(kind, doc);

    doc.verify = doc.verify || {};
    doc.verify.token = token;
    doc.verify.issuedAt = new Date();
    doc.verify.issuedBy = userId || null;
    doc.verify.revokedAt = null;
    doc.verify.revokedReason = null;
    doc.verify.snapshot = snapshot;

    return token;
  } catch (err) {
    winston.error(`[documentVerify] issueToken xato: ${err.message}`);
    return null;
  }
}

async function issueOrRefresh(doc, userId) {
  try {
    const v = doc && doc.verify;
    if (!v || !v.token || v.revokedAt) return await issueToken(doc, userId);
    const entry = resolveRegistryEntry(doc);
    v.snapshot = await buildSnapshot(entry ? entry.kind : null, doc);
    return v.token;
  } catch (err) {
    winston.error(`[documentVerify] issueOrRefresh xato: ${err.message}`);
    return null;
  }
}

function revoke(doc, reason) {
  if (!doc || !doc.verify || !doc.verify.token) return;
  doc.verify.revokedAt = new Date();
  doc.verify.revokedReason = reason || null;
}

function latestDate(items) {
  let best = null;
  for (const it of items) {
    const d = it && it.date ? new Date(it.date) : null;
    if (d && !Number.isNaN(d.getTime()) && (!best || d > best)) best = d;
  }
  return best;
}

const isApprovedStep = (s) => Boolean(s) && s.status === "approved";

function stepsOf(entry, doc) {
  const steps = doc[entry.stepsPath || "approvalSteps"];
  return Array.isArray(steps) ? steps : [];
}

function finalStepDate(steps) {
  const last = steps[steps.length - 1];
  return last && last.date ? new Date(last.date) : null;
}

async function buildPartialResult(entry, doc) {
  if (doc.verify && doc.verify.revokedAt) return null;
  const inReview = doc.status === "in_review";
  if (!inReview && doc.status !== "approved") return null;

  const steps = stepsOf(entry, doc);
  const snapshot = (doc.verify && doc.verify.snapshot) || [];
  const lastSigned = latestDate(steps.filter(isApprovedStep)) || latestDate(snapshot);
  const base = {
    kind: entry.kind,
    title: await entry.buildTitle(doc),
    snapshot,
    editedAfterApproval: Boolean(doc.lastEditedAfterApprovalAt),
  };

  if (!inReview) {
    return { ...base, state: "approved", approvedAt: finalStepDate(steps) || lastSigned };
  }
  return {
    ...base,
    state: "in_progress",
    approvedAt: lastSigned,
    pending: steps
      .filter((s) => !isApprovedStep(s))
      .map((s) => ({ step: s.step, label: resolveStepLabel(entry.kind, s.step) })),
  };
}

async function buildSupersededResult(entry, doc) {
  if (!entry.supersedeVerify) return null;
  if (doc.verify && doc.verify.revokedAt) return null;
  return {
    kind: entry.kind,
    title: await entry.buildTitle(doc),
    state: "superseded",
    approvedAt: (doc.verify && doc.verify.issuedAt) || null,
    supersededAt: doc.supersededAt || null,
    snapshot: (doc.verify && doc.verify.snapshot) || [],
    editedAfterApproval: Boolean(doc.lastEditedAfterApprovalAt),
  };
}

async function lookup(token) {
  try {
    const raw = String(token || "");
    if (!TOKEN_RX.test(raw)) return null;

    for (const entry of REGISTRY) {
      let q = entry.Model.findOne({ "verify.token": raw });
      for (const p of entry.populate || []) q = q.populate(p);
      const doc = await q.lean();
      if (!doc) continue;

      if (entry.partialVerify) return await buildPartialResult(entry, doc);
      if (doc.status === "superseded") return await buildSupersededResult(entry, doc);
      if (doc.status !== "approved") return null;
      if (doc.verify && doc.verify.revokedAt) return null;

      return {
        kind: entry.kind,
        title: await entry.buildTitle(doc),
        approvedAt: (doc.verify && doc.verify.issuedAt) || null,
        snapshot: (doc.verify && doc.verify.snapshot) || [],
        editedAfterApproval: Boolean(doc.lastEditedAfterApprovalAt),
      };
    }
    return null;
  } catch (err) {
    winston.error(`[documentVerify] lookup xato: ${err.message}`);
    return null;
  }
}

module.exports = {
  REGISTRY,
  issueToken,
  issueOrRefresh,
  revoke,
  lookup,
  buildSnapshot,
};
