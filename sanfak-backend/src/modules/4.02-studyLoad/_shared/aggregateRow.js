"use strict";

const AGGREGATE_TITLES = new Set([
  "jami",
  "hammasi",
  "jami:",
  "hammasi:",
  "umumiy",
  "всего",
  "итого",
  "total",
]);

const isAggregateRow = (row) =>
  !row?.code &&
  AGGREGATE_TITLES.has(String(row?.title ?? "").trim().toLowerCase());

const hasAggregateRow = (blocks) =>
  (blocks || []).some((block) =>
    (block?.sciences || []).some((row) => isAggregateRow(row)),
  );

module.exports = { AGGREGATE_TITLES, isAggregateRow, hasAggregateRow };
