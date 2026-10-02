"use strict";

const mongoose = require("mongoose");
const { ErrorHandler } = require("#shared/error");
const StudyPlanModel = require("./studyPlan.model");
const { countDerivedWorkingPlans } = require("./studyPlan.derivationGuard");
const {
  propagateElectiveRow,
  retractElectiveRow,
  relevantDerivedSchedules,
  electiveWarning,
} = require("./studyPlan.electivePropagation");
const {
  usageScopeOfSchedule,
} = require("#modules/4.02-studyLoad/_shared/scheduleUsageScope");
const ScienceModel = require("#references/science/science.model");
const {
  isElectiveBlock,
} = require("#modules/4.02-studyLoad/_shared/electiveBlock");
const {
  assertElectiveScience,
  assertElectiveScienceIds,
} = require("#modules/4.02-studyLoad/_shared/electiveCatalog");
const {
  classifyRows,
  ROW_TYPE,
} = require("#modules/4.02-studyLoad/_shared/planRowType");
const {
  blockQuotaAt,
  freeQuotaAt,
} = require("#modules/4.02-studyLoad/_shared/electiveQuota");
const {
  countScienceUsage,
} = require("#modules/4.02-studyLoad/workingPlan/workingPlan.service");
const {
  resolveOrCreate,
} = require("#references/_services/educationActivityResolver");

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

