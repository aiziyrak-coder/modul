"use strict";

const { ErrorHandler } = require("#shared/error");
const WorkloadModel = require("./workload.model");

const OPEN_STATUSES = ["draft", "new", "in_review", "rejected"];

const versionOf = (doc) => Number(doc?.version) || 1;

function planNextVersion(docs = []) {
  const list = Array.isArray(docs) ? docs : [];
  const open = list.find((d) => OPEN_STATUSES.includes(d.status)) || null;
  const maxVersion = list.reduce((m, d) => Math.max(m, versionOf(d)), 0);
  const current = list
    .filter((d) => d.status === "approved")
    .reduce((best, d) => (!best || versionOf(d) >= versionOf(best) ? d : best), null);
  return {
    open,
    version: maxVersion + 1,
    previousVersion: current ? current._id : null,
  };
}

function openVersionError(open) {
  return new ErrorHandler(
    409,
    "Bu kafedra va o'quv yili uchun ochiq (yakunlanmagan) yuklama versiyasi bor — bitta ochiq versiya",
    `Mavjud yuklama holati: "${open.status}". Avval uni yakunlang yoki o'chiring.`,
    { reason: "open_version_exists", openWorkloadId: open._id, openStatus: open.status },
  );
}

async function prepareNewVersion({ department, academicYear }) {
  const docs = await WorkloadModel.find(
    { department, academicYear, active: { $ne: false } },
    "_id status version",
    { lean: true },
  );
  const plan = planNextVersion(docs || []);
  if (plan.open) return { error: openVersionError(plan.open) };
  return { version: plan.version, previousVersion: plan.previousVersion };
}

async function higherVersionError(doc) {
  const higher = await WorkloadModel.exists({
    _id: { $ne: doc._id },
    department: doc.department,
    academicYear: doc.academicYear,
    status: "approved",
    version: { $gt: versionOf(doc) },
  });
  if (!higher) return null;
  return new ErrorHandler(
    409,
    "Bu kafedra va o'quv yili uchun yangiroq versiya allaqachon tasdiqlangan — eski versiyani yakuniy tasdiqlab bo'lmaydi",
    undefined,
    { reason: "newer_version_approved" },
  );
}

async function supersedePreviousWorkloads(doc) {
  const res = await WorkloadModel.updateMany(
    {
      _id: { $ne: doc._id },
      department: doc.department,
      academicYear: doc.academicYear,
      status: "approved",
      $or: [{ version: { $lt: versionOf(doc) } }, { version: { $exists: false } }],
    },
    { $set: { status: "superseded", supersededBy: doc._id, supersededAt: new Date() } },
  );
  return res?.modifiedCount ?? res?.nModified ?? 0;
}

function duplicateVersionError(err) {
  if (err?.code !== 11000) return null;
  if (!err.keyPattern || !("version" in err.keyPattern)) return null;
  return new ErrorHandler(
    409,
    "Bu kafedra va o'quv yili uchun ochiq (yakunlanmagan) yuklama versiyasi bor — bitta ochiq versiya",
    "Parallel so'rov shu versiyani allaqachon yaratdi.",
    { reason: "open_version_exists" },
  );
}

module.exports = {
  OPEN_STATUSES,
  planNextVersion,
  prepareNewVersion,
  higherVersionError,
  supersedePreviousWorkloads,
  duplicateVersionError,
};
