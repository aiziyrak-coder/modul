"use strict";

const { ROLES } = require("#config/constants");
const { isRegistryOwner } = require("./moduleRoles");

const PII_FIELDS = ["jshshir", "passportSeria", "passportNumber", "email", "phone"];

const canSeeStudentPii = (user) => {
  const role = user?.role;
  if (!role) return false;
  if (role.title === ROLES.SUPER_ADMIN) return true;
  return isRegistryOwner(role);
};

const isOwnRecord = (doc, user) => {
  if (!doc?.user || !user?._id) return false;
  return String(doc.user) === String(user._id);
};

const scrub = (doc, user) => {
  if (!doc || isOwnRecord(doc, user)) return doc;
  PII_FIELDS.forEach((field) => delete doc[field]);
  return doc;
};

const stripStudentPii = (data, user) => {
  if (!data || canSeeStudentPii(user)) return data;
  if (Array.isArray(data)) {
    data.forEach((doc) => scrub(doc, user));
    return data;
  }
  return scrub(data, user);
};

module.exports = { PII_FIELDS, canSeeStudentPii, stripStudentPii };