const buildParticleItems = async (items) => {
  const list = Array.isArray(items) ? items : [];
  const out = [];
  for (const p of list) {
    const title = p.title || "";
    out.push({
      slug: p.slug || "",
      slugRef: title ? await resolveOrCreate(title) : null,
      title,
      value: Number(p.value) || 0,
      canonical: p.canonical || null,
      colNum: p.colNum ?? null,
    });
  }
  return out;
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

const firstAggregateIndex = (rows) => {
  const types = classifyRows(rows);
  const idx = types.findIndex((t) => t === ROW_TYPE.AGGREGATE);
  return idx === -1 ? rows.length : idx;
};

const addElectiveRow = async ({ id, scope, body }) => {
  const { blockCode, science, serialNumber, semesters, alternatives } = body;

  const catalog = await ScienceModel.findById(science)
    .select("scienceCode title department active isElective")
    .lean();
  if (!catalog) throw new ErrorHandler(404, "Katalog fani topilmadi");
  if (catalog.active === false) {
    throw new ErrorHandler(400, "Bu fan katalogda faol emas");
  }
  assertElectiveScience(catalog);

  const altIds = (alternatives || []).map((a) => String(a.scienceId));
  if (altIds.includes(String(science))) {
    throw new ErrorHandler(
      400,
      "Asosiy fanning o'zi alternativ bo'la olmaydi",
      `scienceId: ${String(science)}`,
    );
  }
  await assertElectiveScienceIds(altIds);

  const plan = await StudyPlanModel.findOne({ _id: id, ...scope }).lean();
  if (!plan) throw new ErrorHandler(404, "StudyPlan topilmadi");

  const block = (plan.blocks || []).find((b) => b.blockCode === blockCode);
  if (!block) throw new ErrorHandler(404, "Blok topilmadi");
  if (!isElectiveBlock(block)) {
    throw new ErrorHandler(
      400,
      "Bu blok tanlov bloki emas — qator faqat tanlov blokiga qo'shiladi",
    );
  }

  const already = (block.sciences || []).some((row) =>
    sameId(row.science, science),
  );
  if (already) {
    throw new ErrorHandler(
      409,
      "Bu fan blokda allaqachon bor — semestrni qatorni tahrirlab qo'shing",
    );
  }

  const quotaBySem = {};
  for (const s of semesters) {
    const semKey = String(s.semester);
    const quota = blockQuotaAt(block, semKey);
    if (quota.hour === 0 && quota.credit === 0) {
      throw new ErrorHandler(
        400,
        `Bu semestrga o'quv rejada tanlov kvotasi ajratilmagan (blok ${blockCode}, semestr ${semKey})`,
      );
    }
    const free = freeQuotaAt(block, semKey);
    const reqHour = Number(s.hour) || 0;
    const reqCredit = Number(s.credit) || 0;
    if (reqHour > free.hour || reqCredit > free.credit) {
      throw new ErrorHandler(
        400,
        `Tanlov kvotasidan oshib ketdi (blok ${blockCode}, semestr ${semKey})`,
        `so'ralgan: ${reqHour} haftalik soat / ${reqCredit} kredit — qoldiq: ${free.hour} haftalik soat / ${free.credit} kredit`,
      );
    }
    quotaBySem[semKey] = free;
  }

  const semestersObj = {};
  let totalCredit = 0;
  for (const s of semesters) {
    const semKey = String(s.semester);
    semestersObj[semKey] = {
      hour: Number(s.hour) || 0,
      credit: Number(s.credit) || 0,
      particles: await buildParticleItems(s.particle),
      weeklyHours: 0,
      assessmentType: null,
    };
    totalCredit += Number(s.credit) || 0;
  }

  const resolvedAlternatives = await resolveAlternatives(alternatives);

  const row = {
    _id: new mongoose.Types.ObjectId(),
    serialNumber: serialNumber || null,
    code: catalog.scienceCode || null,
    title: catalog.title || null,
    science: catalog._id,
    department: catalog.department || null,
    particle: [],
    semesters: semestersObj,
    totalCredit,
    alternatives: resolvedAlternatives,
  };

  const insertIndex = firstAggregateIndex(block.sciences);

  const updated = await StudyPlanModel.findOneAndUpdate(
    { _id: id, ...scope, "blocks.blockCode": blockCode },
    {
      $push: {
        "blocks.$[block].sciences": {
          $each: [row],
          $position: insertIndex,
        },
      },
    },
    { arrayFilters: [{ "block.blockCode": blockCode }], new: true },
  ).lean();
  if (!updated) {
    throw new ErrorHandler(404, "StudyPlan yoki blok topilmadi");
  }

  const newBlock = (updated.blocks || []).find((b) => b.blockCode === blockCode);
  const quotaAfter = {};
  for (const semKey of Object.keys(quotaBySem)) {
    quotaAfter[semKey] = freeQuotaAt(newBlock, semKey);
  }

  const derivedWorkingPlans = await countDerivedWorkingPlans(id);
  const propagation = await propagateElectiveRow({
    studyPlanId: id,
    block: newBlock,
    row,
  });

  return {
    row,
    quota: quotaAfter,
    derivedWorkingPlans,
    propagation,
    warning: electiveWarning(derivedWorkingPlans, propagation),
  };
};

const removeElectiveRow = async ({ id, rowId, scope }) => {
  const plan = await StudyPlanModel.findOne({ _id: id, ...scope }).lean();
  if (!plan) throw new ErrorHandler(404, "StudyPlan topilmadi");

  let targetBlock = null;
  let targetRow = null;
  for (const block of plan.blocks || []) {
    const row = (block.sciences || []).find((r) => sameId(r._id, rowId));
    if (row) {
      targetBlock = block;
      targetRow = row;
      break;
    }
  }
  if (!targetRow) throw new ErrorHandler(404, "Qator topilmadi");

  if (!isElectiveBlock(targetBlock)) {
    throw new ErrorHandler(
      400,
      "Faqat tanlov blokidagi qatorni o'chirish mumkin",
    );
  }

  const types = classifyRows(targetBlock.sciences);
  const idx = (targetBlock.sciences || []).findIndex((r) =>
    sameId(r._id, rowId),
  );
  const rowType = types[idx];
  if (rowType !== ROW_TYPE.SUBJECT && rowType !== ROW_TYPE.ELECTIVE_SLOT) {
    throw new ErrorHandler(
      400,
      "Faqat tanlov fani qatorini o'chirish mumkin (yig'indi/sarlavha/amaliyot qatori emas)",
    );
  }

  if (targetRow.science) {
    const schedules = await relevantDerivedSchedules({ studyPlanId: id, row: targetRow });
    let signedTotal = 0;
    for (const schedule of schedules) {
      const usage = await countScienceUsage({
        science: targetRow.science,
        ...usageScopeOfSchedule(schedule),
      });
      signedTotal += usage.signedTotal;
    }
    if (signedTotal > 0) {
      throw new ErrorHandler(
        400,
        `Bu fanga bog'liq imzolangan hujjatlar bor (${signedTotal} ta) — avval ular qayta ko'rib chiqilishi kerak`,
      );
    }
  }

  const updated = await StudyPlanModel.findOneAndUpdate(
    { _id: id, ...scope },
    {
      $pull: {
        "blocks.$[block].sciences": { _id: targetRow._id },
      },
    },
    { arrayFilters: [{ "block.blockCode": targetBlock.blockCode }], new: true },
  ).lean();
  if (!updated) throw new ErrorHandler(404, "StudyPlan topilmadi");

  const newBlock = (updated.blocks || []).find(
    (b) => b.blockCode === targetBlock.blockCode,
  );
  const semKeys = Object.keys(
    targetRow.semesters instanceof Map
      ? Object.fromEntries(targetRow.semesters)
      : targetRow.semesters || {},
  );
  const quota = {};
  for (const semKey of semKeys) {
    quota[semKey] = freeQuotaAt(newBlock, semKey);
  }

  const derivedWorkingPlans = await countDerivedWorkingPlans(id);
  const propagation = await retractElectiveRow({
    studyPlanId: id,
    blockCode: targetBlock.blockCode,
    row: targetRow,
    block: targetBlock,
  });
  return {
    removed: true,
    quota,
    derivedWorkingPlans,
    propagation,
    warning: electiveWarning(derivedWorkingPlans, propagation, "ta ishchi rejadan olib tashlandi"),
  };
};

module.exports = {
  addElectiveRow,
  removeElectiveRow,
  _internals: {
    resolveAlternatives,
    buildParticleItems,
    firstAggregateIndex,
  },
};
