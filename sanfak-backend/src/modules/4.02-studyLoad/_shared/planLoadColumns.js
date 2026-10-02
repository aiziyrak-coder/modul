"use strict";

const { CANONICAL } = require("#shared/particleHelpers");

const PLAN_CANONICAL = Object.freeze({
  ...CANONICAL,
  CLINICAL_PRACTICE: "clinicalPractice",
  COURSE_WORK: "courseWork",
});

const LOAD_ZONE = Object.freeze({
  UMUMIY: "umumiy",
  AUDITORIYA: "auditoriya",
  MUSTAQIL: "mustaqil",
});

const LOAD_COLUMNS = Object.freeze([
  { canonical: PLAN_CANONICAL.HOUR, slug: "soat", title: "soat", zone: LOAD_ZONE.UMUMIY },
  { canonical: PLAN_CANONICAL.PERCENT, slug: "foiz", title: "%", zone: LOAD_ZONE.UMUMIY },
  { canonical: PLAN_CANONICAL.TOTAL, slug: "jami", title: "Jami", zone: LOAD_ZONE.AUDITORIYA },
  { canonical: PLAN_CANONICAL.LECTURE, slug: "maruza", title: "Ma'ruza", zone: LOAD_ZONE.AUDITORIYA },
  { canonical: PLAN_CANONICAL.PRACTICAL, slug: "amaliy", title: "Amaliy", zone: LOAD_ZONE.AUDITORIYA },
  {
    canonical: PLAN_CANONICAL.LABORATORY,
    slug: "laboratoriya",
    title: "Laboratoriya",
    zone: LOAD_ZONE.AUDITORIYA,
  },
  { canonical: PLAN_CANONICAL.SEMINAR, slug: "seminar", title: "Seminar", zone: LOAD_ZONE.AUDITORIYA },
  {
    canonical: PLAN_CANONICAL.CLINICAL_PRACTICE,
    slug: "klinik_oquv_amaliyoti",
    title: "Klinik o'quv amaliyoti",
    zone: LOAD_ZONE.AUDITORIYA,
    optional: true,
  },
  {
    canonical: PLAN_CANONICAL.COURSE_WORK,
    slug: "kurs_ishi",
    title: "Kurs ishi",
    zone: LOAD_ZONE.AUDITORIYA,
    optional: true,
  },
  {
    canonical: PLAN_CANONICAL.INDEPENDENT,
    slug: "mustaqil_talim",
    title: "Mustaqil ta'lim",
    zone: LOAD_ZONE.MUSTAQIL,
  },
]);

const normTitle = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[ʻʼʽʾʿ`´‘’‚‛]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const matchesColumn = (item, col) => {
  if (!item) return false;
  if (item.canonical && item.canonical === col.canonical) return true;
  if (item.slug && item.slug === col.slug) return true;
  const t = normTitle(item.title);
  return Boolean(t) && t === normTitle(col.title);
};

const findLoadItem = (items, col) => (items || []).find((it) => matchesColumn(it, col)) || null;

const withStandardLoadItems = (items) => {
  const src = Array.isArray(items) ? items : [];
  const used = new Set();
  const out = [];
  for (const col of LOAD_COLUMNS) {
    const found = findLoadItem(src, col);
    if (found) {
      used.add(found);
      out.push(found);
    } else {
      out.push({
        slug: col.slug,
        title: col.title,
        canonical: col.canonical,
        colNum: null,
        synthetic: true,
      });
    }
  }
  for (const it of src) if (!used.has(it)) out.push(it);
  return out;
};

const resolveLoadColumns = (items) =>
  LOAD_COLUMNS.map((col) => {
    const it = findLoadItem(items, col);
    return {
      canonical: col.canonical,
      slug: it?.slug || col.slug,
      zone: col.zone,
      title: (it?.title && String(it.title).trim()) || col.title,
      colNum: it?.colNum != null ? +it.colNum : null,
      optional: Boolean(col.optional),
      synthetic: !it,
    };
  });

module.exports = {
  PLAN_CANONICAL,
  LOAD_ZONE,
  LOAD_COLUMNS,
  withStandardLoadItems,
  resolveLoadColumns,
  findLoadItem,
};
