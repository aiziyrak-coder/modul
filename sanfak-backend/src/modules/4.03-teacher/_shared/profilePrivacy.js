"use strict";

const { ROLES } = require("#config/constants");

const PERSONAL_FIELDS = [
  "passportSeries",
  "passportNumber",
  "passportIssuedBy",
  "passportIssuedAt",
  "passportExpiry",
  "jshshir",
  "address",
  "birthDate",
  "teachingSpecialtyNote",
];

const PRIVILEGED_ROLES = [ROLES.KADRLAR, ROLES.SUPER_ADMIN];

function canSeePersonal(req, doc) {
  const roleTitle = req?.user?.role?.title;
  if (PRIVILEGED_ROLES.includes(roleTitle)) return true;

  const ownerId = doc?.user?._id || doc?.user;
  const requesterId = req?.user?._id;
  if (!ownerId || !requesterId) return false;

  return String(ownerId) === String(requesterId);
}

function redactProfile(req, doc) {
  if (!doc) return doc;

  const plain = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  if (canSeePersonal(req, plain)) return plain;

  for (const f of PERSONAL_FIELDS) delete plain[f];
  return plain;
}

function redactProfiles(req, docs) {
  if (!Array.isArray(docs)) return docs;
  return docs.map((d) => redactProfile(req, d));
}

module.exports = {
  PERSONAL_FIELDS,
  PRIVILEGED_ROLES,
  canSeePersonal,
  redactProfile,
  redactProfiles,
};
