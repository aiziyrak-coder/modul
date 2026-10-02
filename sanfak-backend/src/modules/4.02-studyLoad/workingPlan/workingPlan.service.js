"use strict";

const mongoose = require("mongoose");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const ScienceModel = require("#references/science/science.model");
const AssessmentTypeModel = require("#references/assessmentType/assessmentType.model");
const WorkingPlanModel = require("./workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { toGlobalSemKey } = require("#modules/4.02-studyLoad/_shared/semesterKey");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { isEmptySlotRow } = require("#modules/4.02-studyLoad/_shared/electiveSlotRow");
const { freeQuotaAt } = require("#modules/4.02-studyLoad/_shared/electiveQuota");
const ScienceProgramModel = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const SyllabusModel = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const {
  isElectiveBlock,
  isElectiveSlotRow,
  MAX_ALTERNATIVES,
} = require("#modules/4.02-studyLoad/_shared/electiveBlock");
const {
  assertElectiveScience,
  assertElectiveScienceIds,
} = require("#modules/4.02-studyLoad/_shared/electiveCatalog");
const { usageScopeOfSchedule } = require("#modules/4.02-studyLoad/_shared/scheduleUsageScope");
const {
  isLocked,
  lockedMessage,
  LOCKED_STATUSES,
} = require("#modules/4.02-studyLoad/_shared/editableStatus");

const SIGNED_STATUSES = LOCKED_STATUSES;

const SCIENCE_PATHS = Object.freeze({
  scienceProgram: "science",
  syllabus: "science",
  workload: "directions.blocks.science",
  workloadDistribution: "teachers.blocks.science",
});

const EMPTY_BUCKET = () => ({ total: 0, signed: 0 });

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

const matchesOld = (row, old) => {
  if (!row) return false;
  if (old.science) return sameId(row.science, old.science);
  return Boolean(old.code) && row.code === old.code;
};

const matchesTarget = (row, target) => {
  if (!row) return false;
  if (row.science) return sameId(row.science, target._id);
  return Boolean(target.scienceCode) && row.code === target.scienceCode;
};

const applyIdentity = (row, target) => {
  row.code = target.scienceCode || null;
  row.title = target.title || null;
  row.science = target._id;
  row.department = target.department || null;
};

const electiveRowsMatching = (plan, old) => {
  const rows = [];
  const semesters = plan.semesters;
  if (!semesters) return rows;

  const entries =
    semesters instanceof Map
      ? [...semesters.entries()]
      : Object.entries(semesters);

  for (const [, semData] of entries) {
    if (!semData) continue;
    for (const block of semData.blocks || []) {
      if (!isElectiveBlock(block)) continue;
      for (const row of block.sciences || []) {
        if (matchesOld(row, old)) rows.push(row);
      }
    }
  }
  return rows;
};

const applyToWorkingPlan = (plan, old, target) => {
  const rows = electiveRowsMatching(plan, old);
  rows.forEach((row) => applyIdentity(row, target));
  return rows.length;
};

const sameCode = (a, b) =>
  String(a || "")
    .trim()
    .toUpperCase() ===
  String(b || "")
    .trim()
    .toUpperCase();

const locateStudyPlanRows = (studyPlan, blockCode, old) => {
  const rows = [];
  for (const block of studyPlan.blocks || []) {
    if (!sameCode(block.blockCode, blockCode)) continue;
    if (!isElectiveBlock(block)) continue;
    for (const row of block.sciences || []) {
      if (matchesOld(row, old)) rows.push(row);
    }
  }
  return rows;
};

const studyPlanHasTarget = (studyPlan, blockCode, target, exclude) => {
  for (const block of studyPlan.blocks || []) {
    if (!sameCode(block.blockCode, blockCode)) continue;
    if (!isElectiveBlock(block)) continue;
    for (const row of block.sciences || []) {
      if (exclude.includes(row)) continue;
      if (matchesTarget(row, target)) return true;
    }
  }
  return false;
};

const countScienceUsage = async ({
  science,
  academicYear = null,
  year = null,
  direction = null,
}) => {
  const empty = {
    science: science ? String(science) : null,
    scienceProgram: EMPTY_BUCKET(),
    syllabus: EMPTY_BUCKET(),
    workload: EMPTY_BUCKET(),
    workloadDistribution: EMPTY_BUCKET(),
    total: 0,
    signedTotal: 0,
    signed: [],
  };

  if (!science) return empty;

  const yearFilter = academicYear ? { academicYear } : {};
  const sylYearFilter = year != null ? { year: Number(year) } : {};
  const signed = { status: { $in: SIGNED_STATUSES } };

  const dirFilter = direction ? { directions: direction } : {};
  const spFilter = {
    [SCIENCE_PATHS.scienceProgram]: science,
    ...yearFilter,
    ...dirFilter,
  };
  const sylFilter = {
    [SCIENCE_PATHS.syllabus]: science,
    ...sylYearFilter,
    ...dirFilter,
  };
  const wFilter = direction
    ? {
        directions: { $elemMatch: { direction, "blocks.science": science } },
        ...yearFilter,
      }
    : { [SCIENCE_PATHS.workload]: science, ...yearFilter };
  const wdFilter = {
    [SCIENCE_PATHS.workloadDistribution]: science,
    ...yearFilter,
  };

  const [
    spTotal,
    spSigned,
    sylTotal,
    sylSigned,
    wTotal,
    wSigned,
    wdTotal,
    wdSigned,
  ] = await Promise.all([
    ScienceProgramModel.countDocuments(spFilter),
    ScienceProgramModel.countDocuments({ ...spFilter, ...signed }),
    SyllabusModel.countDocuments(sylFilter),
    SyllabusModel.countDocuments({ ...sylFilter, ...signed }),
    WorkloadModel.countDocuments(wFilter),
    WorkloadModel.countDocuments({ ...wFilter, ...signed }),
    WorkloadDistributionModel.countDocuments(wdFilter),
    WorkloadDistributionModel.countDocuments({ ...wdFilter, ...signed }),
  ]);

  const usage = {
    science: String(science),
    scienceProgram: { total: spTotal, signed: spSigned },
    syllabus: { total: sylTotal, signed: sylSigned },
    workload: { total: wTotal, signed: wSigned },
    workloadDistribution: { total: wdTotal, signed: wdSigned },
    total: spTotal + sylTotal + wTotal + wdTotal,
    signedTotal: spSigned + sylSigned + wSigned + wdSigned,
    signed: [],
  };

  usage.signed = Object.keys(SCIENCE_PATHS)
    .filter((key) => usage[key].signed > 0)
    .map((key) => ({ collection: key, count: usage[key].signed }));

  return usage;
};

const signedListText = (usage) =>
  usage.signed.map((s) => `${s.collection}: ${s.count} ta`).join("; ");

const countAffectedPlans = async ({ plan, parent, row, scope }) => {
  if (!plan.studyPlan) return { affected: 0, locked: 0 };

  if (isEmptySlotRow(row)) {
    const plans = await WorkingPlanModel.find({ studyPlan: plan.studyPlan, ...scope })
      .select("workingSchedule")
      .lean();
    const scheduleIds = plans.map((p) => p.workingSchedule).filter(Boolean);
    const schedules = scheduleIds.length
      ? await WorkingScheduleModel.find({ _id: { $in: scheduleIds } })
          .select("status currentCourse")
          .lean()
      : [];
    const sameCourse = schedules.filter(
      (s) => Number(s.currentCourse) === Number(parent?.currentCourse),
    );
    const locked = sameCourse.filter((s) => isLocked(s.status)).length;
    return { affected: sameCourse.length - locked, locked };
  }

  const old = { science: row.science ? String(row.science) : null, code: row.code || null };
  const siblings = await WorkingPlanModel.find({
    studyPlan: plan.studyPlan,
    _id: { $ne: plan._id },
    ...scope,
  })
    .select("semesters")
    .lean();
  const touched = siblings.filter((s) => electiveRowsMatching(s, old).length > 0).length;
  return { affected: 1 + touched, locked: 0 };
};

const getElectiveRowUsage = async ({
  planId,
  semKey,
  blockId,
  scienceRowId,
  year = null,
  scope = {},
}) => {
  const plan = await WorkingPlanModel.findOne({ _id: planId, ...scope })
    .select("studyPlan workingSchedule semesters")
    .lean();
  if (!plan) throw new ErrorHandler(404, "Ishchi o'quv reja topilmadi");

  const semData = plan.semesters?.[String(semKey)];
  const block = (semData?.blocks || []).find((b) => sameId(b._id, blockId));
  const row = (block?.sciences || []).find((s) => sameId(s._id, scienceRowId));
  if (!row) throw new ErrorHandler(404, "Fan qatori topilmadi");

  const parent = plan.workingSchedule
    ? await WorkingScheduleModel.findById(plan.workingSchedule)
        .select("status academicYear year direction currentCourse")
        .lean()
    : null;

  const parentScope = usageScopeOfSchedule(parent);
  const usage = await countScienceUsage({
    science: row.science || null,
    academicYear: parentScope.academicYear,
    year: year != null ? year : parentScope.year,
    direction: parentScope.direction,
  });

  const reach = await countAffectedPlans({ plan, parent, row, scope });

  return {
    workingPlan: String(plan._id),
    studyPlan: plan.studyPlan ? String(plan.studyPlan) : null,
    elective: isElectiveSlotRow(block, row),
    locked: isLocked(parent?.status),
    status: parent?.status || null,
    affectedWorkingPlans: reach.affected,
    lockedWorkingPlans: reach.locked,
    usage,
    canSwap:
      isElectiveSlotRow(block, row) &&
      !isLocked(parent?.status) &&
      Boolean(plan.studyPlan) &&
      usage.signedTotal === 0,
  };
};

const fillQuotaSlot = async ({ plan, parent, semKey, block, row, target, alternatives }) => {
  const currentCourse = parent ? parent.currentCourse : null;
  const globalSemKey = toGlobalSemKey(semKey, currentCourse);
  if (!globalSemKey) {
    throw new ErrorHandler(
      400,
      "Kurs raqami aniqlanmadi — slotning o'quv rejadagi semestrini hisoblab bo'lmaydi",
      `workingSchedule.currentCourse = ${currentCourse}`,
    );
  }
  const { hour, credit } = await clampToFreeQuota(plan.studyPlan, block.blockCode, globalSemKey, row);
  const { addElectiveRow } = require("#modules/4.02-studyLoad/studyPlan/studyPlan.service");
  const added = await addElectiveRow({
    id: plan.studyPlan,
    scope: {},
    body: {
      blockCode: block.blockCode,
      science: String(target._id),
      serialNumber: row.serialNumber,
      semesters: [{ semester: globalSemKey, hour, credit, particle: [] }],
      alternatives: Array.isArray(alternatives) ? alternatives : [],
    },
  });
  const propagated = Number(added.propagation && added.propagation.propagated) || 0;
  return {
    workingPlan: String(plan._id),
    updatedPlans: propagated,
    updatedRows: propagated,
    studyPlanRows: 1,
    persisted: true,
    siblingErrors: [],
    filled: true,
    quota: added.quota || null,
    usage: await countScienceUsage({ science: null }),
    science: { from: { science: null, code: null }, to: scienceSummary(target) },
  };
};

const clampToFreeQuota = async (studyPlanId, blockCode, globalSemKey, row) => {
  const slotHour = Number(row.weeklyHours) || 0;
  const slotCredit = Number(row.totalCredit) || 0;
  const sp = await StudyPlanModel.findById(studyPlanId).select("blocks").lean();
  const spBlock = (sp?.blocks || []).find((b) => b.blockCode === blockCode);
  if (!spBlock) return { hour: slotHour, credit: slotCredit };
  const free = freeQuotaAt(spBlock, String(globalSemKey));
  const hour = Math.min(slotHour, Math.max(0, free.hour));
  const credit = Math.min(slotCredit, Math.max(0, free.credit));
  if (hour <= 0 && credit <= 0) {
    throw new ErrorHandler(
      400,
      "Bu semestrda tanlov kvotasi qolmagan — o'quv rejaga tanlov fani allaqachon qo'shilgan. Ishchi rejani qayta generatsiya qiling yoki o'quv rejadagi qatorni o'chiring",
      `slot: ${slotHour} haftalik / ${slotCredit} kredit, qoldiq: ${free.hour} / ${free.credit}`,
    );
  }
  return { hour, credit };
};

const scienceSummary = (target) => ({
  science: String(target._id),
  code: target.scienceCode || null,
  title: target.title || null,
  department: target.department ? String(target.department) : null,
});

const swapElectiveScience = async ({
  planId,
  semKey,
  blockId,
  scienceRowId,
  scienceId,
  alternatives = null,
  scope = {},
}) => {
  const plan = await WorkingPlanModel.findOne({ _id: planId, ...scope });
  if (!plan) throw new ErrorHandler(404, "Ishchi o'quv reja topilmadi");

  if (!plan.studyPlan) {
    winston.warn(
      `[workingPlan] tanlov almashtirish RAD ETILDI — studyPlan orqaga ko'rsatkichi yo'q (workingPlan=${planId})`,
    );
    throw new ErrorHandler(
      400,
      "Ishchi o'quv reja manba o'quv rejaga bog'lanmagan — tanlov fanini almashtirib bo'lmaydi",
      "workingPlan.studyPlan = null (eski hujjat). Ishchi rejani qayta generatsiya qiling.",
    );
  }

  const parent = await WorkingScheduleModel.findById(plan.workingSchedule)
    .select("status academicYear year direction currentCourse")
    .lean();
  if (!parent) {
    throw new ErrorHandler(
      400,
      "Ishchi o'quv rejaning ota hujjati (jadval) topilmadi — holatni tekshirib bo'lmaydi",
    );
  }
  if (isLocked(parent.status)) {
    throw new ErrorHandler(
      400,
      lockedMessage("Ishchi o'quv reja", parent.status),
    );
  }

  const semData =
    plan.semesters instanceof Map
      ? plan.semesters.get(String(semKey))
      : plan.semesters?.[String(semKey)];
  const block = (semData?.blocks || []).find((b) => sameId(b._id, blockId));
  const row = (block?.sciences || []).find((s) => sameId(s._id, scienceRowId));
  if (!row) throw new ErrorHandler(404, "Fan qatori topilmadi");

  if (!isElectiveSlotRow(block, row)) {
    throw new ErrorHandler(
      400,
      "Faqat tanlov blokidagi fanni almashtirish mumkin — majburiy fanlar o'quv rejadan keladi",
    );
  }

  const target = await ScienceModel.findOne({
    _id: scienceId,
    active: true,
  }).lean();
  if (!target) {
    throw new ErrorHandler(404, "Fan katalogda topilmadi yoki faol emas");
  }
  assertElectiveScience(target);

  const old = {
    science: row.science ? String(row.science) : null,
    code: row.code || null,
  };
  if (old.science && sameId(old.science, target._id)) {
    throw new ErrorHandler(400, "Bu qatorda allaqachon shu fan turibdi");
  }

  const duplicate = (block.sciences || []).some(
    (s) => !sameId(s._id, row._id) && matchesTarget(s, target),
  );
  if (duplicate) {
    throw new ErrorHandler(
      400,
      "Bu fan shu semestrning tanlov blokida allaqachon mavjud",
    );
  }

  if (isEmptySlotRow(row)) {
    return fillQuotaSlot({ plan, parent, semKey, block, row, target, alternatives });
  }
  if (Array.isArray(alternatives) && alternatives.length > 0) {
    throw new ErrorHandler(
      400,
      "`alternatives` faqat bo'sh tanlov slotini to'ldirishda qabul qilinadi — mavjud fan uchun `PUT /working-plans/:id/elective-alternatives`",
    );
  }

  const studyPlan = await StudyPlanModel.findById(plan.studyPlan);
  if (!studyPlan) {
    winston.warn(
      `[workingPlan] tanlov almashtirish RAD ETILDI — manba studyPlan topilmadi (studyPlan=${plan.studyPlan})`,
    );
    throw new ErrorHandler(404, "Manba o'quv reja topilmadi");
  }
  const spRows = locateStudyPlanRows(studyPlan, block.blockCode, old);
  if (spRows.length === 0) {
    winston.warn(
      `[workingPlan] tanlov almashtirish RAD ETILDI — manba studyPlan'da mos tanlov qatori yo'q ` +
        `(studyPlan=${plan.studyPlan} blockCode=${block.blockCode} science=${old.science} code=${old.code})`,
    );
    throw new ErrorHandler(
      404,
      "Manba o'quv rejada mos tanlov fani qatori topilmadi — almashtirish bekor qilindi",
    );
  }
  if (studyPlanHasTarget(studyPlan, block.blockCode, target, spRows)) {
    throw new ErrorHandler(
      400,
      "Bu fan manba o'quv rejaning tanlov blokida allaqachon mavjud",
    );
  }

  const usage = await countScienceUsage({
    science: old.science,
    ...usageScopeOfSchedule(parent),
  });
  if (usage.signedTotal > 0) {
    throw new ErrorHandler(
      400,
      `Bu fanga bog'liq imzolangan hujjatlar bor (${usage.signedTotal} ta) — avval ular qayta ko'rib chiqilishi kerak`,
      signedListText(usage),
    );
  }

  const modified = applyToWorkingPlan(plan, old, target);
  if (modified === 0) {
    throw new ErrorHandler(404, "Almashtiriladigan qator topilmadi");
  }
  plan.markModified("semesters");
  await plan.save();

  const result = {
    workingPlan: String(plan._id),
    updatedPlans: 1,
    updatedRows: modified,
    studyPlanRows: spRows.length,
    persisted: true,
    siblingErrors: [],
    usage,
    science: {
      from: old,
      to: {
        science: String(target._id),
        code: target.scienceCode || null,
        title: target.title || null,
        department: target.department ? String(target.department) : null,
      },
    },
  };

  const siblings = await WorkingPlanModel.find({
    studyPlan: plan.studyPlan,
    _id: { $ne: plan._id },
    ...scope,
  });

  const settled = await Promise.allSettled(
    siblings.map(async (sib) => {
      const n = applyToWorkingPlan(sib, old, target);
      if (n === 0) return { id: String(sib._id), rows: 0 };
      sib.markModified("semesters");
      await sib.save();
      return { id: String(sib._id), rows: n };
    }),
  );

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      if (outcome.value.rows > 0) {
        result.updatedPlans += 1;
        result.updatedRows += outcome.value.rows;
      }
      continue;
    }
    const id = String(siblings[i]?._id);
    winston.error(
      `[workingPlan] qardosh ishchi reja yangilanmadi (workingPlan=${id}): ${outcome.reason?.message}`,
    );
    result.siblingErrors.push({ workingPlan: id, error: outcome.reason?.message });
  }

  try {
    for (const spRow of spRows) applyIdentity(spRow, target);
    await studyPlan.save();
  } catch (err) {
    result.persisted = false;
    result.persistError = err.message;
    winston.error(
      `[workingPlan] write-through YIQILDI — manba studyPlan yozilmadi ` +
        `(studyPlan=${plan.studyPlan} workingPlan=${plan._id}): ${err.message}`,
    );
  }

  return result;
};

