"use strict";

const APPROVAL_MAX = 500;

const sanitizeApproval = (raw) => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, APPROVAL_MAX);
};

module.exports = { APPROVAL_MAX, sanitizeApproval };
