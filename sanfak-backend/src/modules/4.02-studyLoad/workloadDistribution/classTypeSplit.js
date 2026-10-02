"use strict";

const SCALAR_OWNER_ORDER = Object.freeze([
  "amaliy",
  "seminar",
  "laboratoriya",
  "klinik_amaliyot",
]);

const LECTURE_SLUG = "maruza";

const LECTURE_OTHER_WORK_KEYS = new Set([
  "special",
  "open_department",
  "open_integral",
  "openLecture.department",
  "openLecture.integral",
  "yada_umumiy",
  "ochiq_kafedra",
  "ochiq_integral",
]);

const slugOf = (ct) => String((ct && ct.slug) || "");
const hasHours = (ct) => (Number(ct && ct.stream) || 0) > 0;

function plannedSlugs(classTypes) {
  const list = Array.isArray(classTypes) ? classTypes : [];
  return list.filter(hasHours).map(slugOf).filter(Boolean);
}

function normalizeClassTypeSlugs(sourceClassTypes, raw) {
  if (raw === undefined || raw === null) return { slugs: [], error: null };
  if (!Array.isArray(raw)) {
    return { slugs: [], error: "classTypeSlugs massiv bo'lishi kerak" };
  }
  const planned = plannedSlugs(sourceClassTypes);
  const bad = raw.map((x) => String(x || "").trim()).find((slug) => !planned.includes(slug));
  if (bad !== undefined) {
    return { slugs: [], error: `Dars turi topilmadi / rejalashtirilmagan: ${bad || "(bo'sh)"}` };
  }
  const seen = new Set(raw.map((x) => String(x).trim()));
  const all = seen.size === 0 || seen.size === planned.length;
  return { slugs: all ? [] : planned.filter((slug) => seen.has(slug)), error: null };
}

function scalarOwnerSlug(sourceClassTypes) {
  const planned = plannedSlugs(sourceClassTypes);
  for (const slug of SCALAR_OWNER_ORDER) {
    if (planned.includes(slug)) return slug;
  }
  return planned.length > 0 ? planned[0] : null;
}

function classTypesIntersect(a, b) {
  const A = Array.isArray(a) ? a : [];
  const B = Array.isArray(b) ? b : [];
  if (A.length === 0 || B.length === 0) return true;
  return A.some((s) => B.includes(s));
}

function applyClassTypeFilter(sw, slugs, ownerSlug) {
  const classTypes = Array.isArray(sw && sw.classTypes) ? sw.classTypes : [];
  const items = Array.isArray(sw && sw.items) ? sw.items : [];
  const split = Array.isArray(slugs) && slugs.length > 0;
  const ownsScalars = !split || (ownerSlug != null && slugs.includes(ownerSlug));
  if (split) {
    zeroUnselectedTypes(classTypes, slugs);
    if (!ownsScalars) zeroOwnerOnlyParts(sw, items);
    recomputeDerived(sw, classTypes);
  }
  return {
    teachingHour: sumOf(classTypes, "total"),
    itemsSum: sumOf(items, "value"),
    ownsScalars,
  };
}

function zeroUnselectedTypes(classTypes, slugs) {
  for (const ct of classTypes) {
    if (!slugs.includes(slugOf(ct))) {
      ct.stream = 0;
      ct.total = 0;
    }
  }
}

function zeroOwnerOnlyParts(sw, items) {
  for (const it of items) it.value = 0;
  if (sw.thisSemester) sw.thisSemester.independentHour = 0;
}

function recomputeDerived(sw, classTypes) {
  sw.thisSemester = sw.thisSemester || {};
  const planAuditorium = sumOf(classTypes, "stream");
  const independentHour = Number(sw.thisSemester.independentHour) || 0;
  sw.thisSemester.auditoriumHour = planAuditorium;
  sw.thisSemester.teachingAuditoriumHour = sumOf(classTypes, "total");
  sw.thisSemester.totalHour = planAuditorium + independentHour;
}

