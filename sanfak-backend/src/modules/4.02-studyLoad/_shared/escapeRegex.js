"use strict";

const REGEX_META = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(input) {
  if (input === null || input === undefined) return "";
  return String(input).replace(REGEX_META, "\\$&");
}

module.exports = escapeRegex;
