"use strict";

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { isLocked } = require("#modules/4.02-studyLoad/_shared/editableStatus");
const {
  isEmptySlotRow,
  slotParticles,
  slotRowFromValues,
  nextSlotSerial,
} = require("#modules/4.02-studyLoad/_shared/electiveSlotRow");

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

const courseOfSemester = (globalSemKey) => {
  const n = Number(globalSemKey);
  if (!Number.isInteger(n) || n < 1) return null;
  const courseNum = Math.ceil(n / 2);
  return { courseNum, localSemKey: String(n - 2 * (courseNum - 1)) };
};

const entriesOf = (m) =>
  m instanceof Map ? [...m.entries()] : Object.entries(m || {});

const projectParticles = (list) =>
  (Array.isArray(list) ? list : []).map((p) => ({
    slug: p.slug,
    slugRef: p.slugRef || null,
    title: p.title || "",
    value: Number(p.value) || 0,
    canonical: p.canonical || null,
    colNum: p.colNum != null ? p.colNum : null,
  }));

const projectAlternatives = (list) =>
  (Array.isArray(list) ? list : []).map((a) => ({
    science: a.science,
    code: a.code || null,
    title: a.title || null,
    department: a.department || null,
  }));

const rowMatches = (sci, row) => {
  if (row.science) return sameId(sci.science, row.science);
  return Boolean(row.code) && sci.code === row.code;
};

const fillSlotInPlace = (slot, projected, block) => {
  slot.code = projected.code;
  slot.title = projected.title;
  slot.science = projected.science;
  slot.department = projected.department;
  slot.evaluationType = projected.evaluationType;
  slot.alternatives = projected.alternatives;
  slot.particle =
    projected.particle.length > 0
      ? projected.particle
      : slotParticles(block, projected.weeklyHours, projected.totalCredit);
};

const restoreSlot = (target, block, hour, credit) => {
  if (hour <= 0 && credit <= 0) return;
  const slot = (target.sciences || []).find(isEmptySlotRow);
  if (slot) {
    slot.weeklyHours = (Number(slot.weeklyHours) || 0) + hour;
    slot.totalCredit = (Number(slot.totalCredit) || 0) + credit;
    slot.particle = slotParticles(block, slot.weeklyHours, slot.totalCredit);
    return;
  }
  target.sciences.push(
    slotRowFromValues(block, hour, credit, nextSlotSerial(block, target.sciences)),
  );
};

const blockSerialOf = (b) => b?.serialNumber || "2";

async function loadDerivedPlans(studyPlanId) {
  const plans = await WorkingPlanModel.find({ studyPlan: studyPlanId }).exec();
  if (!plans || plans.length === 0) return [];
  const scheduleIds = plans.map((p) => p.workingSchedule).filter(Boolean);
  const schedules = await WorkingScheduleModel.find({ _id: { $in: scheduleIds } })
    .select("_id status currentCourse academicYear year direction")
    .lean();
  const byId = new Map((schedules || []).map((s) => [String(s._id), s]));
  return plans.map((plan) => ({
    plan,
    schedule: byId.get(String(plan.workingSchedule)) || null,
  }));
}

async function propagateElectiveRow({ studyPlanId, block, row }) {
  const result = { propagated: 0, skippedLocked: 0 };
  const relevantCourses = new Set(
    entriesOf(row.semesters)
      .filter(([, sem]) => (Number(sem?.hour) || 0) > 0 || (Number(sem?.credit) || 0) > 0)
      .map(([semKey]) => courseOfSemester(semKey)?.courseNum)
      .filter((c) => c != null),
  );
  const derived = await loadDerivedPlans(studyPlanId);
  for (const { plan, schedule } of derived) {
    if (!schedule || !relevantCourses.has(Number(schedule.currentCourse))) continue;
    if (isLocked(schedule.status)) {
      result.skippedLocked += 1;
      continue;
    }
    let changed = false;
    for (const [semKey, sem] of entriesOf(row.semesters)) {
      const hour = Number(sem?.hour) || 0;
      const credit = Number(sem?.credit) || 0;
      if (hour === 0 && credit === 0) continue;
      const mapping = courseOfSemester(semKey);
      if (!mapping || mapping.courseNum !== Number(schedule.currentCourse)) continue;

      let semData = plan.semesters.get(mapping.localSemKey);
      if (!semData) {
        plan.semesters.set(mapping.localSemKey, {
          semester: mapping.localSemKey,
          blocks: [],
        });
        semData = plan.semesters.get(mapping.localSemKey);
      }
      let target = (semData.blocks || []).find((b) => b.blockCode === block.blockCode);
      if (!target) {
        semData.blocks.push({
          blockCode: block.blockCode,
          serialNumber: block.serialNumber || null,
          code: block.code || null,
          title: block.title || null,
          sciences: [],
        });
        target = semData.blocks[semData.blocks.length - 1];
      }
      if ((target.sciences || []).some((s) => rowMatches(s, row))) continue;

      const projected = {
        serialNumber: row.serialNumber || null,
        code: row.code || null,
        title: row.title || null,
        science: row.science || null,
        department: row.department || null,
        particle: projectParticles(sem.particles),
        totalCredit: credit,
        weeklyHours: hour,
        evaluationType: sem.assessmentType || null,
        alternatives: projectAlternatives(row.alternatives),
      };
      const slot = (target.sciences || []).find(isEmptySlotRow);
      if (slot) {
        fillSlotInPlace(slot, projected, block);
        const restHour = (Number(slot.weeklyHours) || 0) - hour;
        const restCredit = (Number(slot.totalCredit) || 0) - credit;
        slot.totalCredit = credit;
        slot.weeklyHours = hour;
        if (restHour > 0 || restCredit > 0) {
          target.sciences.push(
            slotRowFromValues(
              block,
              Math.max(0, restHour),
              Math.max(0, restCredit),
              nextSlotSerial(block, target.sciences),
            ),
          );
        }
      } else {
        target.sciences.push(projected);
      }
      changed = true;
    }
    if (changed) {
      plan.markModified("semesters");
      await plan.save();
      result.propagated += 1;
    }
  }
  return result;
}

