"use strict";

const { isElectiveBlock } = require("./electiveBlock");
const {
  classifyRows,
  ROW_TYPE,
  EMPTY_SLOT_TITLE,
} = require("./planRowType");

const semAt = (semesters, key) => {
  if (!semesters) return null;
  const raw =
    semesters instanceof Map ? semesters.get(String(key)) : semesters[key];
  return raw || null;
};

const hasRealSubjects = (block) =>
  classifyRows(block?.sciences).some((t) => t === ROW_TYPE.SUBJECT);

const isQuotaOnlyElective = (block) =>
  isElectiveBlock(block) && !hasRealSubjects(block);

module.exports = {
  EMPTY_SLOT_TITLE,
  isQuotaOnlyElective,
  hasRealSubjects,
  semAt,
};
