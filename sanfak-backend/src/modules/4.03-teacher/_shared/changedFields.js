"use strict";

function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

function normalize(v) {
  if (isEmpty(v)) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && typeof v.toISOString === "function") {
    return v.toISOString();
  }
  return String(v);
}

function isPlainObject(v) {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    !(v instanceof Date) &&
    typeof v.toISOString !== "function"
  );
}

function scalarEqual(a, b) {
  return normalize(a) === normalize(b);
}

function diffValue(prefix, oldVal, newVal, out) {
  if (Array.isArray(newVal)) {
    const oldArr = Array.isArray(oldVal) ? oldVal : [];
    const maxLen = Math.max(oldArr.length, newVal.length);
    for (let i = 0; i < maxLen; i++) {
      const itemPrefix = `${prefix}.${i}`;
      if (i >= newVal.length) {
        out.push(itemPrefix);
      } else if (i >= oldArr.length) {
        diffValue(itemPrefix, undefined, newVal[i], out);
      } else {
        diffValue(itemPrefix, oldArr[i], newVal[i], out);
      }
    }
    return;
  }

  if (isPlainObject(newVal)) {
    const oldObj = isPlainObject(oldVal) ? oldVal : {};
    const keys = new Set([...Object.keys(oldObj), ...Object.keys(newVal)]);
    for (const key of keys) {
      diffValue(`${prefix}.${key}`, oldObj[key], newVal[key], out);
    }
    return;
  }

  if (!scalarEqual(oldVal, newVal)) out.push(prefix);
}

function computeChangedFields(existingDoc, updateData) {
  if (!updateData || typeof updateData !== "object") return [];

  const existing =
    existingDoc && typeof existingDoc.toObject === "function"
      ? existingDoc.toObject()
      : existingDoc || {};

  const out = [];
  for (const key of Object.keys(updateData)) {
    diffValue(key, existing[key], updateData[key], out);
  }

  return [...new Set(out)].sort();
}

module.exports = { computeChangedFields };
