"use strict";

const ELECTIVE_TITLE_RX = /tanlov/i;
const MANDATORY_TITLE_RX = /majburiy/i;
const PRACTICE_TITLE_RX = /amaliyot|attestat/i;

const GENERATED_CODE_RX = /^BLK0*(\d+)$/;

const ELECTIVE_BLOCK_NUMBER = 2;

function isElectiveBlock(block) {
  if (!block) return false;

  const title = String(block.title || "").trim();
  if (title) {
    if (ELECTIVE_TITLE_RX.test(title)) return true;
    if (MANDATORY_TITLE_RX.test(title)) return false;
    if (PRACTICE_TITLE_RX.test(title)) return false;
  }

  const code = String(block.blockCode || "")
    .trim()
    .toUpperCase();
  if (!code) return false;

  const generated = GENERATED_CODE_RX.exec(code);
  if (generated) return Number(generated[1]) === ELECTIVE_BLOCK_NUMBER;

  return code.startsWith("T");
}

const MODULE_TYPE = Object.freeze({
  MANDATORY: "Majburiy",
  ELECTIVE: "Tanlov",
});

function moduleTypeLabel(block) {
  if (!block) return null;
  return isElectiveBlock(block) ? MODULE_TYPE.ELECTIVE : MODULE_TYPE.MANDATORY;
}

const MAX_ALTERNATIVES = 2;


const PRACTICE_CODE_RX = /^(MM\d*-?\d+|TM\d+|ICHM\d+|BOM\d+|BAKYDA\d+)$/i;

function isPracticeEntry(entry) {
  if (!entry) return false;

  const title = String(entry.title || "").trim();
  if (title && PRACTICE_TITLE_RX.test(title)) return true;

  const code = String(entry.code || entry.scienceCode || "").trim();
  return !!code && PRACTICE_CODE_RX.test(code);
}

function isSupervisedPractice(entry) {
  if (!isPracticeEntry(entry)) return false;
  const title = String(entry.title || "").trim();
  if (/attestat|akkreditatsiya/i.test(title)) return false;
  const code = String(entry.code || entry.scienceCode || "").trim();
  return !/^BAKYDA/i.test(code);
}

const isElectiveSlotRow = (block, row) =>
  isElectiveBlock(block) && !isPracticeEntry(row);

module.exports = {
  isElectiveBlock,
  isElectiveSlotRow,
  isPracticeEntry,
  isSupervisedPractice,
  moduleTypeLabel,
  MODULE_TYPE,
  MAX_ALTERNATIVES,
};
