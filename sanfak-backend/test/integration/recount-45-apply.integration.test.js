"use strict";

const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const { applySweep } = require("../../scripts/recount-45-unexcused-hours");

test("`--apply` sweep'i modellarni o'zi yuklaydi va hisobni HAQIQATAN yangilaydi", async () => {
  const r = await Resident.create({
    program: "ordinatura",
    fullName: "Test",
    courseNumber: 1,
    totalUnexcusedHours: 40,
  });
  await Attendance.create({ resident: r._id, date: new Date(), status: "absent", hours: 2, active: true });

  expect(await applySweep()).toBe(true);
  expect((await Resident.findById(r._id).lean()).totalUnexcusedHours).toBe(2);
});
