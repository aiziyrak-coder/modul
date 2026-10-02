"use strict";

const crypto = require("crypto");
const winston = require("#shared/winston.logger");
const PersonalWorkPlanModel = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const { signatoryLabel } = require("#modules/4.03-teacher/_shared/workPlanSignatories");

const TOKEN_RX = /^[0-9a-f]{32}$/;
const FINAL_STEP = "ichkiNazorat";

const idOf = (v) => (v && v._id ? v._id : v);
const isApproved = (s) => Boolean(s) && s.status === "approved";

function personName(u) {
  const first = (u && u.firstName ? String(u.firstName) : "").trim();
  const last = (u && u.lastName ? String(u.lastName) : "").trim();
  if (!last) return first;
  if (!first) return last;
  const middle = (u && u.middleName ? String(u.middleName) : "").trim();
  return `${first[0].toUpperCase()}.${middle ? `${middle[0].toUpperCase()}.` : ""}${last}`;
}

async function buildSnapshot(plan) {
  const approved = (plan.approvals || []).filter(isApproved);
  const ids = approved.map((s) => idOf(s.approvedBy)).filter((id) => id != null);
  let users = new Map();
  if (ids.length) {
    const docs = await UserModel.find({ _id: { $in: ids } })
      .select("firstName lastName middleName")
      .lean();
    users = new Map(docs.map((u) => [String(u._id), u]));
  }
  return approved.map((s) => ({
    step: s.step,
    label: signatoryLabel(s.step),
    shortName: personName(users.get(String(idOf(s.approvedBy)))) || "",
    date: s.date || null,
  }));
}

async function issueToken(plan, userId) {
  try {
    const token = crypto.randomBytes(16).toString("hex");
    const snapshot = await buildSnapshot(plan);
    plan.verify = plan.verify || {};
    plan.verify.token = token;
    plan.verify.issuedAt = new Date();
    plan.verify.issuedBy = userId || null;
    plan.verify.revokedAt = null;
    plan.verify.revokedReason = null;
    plan.verify.snapshot = snapshot;
    return token;
  } catch (err) {
    winston.error(`[workPlanVerify] issueToken xato: ${err.message}`);
    return null;
  }
}

async function issueOrRefresh(plan, userId) {
  try {
    const v = plan && plan.verify;
    if (!v || !v.token || v.revokedAt) return await issueToken(plan, userId);
    v.snapshot = await buildSnapshot(plan);
    return v.token;
  } catch (err) {
    winston.error(`[workPlanVerify] issueOrRefresh xato: ${err.message}`);
    return null;
  }
}

function revoke(plan, reason) {
  if (!plan || !plan.verify || !plan.verify.token) return;
  plan.verify.revokedAt = new Date();
  plan.verify.revokedReason = reason || null;
}

function latestDate(items) {
  let best = null;
  for (const it of items) {
    const d = it && it.date ? new Date(it.date) : null;
    if (d && !Number.isNaN(d.getTime()) && (!best || d > best)) best = d;
  }
  return best;
}

function buildTitle(plan) {
  const who = personName(plan.teacher);
  const year = plan.academicYear && plan.academicYear.title ? plan.academicYear.title : "";
  const tail = [who, year].filter(Boolean).join(", ");
  return tail ? `Shaxsiy ish reja — ${tail}` : "Shaxsiy ish reja";
}

function finalStepDate(plan) {
  const fin = (plan.approvals || []).find((s) => isApproved(s) && s.step === FINAL_STEP);
  return fin && fin.date ? new Date(fin.date) : null;
}

function toResult(plan) {
  const snapshot = (plan.verify && plan.verify.snapshot) || [];
  const base = { kind: "personalWorkPlan", title: buildTitle(plan), snapshot };
  if (plan.status === "submitted") {
    return {
      ...base,
      state: "in_progress",
      approvedAt: latestDate(snapshot),
      pending: (plan.approvals || [])
        .filter((s) => s && !isApproved(s))
        .map((s) => ({ step: s.step, label: signatoryLabel(s.step) })),
    };
  }
  if (plan.status === "approved" || plan.status === "completed") {
    return { ...base, state: "approved", approvedAt: finalStepDate(plan) || latestDate(snapshot) };
  }
  return null;
}

async function lookup(token) {
  try {
    const raw = String(token || "");
    if (!TOKEN_RX.test(raw)) return null;
    const plan = await PersonalWorkPlanModel.findOne({ "verify.token": raw })
      .populate({ path: "teacher", select: "firstName lastName middleName" })
      .populate({ path: "academicYear", select: "title" })
      .lean();
    if (!plan || (plan.verify && plan.verify.revokedAt)) return null;
    return toResult(plan);
  } catch (err) {
    winston.error(`[workPlanVerify] lookup xato: ${err.message}`);
    return null;
  }
}

module.exports = {
  issueToken,
  issueOrRefresh,
  revoke,
  lookup,
  buildSnapshot,
  personName,
};