const assertDistinctAlternatives = (ids, mainScience) => {
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new ErrorHandler(
        400,
        "Alternativ fanlar takrorlanmasligi kerak",
        `takroriy scienceId: ${id}`,
      );
    }
    seen.add(id);
  }
  if (mainScience && seen.has(String(mainScience))) {
    throw new ErrorHandler(
      400,
      "Asosiy fanning o'zi alternativ bo'la olmaydi",
      `scienceId: ${String(mainScience)}`,
    );
  }
};

const resolveAlternatives = async (items) => {
  const ids = (items || []).map((a) => String(a.scienceId));
  if (ids.length === 0) return [];

  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  const docs = valid.length
    ? await ScienceModel.find({ _id: { $in: valid }, active: true })
        .select("_id scienceCode title department")
        .lean()
    : [];
  const byId = new Map((docs || []).map((d) => [String(d._id), d]));

  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new ErrorHandler(
      400,
      "Alternativ fan katalogda topilmadi yoki faol emas",
      `topilmagan scienceId: ${missing.join(", ")}`,
    );
  }

  return ids.map((id) => {
    const doc = byId.get(id);
    return {
      science: doc._id,
      code: doc.scienceCode || null,
      title: doc.title || null,
      department: doc.department || null,
    };
  });
};

const cloneAlternatives = (resolved) => resolved.map((a) => ({ ...a }));