function sumOf(list, field) {
  return list.reduce((s, x) => s + (Number(x && x[field]) || 0), 0);
}

function splitOtherWork(sourceBlock) {
  const items = otherWorkItems(sourceBlock);
  const isLecture = (it) => LECTURE_OTHER_WORK_KEYS.has(otherWorkKey(it));
  const lecture = sumOf(items.filter(isLecture), "value");
  const owner =
    sumOf(items.filter((it) => !isLecture(it)), "value") +
    (Number(sourceBlock && sourceBlock.leadership) || 0);
  return { lecture, owner, total: lecture + owner };
}

function otherWorkItems(sourceBlock) {
  const ow = sourceBlock && sourceBlock.otherWork;
  return Array.isArray(ow && ow.items) ? ow.items : [];
}

function otherWorkKey(it) {
  return String((it && (it.canonical || it.slug)) || "");
}

function partTaken(sameSourceBlocks, slug) {
  return sameSourceBlocks.some((b) => {
    const s = b && b.classTypeSlugs;
    return !Array.isArray(s) || s.length === 0 || s.includes(slug);
  });
}

function isWholeBlock(b) {
  const s = b && b.classTypeSlugs;
  return !Array.isArray(s) || s.length === 0;
}

function partSlugs(plannedSlugs) {
  const planned = Array.isArray(plannedSlugs) ? plannedSlugs : [];
  const ownerSlug = scalarOwnerSlug(planned.map((slug) => ({ slug, stream: 1 })));
  return { lectureSlug: planned.includes(LECTURE_SLUG) ? LECTURE_SLUG : ownerSlug, ownerSlug };
}

function sumUntaken(parts, existing, { lectureSlug, ownerSlug }, slugs) {
  const takes = (slug) =>
    Boolean(slug) && (slugs === null || slugs.includes(slug)) && !partTaken(existing, slug);
  return (takes(lectureSlug) ? parts.lecture : 0) + (takes(ownerSlug) ? parts.owner : 0);
}

function nonAuditHourFor({ sourceBlock, sameSourceBlocks, classTypeSlugs, plannedSlugs }) {
  const parts = splitOtherWork(sourceBlock);
  const slugs = Array.isArray(classTypeSlugs) ? classTypeSlugs : [];
  const existing = Array.isArray(sameSourceBlocks) ? sameSourceBlocks : [];
  const owners = partSlugs(plannedSlugs);
  if (slugs.length > 0) return sumUntaken(parts, existing, owners, slugs);
  if (existing.length === 0) return parts.total;
  if (existing.some(isWholeBlock)) return 0;
  return sumUntaken(parts, existing, owners, null);
}

function lectureNeedsStream(classTypeSlugs, streams) {
  const slugs = Array.isArray(classTypeSlugs) ? classTypeSlugs : [];
  if (slugs.length === 0 || !slugs.includes(LECTURE_SLUG)) return false;
  const list = Array.isArray(streams) ? streams : [];
  return !list.some((s) => Array.isArray(s && s.groups) && s.groups.length > 0);
}

function classTypeLabel(block) {
  const slugs = Array.isArray(block && block.classTypeSlugs) ? block.classTypeSlugs : [];
  if (slugs.length === 0) return "";
  const classTypes = Array.isArray(block.studyWork && block.studyWork.classTypes)
    ? block.studyWork.classTypes
    : [];
  return slugs
    .map((slug) => {
      const ct = classTypes.find((c) => slugOf(c) === slug);
      return (ct && ct.title) || slug;
    })
    .join(", ");
}

module.exports = {
  SCALAR_OWNER_ORDER,
  LECTURE_SLUG,
  LECTURE_OTHER_WORK_KEYS,
  plannedSlugs,
  splitOtherWork,
  nonAuditHourFor,
  lectureNeedsStream,
  normalizeClassTypeSlugs,
  scalarOwnerSlug,
  classTypesIntersect,
  applyClassTypeFilter,
  classTypeLabel,
};
