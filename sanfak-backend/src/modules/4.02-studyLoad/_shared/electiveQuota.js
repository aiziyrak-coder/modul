"use strict";

const { classifyRows, ROW_TYPE } = require("./planRowType");
const { semAt } = require("./electiveQuotaSlot");

const blockQuotaAt = (block, semKey) => {
  const sem = semAt(block?.semesters, semKey);
  return {
    hour: Number(sem?.hour) || 0,
    credit: Number(sem?.credit) || 0,
  };
};

const usedInBlockAt = (block, semKey, opts = {}) => {
  const rows = block?.sciences || [];
  const types = classifyRows(rows);
  let hour = 0;
  let credit = 0;
  rows.forEach((row, i) => {
    if (
      types[i] === ROW_TYPE.AGGREGATE ||
      types[i] === ROW_TYPE.SECTION_HEADER ||
      types[i] === ROW_TYPE.PRACTICE
    ) {
      return;
    }
    if (opts.excludeRowId && String(row._id) === String(opts.excludeRowId)) {
      return;
    }
    const sem = semAt(row.semesters, semKey);
    if (!sem) return;
    hour += Number(sem.hour) || 0;
    credit += Number(sem.credit) || 0;
  });
  return { hour, credit };
};

const freeQuotaAt = (block, semKey, opts) => {
  const quota = blockQuotaAt(block, semKey);
  const used = usedInBlockAt(block, semKey, opts);
  return {
    hour: quota.hour - used.hour,
    credit: quota.credit - used.credit,
  };
};

module.exports = { blockQuotaAt, usedInBlockAt, freeQuotaAt };
