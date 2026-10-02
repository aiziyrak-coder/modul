function _normalize(str) {
  return (str || "")
    .toLowerCase()
    .replace(/['\u2019\u2018\u02BC`\u00B4]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function _slugify(text) {
  if (!text) return "unknown";
  return (
    _normalize(text)
      .replace(/[^\w\s\u0400-\u04FF]/g, " ")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "unknown"
  );
}

function _indexStats(statsArray) {
  const idx = {};
  if (!Array.isArray(statsArray)) return idx;
  for (const s of statsArray) {
    const value = Number(s.value) || 0;
    if (s.key) idx[s.key] = value;
    if (s.slug) idx[s.slug] = value;
  }
  return idx;
}

function _buildSummaryByKey(summary) {
  const map = {};
  if (!Array.isArray(summary)) return map;
  for (const s of summary) {
    if (s && s.key) map[s.key] = s;
  }
  return map;
}

function calculateAcademicStatistics(data) {
  if (!data || !data.courses) {
    throw new Error("Noto'g'ri ma'lumot formati: 'courses' maydoni topilmadi.");
  }

  const totals = {};
  let totalWeeks = 0;

  for (const course of data.courses) {
    const stats = course.statistics;
    if (!Array.isArray(stats)) continue;

    for (const s of stats) {
      const value = Number(s.value) || 0;
      const slug = s.slug || "";
      const key = s.key;
      if (slug === "hammasi" || slug === "all" || key === null && slug === "") {
        totalWeeks += value;
      } else if (slug === "hammasi" || slug === "all") {
        totalWeeks += value;
      } else {
        if (key) totals[key] = (totals[key] || 0) + value;
        if (slug) totals[slug] = (totals[slug] || 0) + value;
      }
    }
  }

  const summaryByKey = _buildSummaryByKey(data.summary);

  const keys = (data.keys || []).map((k) => {
    let week = 0;
    if (k.key && totals[k.key] !== undefined) {
      week = totals[k.key];
    } else if (k.title) {
      const slug = _slugify(k.title);
      if (totals[slug] !== undefined) week = totals[slug];
    }

    const summaryRow = k.key ? summaryByKey[k.key] : null;
    const semester =
      summaryRow && summaryRow.semester !== null && summaryRow.semester !== undefined && summaryRow.semester !== ""
        ? String(summaryRow.semester)
        : null;

    return {
      key: k.key,
      title: k.title,
      week,
      semester,
    };
  });

  keys.push({ key: " ", title: "JAMI", week: totalWeeks, semester: null });

  return { keys, title: null };
}

module.exports = {
  academicStatistics: calculateAcademicStatistics,
};
