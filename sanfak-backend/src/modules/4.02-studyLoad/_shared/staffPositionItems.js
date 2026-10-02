"use strict";

const EMPTY_ITEM = Object.freeze({ positions: 0, load: 0, totalHours: 0, hourly: 0 });

function findStaffItem(sp, category, slug) {
  const items = sp && Array.isArray(sp.items) ? sp.items : [];
  const found = items.find(
    (it) => it && it.category === category && it.slug === slug,
  );
  if (!found) return EMPTY_ITEM;
  return {
    positions: Number(found.positions) || 0,
    load: Number(found.load) || 0,
    totalHours: Number(found.totalHours) || 0,
    hourly: Number(found.hourly) || 0,
  };
}

function averageLoad(totalHours, positions) {
  const p = Number(positions) || 0;
  const h = Number(totalHours) || 0;
  if (p <= 0) return 0;
  return Math.round(h / p);
}

function getOverallTotals(sp) {
  return {
    totalPositions: Number(sp && sp.totalPositions) || 0,
    hourly: Number(sp && sp.hourly) || 0,
  };
}

function sumHourly(sp) {
  const items = sp && Array.isArray(sp.items) ? sp.items : [];
  return items.reduce((s, it) => s + (Number(it && it.hourly) || 0), 0);
}

module.exports = { findStaffItem, getOverallTotals, averageLoad, sumHourly, EMPTY_ITEM };
