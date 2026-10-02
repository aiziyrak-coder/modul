"use strict";

const STAT_SLUG_TO_KEY = {
  nazariy_va_amaliy_talim: "theoreticalPractical",
  attestatsiyalar: "certification",
  kredit_talim_tizimiga_kirish: "creditSystem",
  malakaviy_amaliyot: "qualification",
  yakuniy_davlat_attestatsiyasi: "final",
  tatil_haftalari_soni: "vacation",
  tatil_xaftalar_soni: "vacation",
  gpa_korsatkichini_hisoblash: "gpa",
  hammasi: "all",
};

const STAT_LEGEND_TO_KEY = {
  A: "certification",
  K: "creditSystem",
  M: "qualification",
  D: "final",
  T: "vacation",
  G: "gpa",
};

function statisticsMap(statistics) {
  if (!statistics) return {};
  if (!Array.isArray(statistics)) return statistics;

  const out = {};
  for (const item of statistics) {
    if (!item) continue;
    const key =
      STAT_SLUG_TO_KEY[item.slug] ||
      STAT_LEGEND_TO_KEY[String(item.key || "").trim()];
    if (!key) continue;
    out[key] = item.value;
  }
  if (out.all != null && out.total == null) out.total = out.all;
  return out;
}

module.exports = { statisticsMap, STAT_SLUG_TO_KEY, STAT_LEGEND_TO_KEY };
