"use strict";

const {
  moduleTypeLabel,
} = require("#modules/4.02-studyLoad/_shared/electiveBlock");
const {
  collectClinicalPrefixes,
  isClinicalRow,
  applyClinicalSplit,
} = require("#modules/4.02-studyLoad/_shared/clinicalPractice");
const {
  CLINICAL_PRACTICE_SHARE,
} = require("#modules/4.02-studyLoad/workload/workload.model");

const HOUR_ITEM_SLUG_BY_CANONICAL = Object.freeze({
  lecture: "maruza",
  seminar: "seminar",
  laboratory: "laboratoriya",
  practical: "amaliy",
  independent: "mustaqil",
});

const META_FIELDS = Object.freeze([
  "academicYear",
  "code",
  "serialNumber",
  "semester",
  "credits",
  "moduleType",
  "weeklyHours",
  "totalHours",
  "classroomHours",
  "independentHours",
  "lectureHours",
  "seminarHours",
  "labHours",
  "practicalHours",
  "hourItems",
]);

const buildHourItems = (particle) =>
  (Array.isArray(particle) ? particle : [])
    .filter((p) => p && HOUR_ITEM_SLUG_BY_CANONICAL[p.canonical])
    .map((p) => ({
      slug: HOUR_ITEM_SLUG_BY_CANONICAL[p.canonical],
      title: p.title || "",
      value: Number(p.value) || 0,
    }));

const findScienceInPlan = (wp, scienceId) => {
  const semestersObj =
    wp?.semesters instanceof Map
      ? Object.fromEntries(wp.semesters)
      : wp?.semesters || {};

  const sortedSemKeys = Object.keys(semestersObj).sort(
    (a, b) => Number(a) - Number(b),
  );

  for (const semKey of sortedSemKeys) {
    const semData = semestersObj[semKey];
    if (!semData) continue;
    for (const block of semData.blocks || []) {
      const sci = (block.sciences || []).find(
        (x) => x.science?.toString() === String(scienceId),
      );
      if (sci) {
        return { foundSci: sci, foundBlock: block, firstSemester: semKey };
      }
    }
  }
  return null;
};

const buildScienceProgramMeta = ({
  workingPlan,
  foundSci,
  foundBlock,
  semesterKey,
}) => {
  const particleMap = {};
  for (const p of foundSci.particle || []) {
    if (p?.slug) particleMap[p.slug] = Number(p.value) || 0;
    if (p?.canonical) particleMap[p.canonical] = Number(p.value) || 0;
  }
  const p = {
    hour:
      particleMap.hour ||
      particleMap.soat ||
      particleMap.umumiy_yuklamaning_hajmi_soat ||
      0,
    total:
      particleMap.total ||
      particleMap.jami ||
      particleMap.umumiy_yuklamaning_hajmi_soat ||
      0,
    independent: particleMap.independent || particleMap.mustaqil_ta_lim || 0,
    lecture: particleMap.lecture || particleMap.maruza || 0,
  };
  const ws = workingPlan?.workingSchedule || {};

  const classroomHrs = p.total || null;

  return {
    academicYear: ws.academicYear || null,
    code: foundSci.code || null,
    serialNumber: foundSci.serialNumber || null,
    semester: semesterKey,
    credits: foundSci.totalCredit || null,
    moduleType: moduleTypeLabel(foundBlock),
    weeklyHours: foundSci.weeklyHours || null,
    totalHours: p.hour || p.total || null,
    classroomHours: classroomHrs,
    independentHours: p.independent || null,
    lectureHours: p.lecture || null,
    seminarHours: particleMap.seminar || null,
    labHours: particleMap.laboratory || null,
    practicalHours: particleMap.practical || particleMap.amaliy || null,
    hourItems: buildHourItems(foundSci.particle),
  };
};

const AUDITORIUM_SLUG_ORDER = Object.freeze([
  "maruza",
  "amaliy",
  "seminar",
  "laboratoriya",
  "klinik_amaliyot",
]);

const CLINICAL_SLUG = "klinik_amaliyot";
const CLINICAL_TITLE = "Klinik o'quv amaliyoti";

const SPLIT_KEY_BY_SLUG = Object.freeze({
  maruza: "lecture",
  seminar: "seminar",
  laboratoriya: "laboratory",
  amaliy: "practical",
  klinik_amaliyot: "clinical",
});

