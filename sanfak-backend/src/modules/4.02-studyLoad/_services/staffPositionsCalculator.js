"use strict";

const Position = require("#references/position/position.model");

const FALLBACK_ANNUAL_HOURS =
  Position.schema.path("annualHours").defaultValue || 720;

async function getAnnualHoursNorma() {
  const pos = await Position.findOne({ active: true })
    .sort({ date: -1 })
    .select("annualHours")
    .lean();
  const val = Number(pos?.annualHours);
  return Number.isFinite(val) && val > 0 ? val : FALLBACK_ANNUAL_HOURS;
}

function sumWorkloadHours(workload) {
  let total = 0;
  for (const dir of workload?.directions || []) {
    for (const block of dir.blocks || []) {
      total += Number(block.totalHour) || 0;
    }
  }
  return total;
}

async function buildStaffPositions(workload, annualHoursNorma) {
  const totalHours = sumWorkloadHours(workload);
  const base = annualHoursNorma || (await getAnnualHoursNorma());

  const totalPositions = base > 0 ? Math.floor(totalHours / base) : 0;
  const hourly = base > 0 ? totalHours - totalPositions * base : totalHours;

  const existingItems =
    workload &&
    workload.staffPositions &&
    Array.isArray(workload.staffPositions.items)
      ? workload.staffPositions.items
      : [];

  return {
    items: existingItems,
    totalPositions,
    hourly,
  };
}

module.exports = {
  buildStaffPositions,
  sumWorkloadHours,
  getAnnualHoursNorma,
};