const toWireAlternative = (a) => ({
  science: String(a.science),
  code: a.code || null,
  title: a.title || null,
  department: a.department ? String(a.department) : null,
});

const setElectiveAlternatives = async ({
  planId,
  semKey,
  blockId,
  scienceRowId,
  alternatives = [],
  scope = {},
}) => {
  const plan = await WorkingPlanModel.findOne({ _id: planId, ...scope });
  if (!plan) throw new ErrorHandler(404, "Ishchi o'quv reja topilmadi");

  if (!plan.studyPlan) {
    winston.warn(
      `[workingPlan] alternativ yozuvi RAD ETILDI — studyPlan orqaga ko'rsatkichi yo'q (workingPlan=${planId})`,
    );
    throw new ErrorHandler(
      400,
      "Ishchi o'quv reja manba o'quv rejaga bog'lanmagan — alternativ saqlab bo'lmaydi",
      "workingPlan.studyPlan = null (eski hujjat). Ishchi rejani qayta generatsiya qiling.",
    );
  }

  const parent = await WorkingScheduleModel.findById(plan.workingSchedule)
    .select("status")
    .lean();
  if (!parent) {
    throw new ErrorHandler(
      400,
      "Ishchi o'quv rejaning ota hujjati (jadval) topilmadi — holatni tekshirib bo'lmaydi",
    );
  }
  if (isLocked(parent.status)) {
    throw new ErrorHandler(
      400,
      lockedMessage("Ishchi o'quv reja", parent.status),
    );
  }

  const semData =
    plan.semesters instanceof Map
      ? plan.semesters.get(String(semKey))
      : plan.semesters?.[String(semKey)];
  const block = (semData?.blocks || []).find((b) => sameId(b._id, blockId));
  const row = (block?.sciences || []).find((s) => sameId(s._id, scienceRowId));
  if (!row) throw new ErrorHandler(404, "Fan qatori topilmadi");

  if (!isElectiveBlock(block)) {
    throw new ErrorHandler(
      400,
      "Faqat tanlov blokidagi fanga alternativ qo'shish mumkin — majburiy fanning alternativi bo'lmaydi",
    );
  }

  const items = alternatives || [];
  if (items.length > MAX_ALTERNATIVES) {
    throw new ErrorHandler(
      400,
      `Bitta tanlov slotiga ko'pi bilan ${MAX_ALTERNATIVES} ta alternativ qo'shish mumkin`,
    );
  }
  assertDistinctAlternatives(
    items.map((a) => String(a.scienceId)),
    row.science,
  );
  const existingAltIds = new Set(
    (row.alternatives || []).map((a) => String(a?.science ?? "")),
  );
  await assertElectiveScienceIds(
    items.map((a) => String(a.scienceId)).filter((id) => !existingAltIds.has(id)),
  );
  const resolved = await resolveAlternatives(items);

  const studyPlan = await StudyPlanModel.findById(plan.studyPlan);
  if (!studyPlan) {
    winston.warn(
      `[workingPlan] alternativ yozuvi RAD ETILDI — manba studyPlan topilmadi (studyPlan=${plan.studyPlan})`,
    );
    throw new ErrorHandler(404, "Manba o'quv reja topilmadi");
  }
  const old = {
    science: row.science ? String(row.science) : null,
    code: row.code || null,
  };
  const spRows = locateStudyPlanRows(studyPlan, block.blockCode, old);
  if (spRows.length === 0) {
    winston.warn(
      `[workingPlan] alternativ yozuvi RAD ETILDI — manba studyPlan'da mos tanlov qatori yo'q ` +
        `(studyPlan=${plan.studyPlan} blockCode=${block.blockCode} science=${old.science} code=${old.code})`,
    );
    throw new ErrorHandler(
      404,
      "Manba o'quv rejada mos tanlov fani qatori topilmadi — alternativ saqlanmadi",
    );
  }

  row.alternatives = cloneAlternatives(resolved);
  plan.markModified("semesters");
  await plan.save();

  const result = {
    workingPlan: String(plan._id),
    studyPlan: String(plan.studyPlan),
    updatedRows: 1,
    studyPlanRows: spRows.length,
    persisted: true,
    alternatives: resolved.map(toWireAlternative),
  };

  try {
    for (const spRow of spRows) spRow.alternatives = cloneAlternatives(resolved);
    await studyPlan.save();
  } catch (err) {
    result.persisted = false;
    result.persistError = err.message;
    winston.error(
      `[workingPlan] write-through YIQILDI — manba studyPlan yozilmadi ` +
        `(studyPlan=${plan.studyPlan} workingPlan=${plan._id}): ${err.message}`,
    );
  }

  return result;
};

