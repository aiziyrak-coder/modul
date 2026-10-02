const SUMMARY_ROW_TITLE_MAX = 200;
const SUMMARY_ROWS_MAX = 20;
const TOTAL_TITLES = new Set(["jami", "hammasi", "total", "итого", "всего"]);

function normKey(key) {
  if (key === null || key === undefined) return null;
  return String(key).trim() || " ";
}

function deriveSummaryRows(summary) {
  if (!Array.isArray(summary)) return null;
  const seen = new Set();
  const rows = [];
  for (const row of summary) {
    const clean = normRow(row);
    if (!clean || seen.has(clean.key)) continue;
    seen.add(clean.key);
    rows.push(clean);
    if (rows.length === SUMMARY_ROWS_MAX) break;
  }
  return rows.length ? rows : null;
}

function normRow(row) {
  const key = normKey(row?.key);
  const title = typeof row?.title === "string" ? row.title.trim() : "";
  if (key === null || !title || TOTAL_TITLES.has(title.toLowerCase())) return null;
  return { key, title: title.slice(0, SUMMARY_ROW_TITLE_MAX) };
}

function countKeylessRows(summary) {
  if (!Array.isArray(summary)) return 0;
  return summary.filter((row) => row && normKey(row.key) === null).length;
}

function orderByLabels(items, summaryRows, keyOf) {
  const list = Array.isArray(items) ? items : [];
  const used = new Set();
  const out = [];
  for (const row of Array.isArray(summaryRows) ? summaryRows : []) {
    const key = normKey(row?.key);
    if (key === null) continue;
    const idx = list.findIndex((item, i) => !used.has(i) && normKey(keyOf(item)) === key);
    if (idx === -1) continue;
    used.add(idx);
    out.push({ item: list[idx], label: row.title || null });
  }
  list.forEach((item, i) => {
    if (!used.has(i)) out.push({ item, label: null });
  });
  return out;
}

module.exports = {
  deriveSummaryRows,
  countKeylessRows,
  orderByLabels,
  SUMMARY_ROW_TITLE_MAX,
  SUMMARY_ROWS_MAX,
};