async function retractElectiveRow({ studyPlanId, blockCode, row, block = null }) {
  const result = { retracted: 0, skippedLocked: 0 };
  const derived = await loadDerivedPlans(studyPlanId);
  for (const { plan, schedule } of derived) {
    if (!schedule) continue;
    const hasRow = entriesOf(plan.semesters).some(([, semData]) =>
      (semData?.blocks || []).some(
        (b) => b.blockCode === blockCode && (b.sciences || []).some((s) => rowMatches(s, row)),
      ),
    );
    if (!hasRow) continue;
    if (isLocked(schedule.status)) {
      result.skippedLocked += 1;
      continue;
    }
    let changed = false;
    for (const [, semData] of entriesOf(plan.semesters)) {
      for (const b of semData?.blocks || []) {
        if (b.blockCode !== blockCode) continue;
        const removed = (b.sciences || []).filter((s) => rowMatches(s, row));
        if (removed.length === 0) continue;
        b.sciences = (b.sciences || []).filter((s) => !rowMatches(s, row));
        for (const r of removed) {
          restoreSlot(
            b,
            block || { blockCode, serialNumber: blockSerialOf(b), particle: [], semesters: {} },
            Number(r.weeklyHours) || 0,
            Number(r.totalCredit) || 0,
          );
        }
        changed = true;
      }
    }
    if (changed) {
      plan.markModified("semesters");
      await plan.save();
      result.retracted += 1;
    }
  }
  return result;
}

const electiveWarning = (
  derivedWorkingPlans,
  p,
  phrase = "ta ishchi rejaga qo'shildi",
) => {
  if (!derivedWorkingPlans) return null;
  const touched = Number(p?.propagated ?? p?.retracted) || 0;
  const locked = Number(p?.skippedLocked) || 0;
  const parts = [];
  if (touched > 0) parts.push(`${touched} ${phrase}`);
  if (locked > 0) {
    parts.push(
      `${locked} ta qulflangan (tasdiqlanayotgan/tasdiqlangan) ishchi rejaga kirmadi`,
    );
  }
  if (parts.length === 0) {
    parts.push(
      p && p.retracted != null
        ? "Ishchi rejalarda bu qator yo'q edi — hech narsa o'zgarmadi"
        : "Shu semestr kursi uchun ishchi reja yo'q — generatsiya qilinganda kiradi",
    );
  }
  return parts.join("; ");
};

async function relevantDerivedSchedules({ studyPlanId, row }) {
  const relevantCourses = new Set(
    entriesOf(row.semesters)
      .filter(([, sem]) => (Number(sem?.hour) || 0) > 0 || (Number(sem?.credit) || 0) > 0)
      .map(([semKey]) => courseOfSemester(semKey)?.courseNum)
      .filter((c) => c != null),
  );
  const derived = await loadDerivedPlans(studyPlanId);
  return derived
    .map(({ schedule }) => schedule)
    .filter((s) => s && relevantCourses.has(Number(s.currentCourse)));
}

module.exports = {
  courseOfSemester,
  relevantDerivedSchedules,
  propagateElectiveRow,
  retractElectiveRow,
  electiveWarning,
};
