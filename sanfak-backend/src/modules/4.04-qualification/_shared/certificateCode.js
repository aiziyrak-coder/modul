"use strict";

const SERIES = { 1: "I", 2: "MO", 3: "MM" };

const REFERENCE_PREFIX = "MN";

function prefixOf({ kind, template } = {}) {
  if (Number(kind) === 2) return REFERENCE_PREFIX;
  return SERIES[Number(template) || 1] || SERIES[1];
}

function certificateCode(cert) {
  if (!cert || !cert.number) return null;
  return `${prefixOf(cert)}${cert.number}`;
}

module.exports = { SERIES, REFERENCE_PREFIX, prefixOf, certificateCode };
