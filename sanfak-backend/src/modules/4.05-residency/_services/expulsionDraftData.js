"use strict";

require("#references/science/science.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { RESIDENT_REF_POPULATE } = require("./residentRefPopulate");
const { unexcusedDateFilter, sumUnexcusedHours } = require("./unexcusedWindow");
const { uzDayKey } = require("./uzDay");

const RESIDENT_SELECT = [
  "fullName program courseNumber specialty specialtyTitle department departmentTitle",
  "group groupTitle status active expulsionOrderCreated expulsionOrderCreatedAt",
].join(" ");

const loadDraftResident = (residentId) =>
  Resident.findOne({ _id: residentId })
    .select(RESIDENT_SELECT)
    .populate(RESIDENT_REF_POPULATE)
    .lean();

const loadDraftRows = (residentId, now) =>
  Attendance.find({
    resident: residentId,
    status: "absent",
    active: true,
    date: unexcusedDateFilter(now),
  })
    .select("date hours science scienceTitle lessonType")
    .populate({ path: "science", select: "title" })
    .sort({ date: 1, _id: 1 })
    .lean();

const titleOf = (ref, snapshot) => ref?.title || ref?.name || snapshot || null;

const residentBlock = (order, r) => ({
  fullName: r.fullName || order.residentName || null,
  program: r.program ?? null,
  specialty: titleOf(r.specialty, r.specialtyTitle),
  department: titleOf(r.department, r.departmentTitle),
  course: r.courseNumber ?? null,
  group: titleOf(r.group, r.groupTitle),
});

const toRow = (a) => ({
  day: uzDayKey(a.date),
  science: a.science?.title || a.scienceTitle || null,
  lessonType: a.lessonType ?? null,
  hours: sumUnexcusedHours([a]),
});

const toDraftInput = ({ order, resident, rows, total, now }) => ({
  orderId: String(order._id),
  resident: residentBlock(order, resident),
  countingYear: order.countingYear,
  draftedAt: order.draftedAt,
  hoursAtDraft: order.hoursAtDraft ?? null,
  rows: rows.map(toRow),
  total,
  generatedAt: now,
});

module.exports = { loadDraftResident, loadDraftRows, toDraftInput, titleOf, toRow };
