"use strict";

const mongoose = require("mongoose");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const { SCORE_ROLLUP } = require("#modules/4.05-residency/_services/lessonScore");

const oid = () => new mongoose.Types.ObjectId();
beforeAll(() => Attendance.init());
let day = 0;
const row = (resident, status, score) => {
  day += 1;
  return { resident, status, score, hours: 2, date: new Date(Date.UTC(2026, 8, day)), deletedAt: null };
};

test("scoreAvg / scoredCount — faqat ballangan present; scoreSum o'zgarmagan", async () => {
  const graded = oid();
  const none = oid();
  await Attendance.collection.insertMany([
    row(graded, "present", 80),
    row(graded, "present", 65),
    row(graded, "present", 0),
    row(graded, "present", null),
    row(graded, "absent", 50),
    row(graded, "excused", null),
    row(none, "absent", null),
    row(none, "present", null),
  ]);
  const out = await Attendance.aggregate([
    { $group: { _id: "$resident", scoreSum: { $sum: { $ifNull: ["$score", 0] } }, ...SCORE_ROLLUP.group } },
    { $project: { scoreSum: 1, ...SCORE_ROLLUP.project } },
  ]);
  const by = Object.fromEntries(out.map((r) => [String(r._id), r]));
  expect(by[String(graded)]).toMatchObject({ scoreAvg: 145 / 3, scoredCount: 3, scoreSum: 195 });
  expect(by[String(none)]).toMatchObject({ scoreAvg: null, scoredCount: 0, scoreSum: 0 });
});
