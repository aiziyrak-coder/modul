"use strict";

const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");
const logger = require("#shared/winston.logger");

function formatInitials(u) {
  const fi = u.firstName ? `${u.firstName[0]}. ` : "";
  const mi = u.middleName ? `${u.middleName[0]}. ` : "";
  return `${fi}${mi}${u.lastName}`.trim();
}

async function resolveSignatoryName(roleTitle, fallback) {
  try {
    const role = await Role.findOne({ title: roleTitle }).select("_id").lean();
    if (!role) return fallback;
    const u = await User.findOne({ role: role._id })
      .select("firstName lastName middleName")
      .lean();
    if (!u || !u.lastName) return fallback;
    return formatInitials(u);
  } catch (err) {
    logger.warn(`[pdf-signatory] ${roleTitle} topilmadi, fallback: ${err.message}`);
    return fallback;
  }
}

module.exports = { resolveSignatoryName };
