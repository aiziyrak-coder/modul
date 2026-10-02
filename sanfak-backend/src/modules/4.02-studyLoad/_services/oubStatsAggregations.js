"use strict";
const mongoose = require("mongoose");

const WorkingSchedule = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const { computeSemesterTotals } = WorkingPlan;
const {
  buildBlockSerialIndex,
} = require("#modules/4.02-studyLoad/_shared/planRowType");

const Department = require("#references/department/department.model");
const Direction = require("#references/direction/direction.model");
const Faculty = require("#references/faculty/faculty.model");

const UNKNOWN = "unknown";

async function loadRefMaps() {
  const [faculties, departments, directions] = await Promise.all([
    Faculty.find({ active: true }).select("_id title").lean(),
    Department.find({ active: true }).select("_id title faculty").lean(),
    Direction.find({ active: true }).select("_id faculty").lean(),
  ]);

  return {
    faculties,
    facultyTitle: new Map(faculties.map((f) => [String(f._id), f.title])),
    deptTitle: new Map(departments.map((d) => [String(d._id), d.title])),
    deptFaculty: new Map(
      departments.map((d) => [String(d._id), d.faculty ? String(d.faculty) : null]),
    ),
    dirFaculty: new Map(
      directions.map((d) => [String(d._id), d.faculty ? String(d.faculty) : null]),
    ),
  };
}

const idsInFaculty = (idMap, facultyId) => {
  const target = String(facultyId);
  const out = [];
  for (const [id, fac] of idMap.entries()) {
    if (fac === target) out.push(new mongoose.Types.ObjectId(id));
  }
  return out;
};

const emptyLeafTotals = () => ({
  blocksHour: 0,
  blocksCredit: 0,
  grandHour: 0,
  grandCredit: 0,
});

const addLeafTotals = (acc, semData) => {
  acc.blocksHour += Number(semData.blocksTotal?.totalHour) || 0;
  acc.blocksCredit += Number(semData.blocksTotal?.totalCredit) || 0;
  acc.grandHour += Number(semData.grandTotal?.totalHour) || 0;
  acc.grandCredit += Number(semData.grandTotal?.totalCredit) || 0;
};

async function leafHourCreditTotals({ academicYearId, facultyId, dirFaculty }) {
  const wsMatch = { active: true };
  if (academicYearId) wsMatch.academicYear = academicYearId;
  if (facultyId) wsMatch.direction = { $in: idsInFaculty(dirFaculty, facultyId) };

  const wsDocs = await WorkingSchedule.find(wsMatch).select("_id direction").lean();

  const total = emptyLeafTotals();
  const byFaculty = new Map();
  if (!wsDocs.length) return { total, byFaculty };

  const facultyOfWs = new Map(
    wsDocs.map((w) => [String(w._id), dirFaculty.get(String(w.direction)) || UNKNOWN]),
  );
  const wsIds = wsDocs.map((w) => w._id);

  const plans = await WorkingPlan.find({ workingSchedule: { $in: wsIds }, active: true })
    .select("workingSchedule semesters")
    .lean();

  for (const plan of plans) {
    const semestersObj = plan.semesters || {};
    const semKeys = Object.keys(semestersObj);
    if (!semKeys.length) continue;

    const blockSerialIndex = buildBlockSerialIndex(semestersObj);
    const facultyKey = facultyOfWs.get(String(plan.workingSchedule)) || UNKNOWN;
    if (!byFaculty.has(facultyKey)) byFaculty.set(facultyKey, emptyLeafTotals());
    const bucket = byFaculty.get(facultyKey);

    semKeys.forEach((semKey, i) => {
      const semData = semestersObj[semKey];
      if (!semData) return;
      computeSemesterTotals(semData, i === semKeys.length - 1, blockSerialIndex);
      addLeafTotals(total, semData);
      addLeafTotals(bucket, semData);
    });
  }

  return { total, byFaculty };
}

module.exports = {
  loadRefMaps,
  idsInFaculty,
  leafHourCreditTotals,
  emptyLeafTotals,
};