const resolveAssessmentTypeTitle = async (refId) => {
  if (refId === "" || refId === null || refId === undefined) return null;
  const doc = await AssessmentTypeModel.findById(refId).select("title").lean();
  if (!doc) {
    throw new ErrorHandler(
      404,
      "Yakuniy baholash turi ma'lumotnomada topilmadi",
    );
  }
  return doc.title || null;
};

const locateStudyPlanScienceRows = (studyPlan, row) => {
  const key = { science: row.science || null, code: row.code || null };
  const out = [];
  for (const block of studyPlan.blocks || []) {
    for (const spRow of block.sciences || []) {
      if (matchesOld(spRow, key)) out.push(spRow);
    }
  }
  return out;
};

const getSemester = (row, semKey) =>
  row?.semesters instanceof Map
    ? row.semesters.get(semKey)
    : row?.semesters?.[semKey];

const prepareEvaluationTypeWriteThrough = async ({ plan, semKey, row }) => {
  if (!plan.studyPlan) {
    throw new ErrorHandler(
      400,
      "Yakuniy baholash turini saqlash uchun manba o'quv reja bog'lanmagan. " +
        "Ishchi rejani qayta generatsiya qiling.",
    );
  }

  const parent = await WorkingScheduleModel.findById(plan.workingSchedule)
    .select("currentCourse")
    .lean();
  const globalSemKey = toGlobalSemKey(semKey, parent?.currentCourse);
  if (!globalSemKey) {
    throw new ErrorHandler(
      400,
      "Semestr kaliti aniqlanmadi (ota hujjatda kurs raqami yo'q).",
    );
  }

  const studyPlan = await StudyPlanModel.findById(plan.studyPlan);
  if (!studyPlan) {
    throw new ErrorHandler(400, "Manba o'quv reja topilmadi.");
  }

  const spRows = locateStudyPlanScienceRows(studyPlan, row).filter((spRow) =>
    getSemester(spRow, globalSemKey),
  );
  if (spRows.length === 0) {
    winston.warn(
      `[workingPlan] baholash turi write-through: manba studyPlan'da mos qator yo'q ` +
        `(studyPlan=${plan.studyPlan} sem=${globalSemKey} science=${row.science} code=${row.code})`,
    );
    throw new ErrorHandler(
      400,
      "Manba o'quv rejada mos fan qatori topilmadi — qiymat saqlanmadi.",
    );
  }

  return { studyPlan, globalSemKey, spRows };
};