const orderAuditoriumItems = (hourItems) => {
  const bySlug = new Map();
  for (const item of Array.isArray(hourItems) ? hourItems : []) {
    if (!item || !AUDITORIUM_SLUG_ORDER.includes(item.slug)) continue;
    bySlug.set(item.slug, {
      slug: item.slug,
      title: item.title || "",
      value: Number(item.value) || 0,
    });
  }
  return AUDITORIUM_SLUG_ORDER.filter((slug) => bySlug.has(slug)).map((slug) =>
    bySlug.get(slug),
  );
};

const isClinicalSubject = ({ foundSci, foundBlock } = {}) => {
  const rows = foundBlock?.sciences;
  if (!Array.isArray(rows)) return null;
  return isClinicalRow(foundSci, collectClinicalPrefixes(rows));
};

const applyClinicalHourSplit = (
  hourItems,
  { isClinical = false, share = CLINICAL_PRACTICE_SHARE } = {},
) => {
  const items = orderAuditoriumItems(hourItems);
  if (!isClinical) return { items, clamped: false, derived: false };

  const input = {
    lecture: 0,
    seminar: 0,
    laboratory: 0,
    practical: 0,
    clinical: 0,
  };
  for (const item of items) {
    const key = SPLIT_KEY_BY_SLUG[item.slug];
    if (key) input[key] = item.value;
  }

  const split = applyClinicalSplit(input, { share });

  const next = items.map((item) => ({
    ...item,
    value: split[SPLIT_KEY_BY_SLUG[item.slug]],
  }));
  if (!next.some((item) => item.slug === CLINICAL_SLUG)) {
    next.push({
      slug: CLINICAL_SLUG,
      title: CLINICAL_TITLE,
      value: split.clinical,
    });
  }

  return {
    items: orderAuditoriumItems(next),
    clamped: split.clamped,
    derived: split.derived,
  };
};

const NO_HOUR_ITEMS_WARNING =
  "Ishchi o'quv rejada bu fan uchun dars turlari bo'yicha soat ko'rsatilmagan.";
const CLINICAL_CLAMPED_WARNING =
  "Klinik o'quv amaliyoti soati amaliy mashg'ulot soatidan oshib ketdi — amaliy soat bilan chegaralandi.";
const CLINICAL_UNKNOWN_WARNING =
  "Fanning klinik bo'limga tegishliligini aniqlab bo'lmadi — klinik o'quv amaliyoti soati hisoblanmadi.";

const buildPlanHours = ({
  workingPlan,
  foundSci,
  foundBlock,
  semesterKey,
}) => {
  const meta = buildScienceProgramMeta({
    workingPlan,
    foundSci,
    foundBlock,
    semesterKey,
  });

  const clinical = isClinicalSubject({ foundSci, foundBlock });
  const { items, clamped } = applyClinicalHourSplit(meta.hourItems, {
    isClinical: clinical === true,
  });

  const warnings = [];
  if (!items.length) warnings.push(NO_HOUR_ITEMS_WARNING);
  if (clamped) warnings.push(CLINICAL_CLAMPED_WARNING);
  if (clinical === null) warnings.push(CLINICAL_UNKNOWN_WARNING);

  const sum = items.reduce((acc, item) => acc + item.value, 0);
  if (items.length && meta.classroomHours != null && sum !== meta.classroomHours) {
    warnings.push(
      `Auditoriya soati (${meta.classroomHours}) dars turlari yig'indisiga (${sum}) mos emas.`,
    );
  }

  return {
    items,
    classroomHours: meta.classroomHours,
    independentHours: meta.independentHours,
    totalHours: meta.totalHours,
    credits: meta.credits,
    weeklyHours: meta.weeklyHours,
    semester: meta.semester,
    code: meta.code,
    serialNumber: meta.serialNumber,
    moduleType: meta.moduleType,
    warnings,
    ...(clinical === null ? { clinicalUnknown: true } : {}),
  };
};

module.exports = {
  HOUR_ITEM_SLUG_BY_CANONICAL,
  META_FIELDS,
  buildHourItems,
  findScienceInPlan,
  buildScienceProgramMeta,
  AUDITORIUM_SLUG_ORDER,
  orderAuditoriumItems,
  isClinicalSubject,
  applyClinicalHourSplit,
  buildPlanHours,
};
