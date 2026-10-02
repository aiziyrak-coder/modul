"use strict";

const { isAggregateRow } = require("./aggregateRow");
const {
  isNonScienceRow,
} = require("#modules/4.02-studyLoad/_services/scienceLinker");

const ROW_TYPE = {
  SUBJECT: "subject",
  PRACTICE: "practice",
  SECTION_HEADER: "sectionHeader",
  AGGREGATE: "aggregate",
  ELECTIVE_SLOT: "electiveSlot",
};

const EMPTY_SLOT_TITLE = "Tanlov fani (tanlanmagan)";

const serialOf = (row) => String(row?.serialNumber ?? "").trim();

const isPrefixOfLater = (serial, rows, from) => {
  if (!serial) return false;
  const prefix = serial.endsWith(".") ? serial : `${serial}.`;
  for (let i = from + 1; i < rows.length; i += 1) {
    if (serialOf(rows[i]).startsWith(prefix)) return true;
  }
  return false;
};

const rowTypeOf = (row, index, rows) => {
  if (isNonScienceRow(row)) {
    return row?.code ? ROW_TYPE.PRACTICE : ROW_TYPE.SECTION_HEADER;
  }
  if (row?.code) return ROW_TYPE.SUBJECT;
  if (String(row?.title ?? "") === EMPTY_SLOT_TITLE) {
    return ROW_TYPE.ELECTIVE_SLOT;
  }
  if (isAggregateRow(row)) return ROW_TYPE.AGGREGATE;

  const serial = serialOf(row);
  if (isPrefixOfLater(serial, rows || [], index)) return ROW_TYPE.SECTION_HEADER;
  return ROW_TYPE.SUBJECT;
};

const classifyRows = (rows) =>
  (rows || []).map((row, i) => rowTypeOf(row, i, rows));

const isCountableSubject = (type) => type === ROW_TYPE.SUBJECT;

const annotateBlocks = (doc) => {
  for (const block of doc?.blocks || []) {
    const types = classifyRows(block?.sciences);
    (block?.sciences || []).forEach((row, i) => {
      row.rowType = types[i];
    });
  }
  return doc;
};

const isPrefixOfAny = (serial, allSerials) => {
  if (!serial) return false;
  const prefix = serial.endsWith(".") ? serial : `${serial}.`;
  return (allSerials || []).some(
    (s) => s && s !== serial && s.startsWith(prefix),
  );
};

const buildBlockSerialIndexFromBlocks = (blocks) => {
  const index = new Map();
  for (const block of blocks || []) {
    const key = block?.blockCode || "";
    if (!index.has(key)) index.set(key, []);
    const arr = index.get(key);
    for (const row of block?.sciences || []) {
      const s = serialOf(row);
      if (s) arr.push(s);
    }
  }
  return index;
};

const buildBlockSerialIndex = (semestersMap) => {
  const obj =
    semestersMap instanceof Map
      ? Object.fromEntries(semestersMap)
      : semestersMap || {};
  const allBlocks = [];
  for (const semKey of Object.keys(obj)) {
    for (const block of obj[semKey]?.blocks || []) allBlocks.push(block);
  }
  return buildBlockSerialIndexFromBlocks(allBlocks);
};

const isDoubleCountedHeader = (row, allSerialsInBlock) => {
  if (isAggregateRow(row)) return true;
  return isPrefixOfAny(serialOf(row), allSerialsInBlock || []);
};

module.exports = {
  ROW_TYPE,
  EMPTY_SLOT_TITLE,
  rowTypeOf,
  classifyRows,
  isCountableSubject,
  annotateBlocks,
  isPrefixOfAny,
  buildBlockSerialIndexFromBlocks,
  buildBlockSerialIndex,
  isDoubleCountedHeader,
};