const commitEvaluationTypeWriteThrough = async (prepared, title) => {
  const { studyPlan, globalSemKey, spRows } = prepared;
  const result = {
    persisted: true,
    studyPlanRows: spRows.length,
    semKey: globalSemKey,
  };
  try {
    for (const spRow of spRows) {
      getSemester(spRow, globalSemKey).assessmentType = title;
    }
    studyPlan.markModified("blocks");
    await studyPlan.save();
  } catch (err) {
    result.persisted = false;
    result.persistError = err.message;
    winston.error(
      `[workingPlan] baholash turi write-through YIQILDI — manba studyPlan yozilmadi ` +
        `(studyPlan=${studyPlan._id} sem=${globalSemKey}): ${err.message}`,
    );
  }
  return result;
};

module.exports = {
  countScienceUsage,
  getElectiveRowUsage,
  swapElectiveScience,
  setElectiveAlternatives,
  resolveAssessmentTypeTitle,
  prepareEvaluationTypeWriteThrough,
  commitEvaluationTypeWriteThrough,
  _internals: {
    SIGNED_STATUSES,
    SCIENCE_PATHS,
    applyToWorkingPlan,
    locateStudyPlanRows,
    resolveAlternatives,
    toGlobalSemKey,
    locateStudyPlanScienceRows,
  },
};
