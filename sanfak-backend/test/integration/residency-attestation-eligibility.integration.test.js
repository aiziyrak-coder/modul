"use strict";

const mongoose = require("mongoose");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const {
  currentAcademicYearTitle,
  currentAcademicYearWindow,
} = require("#modules/4.05-residency/_services/unexcusedWindow");
const { countUnexcusedHours } = require("#modules/4.05-residency/_services/expulsionCheck");
const {
  checkAttestationEligibility,
} = require("#modules/4.05-residency/_services/attestationCheck");

const DAY = 24 * 3600 * 1000;
const FROM = new Date(currentAcademicYearWindow().from);
const IN_YEAR = new Date(FROM.getTime() + 30 * DAY);
const LAST_YEAR = new Date(FROM.getTime() - DAY);
const T0 = new Date("2026-09-20T08:00:00Z");

const seed = async (resident) => {
  const row = (date, status, hours, extra = {}) => ({
    resident,
    date,
    status,
    hours,
    lessonType: "maruza",
    ...extra,
  });
  await Attendance.insertMany([
    row(LAST_YEAR, "absent", 8),
    row(FROM, "absent", 2),
    row(IN_YEAR, "absent", 4),
    row(new Date(IN_YEAR.getTime() + DAY), "excused", 6),
    row(new Date(IN_YEAR.getTime() + 2 * DAY), "absent", 8, { deletedAt: T0 }),
    row(new Date(IN_YEAR.getTime() + 3 * DAY), "absent", 8, { active: false }),
  ]);
};

beforeEach(() => Attendance.init());

test("sanasiz: ruxsat soati = 6/72 soati (joriy o'quv yili)", async () => {
  const id = new mongoose.Types.ObjectId();
  await seed(id);

  const r = await checkAttestationEligibility(id);

  expect(r.details.attendance.unexcusedHours).toBe(6);
  expect(await countUnexcusedHours(id)).toBe(6);
  expect(r.details.attendance.window).toEqual({
    source: "academicYear",
    academicYear: currentAcademicYearTitle(),
    from: FROM,
    to: new Date(currentAcademicYearWindow().to),
  });
  expect(r.warningTriggered).toBe(true);
});

test("ATW-Q4: sababli tasdig'i bor `absent` — ruxsatda sababli, 6/72 da sababsiz", async () => {
  const id = new mongoose.Types.ObjectId();
  await seed(id);
  await Attendance.create({
    resident: id,
    date: new Date(IN_YEAR.getTime() + 4 * DAY),
    status: "absent",
    hours: 2,
    lessonType: "maruza",
    excuseApprovedBy: new mongoose.Types.ObjectId(),
  });

  const r = await checkAttestationEligibility(id);

  expect(r.details.attendance.unexcusedHours).toBe(6);
  expect(await countUnexcusedHours(id)).toBe(8);
});

test("ATW-Q2: aniq `fromDate` o'tgan yilni ham qamraydi", async () => {
  const id = new mongoose.Types.ObjectId();
  await seed(id);

  const r = await checkAttestationEligibility(id, { fromDate: LAST_YEAR });

  expect(r.details.attendance.unexcusedHours).toBe(14);
  expect(r.details.attendance.window).toEqual({
    source: "explicit",
    academicYear: null,
    from: LAST_YEAR,
    to: null,
  });
});
