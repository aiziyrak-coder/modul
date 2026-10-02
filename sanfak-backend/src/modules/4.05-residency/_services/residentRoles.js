"use strict";

const mongoose = require("mongoose");
const { MODULES, ACTIONS } = require("#config/constants");

const RESIDENT_STUDENT = {
  required: [[MODULES.RESIDENT, ACTIONS.READ]],
  excluding: [[MODULES.RESIDENT, ACTIONS.READ_ALL]],
};

const hasGrant = (role, [section, action]) =>
  (role?.permissions || []).some(
    (p) => p.section === section && (p.actionKeys || []).includes(action),
  );

function roleMatches(role, profile) {
  if (!role) return false;
  if (!profile.required.every((g) => hasGrant(role, g))) return false;
  return !(profile.excluding || []).some((g) => hasGrant(role, g));
}

async function rolesMatching(profile) {
  const roles = await mongoose
    .model("role")
    .find({ active: { $ne: false } })
    .select("permissions")
    .lean();

  return roles.filter((r) => roleMatches(r, profile)).map((r) => r._id);
}

module.exports = { RESIDENT_STUDENT, hasGrant, roleMatches, rolesMatching };
