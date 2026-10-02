"use strict";

const TOTAL_SLUGS = new Set(["hammasi", "all"]);

const TOTAL_KEY_TITLE = "jami";

const normKey = (v) => (v === null || v === undefined ? null : String(v).trim());

const normText = (v) => String(v ?? "").trim().toLowerCase();

const num = (v) => Number(v) || 0;

const isTotalKeyItem = (keyItem) => normText(keyItem?.title) === TOTAL_KEY_TITLE;

const isTotalStat = (stat) => TOTAL_SLUGS.has(normText(stat?.slug));

function findStatForKeyItem(keyItem, stats) {
  const list = Array.isArray(stats) ? stats : [];
  const k = normKey(keyItem?.key);
  if (k !== null) {
    const byKey = list.find((s) => !isTotalStat(s) && normKey(s?.key) === k);
    if (byKey) return byKey;
  }
  const t = normText(keyItem?.title);
  if (!t) return null;
  return list.find((s) => !isTotalStat(s) && normText(s?.title) === t) || null;
}

function findTotalStat(stats) {
  const list = Array.isArray(stats) ? stats : [];
  return list.find((s) => isTotalStat(s)) || null;
}

function syncKeyWeeksFromStats(keys, stats, opts = {}) {
  const { fallbackTotal = null } = opts;
  return (Array.isArray(keys) ? keys : []).map((keyItem) => {
    if (isTotalKeyItem(keyItem)) {
      const total = findTotalStat(stats);
      if (total) return { ...keyItem, week: num(total.value) };
      return fallbackTotal === null
        ? keyItem
        : { ...keyItem, week: num(fallbackTotal) };
    }
    const matched = findStatForKeyItem(keyItem, stats);
    return matched ? { ...keyItem, week: num(matched.value) } : keyItem;
  });
}

function sumKeyWeeksFromCourses(keys, courses) {
  const list = Array.isArray(courses) ? courses : [];
  return (Array.isArray(keys) ? keys : []).map((keyItem) => {
    const total = isTotalKeyItem(keyItem);
    let sum = 0;
    let matched = false;
    for (const course of list) {
      const stat = total
        ? findTotalStat(course?.statistics)
        : findStatForKeyItem(keyItem, course?.statistics);
      if (stat) {
        matched = true;
        sum += num(stat.value);
      }
    }
    return matched ? { ...keyItem, week: sum } : keyItem;
  });
}

function sumAllValuesStatistics(allStats, courses) {
  const list = Array.isArray(courses) ? courses : [];
  return (Array.isArray(allStats) ? allStats : []).map((item) => {
    const slug = normText(item?.slug);
    const k = normKey(item?.key);
    let sum = 0;
    let matched = false;
    for (const course of list) {
      const stats = Array.isArray(course?.statistics) ? course.statistics : [];
      let found = slug ? stats.find((s) => normText(s?.slug) === slug) : null;
      if (!found && k !== null) {
        found = stats.find((s) => normKey(s?.key) === k);
      }
      if (found) {
        matched = true;
        sum += num(found.value);
      }
    }
    return matched ? { ...item, value: sum } : item;
  });
}

const sumCoursesTotal = (courses) =>
  (Array.isArray(courses) ? courses : []).reduce(
    (acc, c) => acc + num(c?.total),
    0,
  );

module.exports = {
  TOTAL_SLUGS,
  TOTAL_KEY_TITLE,
  isTotalKeyItem,
  isTotalStat,
  findStatForKeyItem,
  findTotalStat,
  syncKeyWeeksFromStats,
  sumKeyWeeksFromCourses,
  sumAllValuesStatistics,
  sumCoursesTotal,
};
