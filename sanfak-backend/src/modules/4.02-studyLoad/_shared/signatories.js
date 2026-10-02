"use strict";

const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

const BLANK_DATE = "202__ yil “___” ________";

function formatUzDateQuoted(dt) {
  return `${dt.getFullYear()}-yil “ ${dt.getDate()} ” ${UZ_MONTHS[dt.getMonth()]}`;
}

const OBJECT_ID_RX = /^[0-9a-f]{24}$/i;

function isPopulatedPerson(v) {
  return !!(v && typeof v === "object" && (v.lastName || v.firstName));
}

function personName(v, opts) {
  const first = (v && v.firstName ? String(v.firstName) : "").trim();
  const last = (v && v.lastName ? String(v.lastName) : "").trim();
  if (!last) return first;
  if (!first) return last;
  const initial = first[0].toUpperCase();
  const middle = (v && v.middleName ? String(v.middleName) : "").trim();
  const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
  return `${initial}.${middleInitial}${last}`;
}

function manualDateText(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (OBJECT_ID_RX.test(s)) return null;
  if (s.includes("___")) return null;
  return s;
}

function resolveSignatory(doc, opts) {
  const { step, block, personField, snapshot, steps: stepsOverride, compact } =
    opts || {};

  if (Array.isArray(snapshot) && step) {
    const entry = snapshot.find((s) => s && s.step === step);
    if (entry) {
      const date = entry.date ? new Date(entry.date) : null;
      return {
        name: entry.shortName || "",
        date,
        dateText: date ? formatUzDateQuoted(date) : BLANK_DATE,
        source: "snapshot",
      };
    }
  }

  const blockObj = doc && block ? doc[block] : null;
  const person = blockObj && personField ? blockObj[personField] : null;

  if (isPopulatedPerson(person)) {
    const manualDate = blockObj ? manualDateText(blockObj.date) : null;
    return {
      name: personName(person, { compact }),
      date: null,
      dateText: manualDate || BLANK_DATE,
      source: "manual",
    };
  }

  const steps = Array.isArray(stepsOverride)
    ? stepsOverride
    : doc && Array.isArray(doc.approvalSteps)
      ? doc.approvalSteps
      : [];
  const stepEntry = step ? steps.find((s) => s && s.step === step) : null;

  if (stepEntry && stepEntry.status === "approved") {
    const name = isPopulatedPerson(stepEntry.approvedBy)
      ? personName(stepEntry.approvedBy, { compact })
      : "";
    const date = stepEntry.date ? new Date(stepEntry.date) : null;
    return {
      name,
      date,
      dateText: date ? formatUzDateQuoted(date) : BLANK_DATE,
      source: "chain",
    };
  }

  return { name: "", date: null, dateText: BLANK_DATE, source: "none" };
}

module.exports = {
  resolveSignatory,
  formatUzDateQuoted,
  BLANK_DATE,
  UZ_MONTHS,
  isPopulatedPerson,
  personName,
};
