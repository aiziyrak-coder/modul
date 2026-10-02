"use strict";

const mongoose = require("mongoose");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoomModel = require("#references/room/room.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const ActivityPlan = require("#modules/4.05-residency/activityPlan/activityPlan.model");
const DissertationPlan = require("#modules/4.05-residency/dissertationPlan/dissertationPlan.model");
const {
  residentIdsFor,
} = require("#modules/4.05-residency/_services/residentScope");

const PLAN_MODELS = { activity: ActivityPlan, dissertation: DissertationPlan };

const idStr = (v) => (v && v._id ? String(v._id) : v ? String(v) : null);

async function buildScope(user) {
  const allowed = await residentIdsFor(user);
  if (allowed === null) return { filter: {}, allowed: null };
  return { filter: { resident: { $in: allowed } }, allowed };
}

async function checkResidentScope(user, residentId) {
  if (!residentId) {
    return { ok: false, status: 400, message: "Rezident ko'rsatilmagan" };
  }
  const exists = await Resident.exists({ _id: residentId });
  if (!exists) return { ok: false, status: 404, message: "Rezident topilmadi" };

  const allowed = await residentIdsFor(user);
  if (allowed !== null && !allowed.some((id) => String(id) === String(residentId))) {
    return {
      ok: false,
      status: 403,
      message: "Bu rezidentga ochiq dars biriktirish huquqi yo'q",
    };
  }
  return { ok: true };
}

async function resolveRoom(roomId) {
  if (!roomId) return { room: null, roomTitle: null };
  const doc = await RoomModel.findById(roomId).select("title active").lean();
  if (!doc) return { error: "Auditoriya topilmadi" };
  return { room: doc._id, roomTitle: doc.title ?? null };
}

const nameOf = (u) =>
  [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ") || null;

async function resolveAttendees(list) {
  if (!Array.isArray(list) || list.length === 0) return { attendees: [] };

  const ids = [...new Set(list.map((a) => String(a.user ?? a)))];
  const bad = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));
  if (bad.length) return { error: "O'qituvchi identifikatori yaroqsiz" };

  const users = await UserModel.find({ _id: { $in: ids } })
    .select("firstName lastName middleName")
    .lean();

  if (users.length !== ids.length) {
    const found = new Set(users.map((u) => String(u._id)));
    const missing = ids.filter((id) => !found.has(id));
    return { error: `O'qituvchi topilmadi (${missing.length} ta)` };
  }

  const byId = new Map(users.map((u) => [String(u._id), u]));
  return {
    attendees: ids.map((id) => ({ user: id, name: nameOf(byId.get(id)) })),
  };
}

async function resolvePlan(planKind, planId, residentId) {
  if (!planKind && !planId) {
    return { plan: null, planKind: null, planTitle: null };
  }
  if (!planKind || !planId) {
    return { error: "Reja turi va rejaning o'zi birga ko'rsatilishi kerak" };
  }
  const Model = PLAN_MODELS[planKind];
  if (!Model) return { error: "Reja turi noma'lum" };

  const doc = await Model.findById(planId).select("title resident").lean();
  if (!doc) return { error: "Ish reja topilmadi" };
  if (idStr(doc.resident) !== String(residentId)) {
    return { error: "Ish reja bu rezidentga tegishli emas" };
  }
  return { plan: doc._id, planKind, planTitle: doc.title ?? null };
}

function buildListFilter(query, scope) {
  const data = { ...scope };
  if (query.type) data.type = query.type;
  if (query.planKind) data.planKind = query.planKind;
  if (query.resident) {
    const inScope =
      !scope.resident ||
      (scope.resident.$in || []).some((id) => String(id) === String(query.resident));
    data.resident = inScope ? query.resident : null;
  }
  if (query.fromDate || query.toDate) {
    data.date = {};
    if (query.fromDate) data.date.$gte = new Date(query.fromDate);
    if (query.toDate) data.date.$lte = new Date(query.toDate);
  }
  return data;
}

module.exports = {
  buildScope,
  checkResidentScope,
  resolveRoom,
  resolveAttendees,
  resolvePlan,
  buildListFilter,
  nameOf,
  idStr,
};
