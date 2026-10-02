const mongoose = require("mongoose");

const hasGrant = (role, [section, action]) =>
  (role?.permissions || []).some(
    (p) => p.section === section && (p.actionKeys || []).includes(action),
  );

async function rolesGranting(required, { excluding = [] } = {}) {
  const roles = await mongoose
    .model("role")
    .find({ active: { $ne: false } })
    .select("permissions")
    .lean();

  return roles
    .filter((r) => required.every((g) => hasGrant(r, g)))
    .filter((r) => !excluding.some((g) => hasGrant(r, g)))
    .map((r) => r._id);
}

function roleMatches(role, required, { excluding = [] } = {}) {
  if (!role) return false;
  if (!required.every((g) => hasGrant(role, g))) return false;
  return !excluding.some((g) => hasGrant(role, g));
}

module.exports = { rolesGranting, hasGrant, roleMatches };
