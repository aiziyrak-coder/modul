"use strict";

const { CANONICAL } = require("#shared/particleHelpers");
const { freeQuotaAt } = require("./electiveQuota");
const { isElectiveBlock } = require("./electiveBlock");
const { EMPTY_SLOT_TITLE } = require("./planRowType");
const { semAt } = require("./electiveQuotaSlot");

const HOURS_PER_CREDIT = 30;
const WEEKS_PER_SEMESTER = 15;

const isEmptySlotRow = (row) =>
  String(row?.title ?? "") === EMPTY_SLOT_TITLE && !row?.science && !row?.code;

const particleOf = (block, canonical, slug) =>
  (Array.isArray(block?.particle) ? block.particle : []).find(
    (p) => p?.canonical === canonical || p?.slug === slug,
  ) || null;

const entriesOf = (m) =>
  m instanceof Map ? [...m.entries()] : Object.entries(m || {});

const boundedRatio = (a, b, [lo, hi], fallback) => {
  const v = a > 0 && b > 0 ? a / b : NaN;
  return Number.isFinite(v) && v >= lo && v <= hi ? v : fallback;
};

const weeklySum = (semesters) =>
  entriesOf(semesters).reduce((s, [, v]) => s + (Number(v?.hour) || 0), 0);

function slotRatios(block) {
  const soat = Number(particleOf(block, CANONICAL.HOUR, "soat")?.value);
  const jami = Number(particleOf(block, CANONICAL.TOTAL, "jami")?.value);
  return {
    hoursPerCredit: boundedRatio(soat, Number(block?.totalCredit), [20, 40], HOURS_PER_CREDIT),
    weeksPerSemester: boundedRatio(jami, weeklySum(block?.semesters), [12, 20], WEEKS_PER_SEMESTER),
  };
}

function particleTemplate(block) {
  const own = Array.isArray(block?.particle) ? block.particle : [];
  if (own.length) return own;
  return [
    { slug: "soat", title: "soat", canonical: CANONICAL.HOUR, colNum: null },
    { slug: "jami", title: "Jami", canonical: CANONICAL.TOTAL, colNum: null },
    { slug: "mustaqil_talim", title: "Mustaqil ta'lim", canonical: CANONICAL.INDEPENDENT, colNum: null },
  ];
}

function slotParticles(block, hour, credit) {
  const { hoursPerCredit, weeksPerSemester } = slotRatios(block);
  const total = Math.round((Number(credit) || 0) * hoursPerCredit);
  const aud = Math.round((Number(hour) || 0) * weeksPerSemester);
  const valueFor = (p) => {
    if (p.canonical === CANONICAL.HOUR || p.slug === "soat") return total;
    if (p.canonical === CANONICAL.TOTAL || p.slug === "jami") return aud;
    if (p.canonical === CANONICAL.INDEPENDENT || p.slug === "mustaqil_talim") {
      return Math.max(0, total - aud);
    }
    return 0;
  };
  return particleTemplate(block).map((p) => ({
    slug: p.slug,
    slugRef: p.slugRef || null,
    title: p.title || "",
    value: valueFor(p),
    canonical: p.canonical || null,
    colNum: p.colNum != null ? p.colNum : null,
  }));
}

function slotSerial(block, index) {
  const base = String(block?.serialNumber ?? "").split(".")[0].trim() || "2";
  return `${base}.${String(Math.max(1, Number(index) || 1)).padStart(2, "0")}`;
}

function nextSlotSerial(block, existingRows) {
  let max = 0;
  for (const r of Array.isArray(existingRows) ? existingRows : []) {
    const m = /^\d+\.(\d+)$/.exec(String(r?.serialNumber ?? "").trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return slotSerial(block, max + 1);
}

function slotRowFromValues(block, hour, credit, serialNumber) {
  return {
    serialNumber,
    code: null,
    title: EMPTY_SLOT_TITLE,
    science: null,
    department: null,
    particle: slotParticles(block, hour, credit),
    totalCredit: Number(credit) || 0,
    weeklyHours: Number(hour) || 0,
    evaluationType: null,
    alternatives: [],
  };
}

function buildQuotaSlotRow(block, globalSemKey, opts = {}) {
  if (!isElectiveBlock(block)) return null;
  if (!semAt(block?.semesters, globalSemKey)) return null;
  const free = freeQuotaAt(block, String(globalSemKey));
  const hour = Math.max(0, Number(free.hour) || 0);
  const credit = Math.max(0, Number(free.credit) || 0);
  if (hour === 0 && credit === 0) return null;
  return slotRowFromValues(block, hour, credit, nextSlotSerial(block, opts.existingRows));
}

function countEmptySlots(semesters) {
  let n = 0;
  for (const [, semData] of entriesOf(semesters)) {
    for (const block of semData?.blocks || []) {
      if (!isElectiveBlock(block)) continue;
      n += (block.sciences || []).filter(isEmptySlotRow).length;
    }
  }
  return n;
}

module.exports = {
  HOURS_PER_CREDIT,
  countEmptySlots,
  WEEKS_PER_SEMESTER,
  isEmptySlotRow,
  slotRatios,
  slotParticles,
  slotSerial,
  nextSlotSerial,
  slotRowFromValues,
  buildQuotaSlotRow,
};
