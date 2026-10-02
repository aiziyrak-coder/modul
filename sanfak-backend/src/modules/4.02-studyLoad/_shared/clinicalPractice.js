"use strict";

const { ROW_TYPE, classifyRows } = require("./planRowType");

const CLINICAL_SECTION_TITLE_RE = /^klinik(?!a\s+oldi)/i;

const isClinicalSectionTitle = (title) =>
  CLINICAL_SECTION_TITLE_RE.test(String(title ?? "").trim());

const normalizePrefix = (serial) => {
  const trimmed = String(serial ?? "").trim();
  if (!trimmed) return "";
  const stripped = trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
  return `${stripped}.`;
};

const collectClinicalPrefixes = (rows) => {
  const prefixes = new Set();
  const list = rows || [];
  const types = classifyRows(list);

  list.forEach((row, i) => {
    if (types[i] !== ROW_TYPE.SECTION_HEADER) return;
    if (!isClinicalSectionTitle(row?.title)) return;
    const prefix = normalizePrefix(row?.serialNumber);
    if (!prefix) return;
    prefixes.add(prefix);
  });

  return prefixes;
};

const isClinicalRow = (row, prefixes) => {
  if (!prefixes || prefixes.size === 0) return false;
  const serial = String(row?.serialNumber ?? "").trim();
  if (!serial) return false;
  for (const prefix of prefixes) {
    if (serial.startsWith(prefix)) return true;
  }
  return false;
};

const applyClinicalSplit = (
  { lecture = 0, seminar = 0, laboratory = 0, practical = 0, clinical = 0 } = {},
  { share } = {},
) => {
  if (clinical > 0) {
    return {
      lecture,
      seminar,
      laboratory,
      practical,
      clinical,
      clamped: false,
      derived: false,
    };
  }

  const base = lecture + seminar + laboratory + practical + clinical;
  const rawKlinik = Math.round(base * share);
  const clamped = rawKlinik > practical;
  const klinik = Math.min(rawKlinik, practical);

  return {
    lecture,
    seminar,
    laboratory,
    practical: practical - klinik,
    clinical: klinik,
    clamped,
    derived: true,
  };
};

module.exports = {
  isClinicalSectionTitle,
  collectClinicalPrefixes,
  isClinicalRow,
  applyClinicalSplit,
};
