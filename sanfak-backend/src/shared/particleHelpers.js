"use strict";

function particleValue(particle, key, defaultVal = 0) {
  if (!Array.isArray(particle) || !key) return defaultVal;

  let it = particle.find((p) => p && p.canonical === key);
  if (!it) it = particle.find((p) => p && p.slug === key);

  const v = it ? Number(it.value) : NaN;
  return Number.isFinite(v) ? v : defaultVal;
}

function particleItem(particle, key) {
  if (!Array.isArray(particle) || !key) return null;
  return (
    particle.find((p) => p && p.canonical === key) ||
    particle.find((p) => p && p.slug === key) ||
    null
  );
}

function sortByColNum(particle) {
  if (!Array.isArray(particle)) return [];
  return [...particle].sort((a, b) => {
    const ca = Number(a?.colNum);
    const cb = Number(b?.colNum);
    if (!Number.isFinite(ca) && !Number.isFinite(cb)) return 0;
    if (!Number.isFinite(ca)) return 1;
    if (!Number.isFinite(cb)) return -1;
    return ca - cb;
  });
}

function ctStream(sw, key, legacyKey) {
  const arr = sw && Array.isArray(sw.classTypes) ? sw.classTypes : null;
  if (arr && key) {
    let it = arr.find((c) => c && c.canonical === key);
    if (!it) it = arr.find((c) => c && c.slug === key);
    if (it && Number.isFinite(+it.stream)) return +it.stream || 0;
  }
  if (legacyKey && sw && sw[legacyKey] && Number.isFinite(+sw[legacyKey].stream)) {
    return +sw[legacyKey].stream || 0;
  }
  return 0;
}

function ctTotal(sw, key, legacyKey) {
  const arr = sw && Array.isArray(sw.classTypes) ? sw.classTypes : null;
  if (arr && key) {
    let it = arr.find((c) => c && c.canonical === key);
    if (!it) it = arr.find((c) => c && c.slug === key);
    if (it && Number.isFinite(+it.total)) return +it.total || 0;
  }
  if (legacyKey && sw && sw[legacyKey] && Number.isFinite(+sw[legacyKey].total)) {
    return +sw[legacyKey].total || 0;
  }
  return 0;
}

function itemVal(wrap, key, legacyKey) {
  const arr = wrap && Array.isArray(wrap.items) ? wrap.items : null;
  if (arr && key) {
    let it = arr.find((c) => c && c.canonical === key);
    if (!it) it = arr.find((c) => c && c.slug === key);
    if (it && Number.isFinite(+it.value)) return +it.value || 0;
  }
  if (legacyKey && wrap && Number.isFinite(+wrap[legacyKey])) {
    return +wrap[legacyKey] || 0;
  }
  return 0;
}

const CANONICAL = Object.freeze({
  HOUR:        "hour",
  PERCENT:     "percent",
  TOTAL:       "total",
  LECTURE:     "lecture",
  PRACTICAL:   "practical",
  LABORATORY:  "laboratory",
  SEMINAR:     "seminar",
  INDEPENDENT: "independent",
});

const WORK_CANONICAL = Object.freeze({
  LECTURE:           "lecture",
  CLINICAL_PRACTICE: "clinical_practice",
  LAB_TRAINING:      "lab_training",
  PRACTICAL:         "practical",
  SEMINAR:           "seminar",
  STUDENT_WORK:      "student_work",
  YAN:               "yan",
  MISSED:            "missed_lesson",
  SKILLED_PRACTICE:  "skilled_practice",
  SPECIAL:           "special",
  PARTICIPATION:     "participation",
  RECEPTION:         "reception",
  CONSULTING:        "consulting",
  OPEN_DEPARTMENT:   "open_department",
  OPEN_INTEGRAL:     "open_integral",
});

function getColNum(meta, key) {
  if (!meta || !meta.columns) return null;
  const v = meta.columns[key];
  return Number.isFinite(+v) ? +v : null;
}

function buildCanonicalColMap(meta) {
  const out = {};
  const items = meta?.particles?.items || [];
  for (const it of items) {
    if (!it) continue;
    const slugToCanonical = {
      soat:                           "hour",
      umumiy_yuklamaning_hajmi_soat:  "hour",
      foiz:                           "percent",
      percent:                        "percent",
      jami:                           "total",
      maruza:                         "lecture",
      amaliy:                         "practical",
      laboratoriya:                   "laboratory",
      seminar:                        "seminar",
      mustaqil:                       "independent",
      mustaqil_ta_lim:                "independent",
      mustaqil_talim:                 "independent",
    };
    const can = slugToCanonical[it.slug];
    if (can && Number.isFinite(+it.colNum)) out[can] = +it.colNum;
  }
  return out;
}

module.exports = {
  particleValue,
  particleItem,
  sortByColNum,

  ctStream,
  ctTotal,
  itemVal,

  CANONICAL,
  WORK_CANONICAL,

  getColNum,
  buildCanonicalColMap,
};
