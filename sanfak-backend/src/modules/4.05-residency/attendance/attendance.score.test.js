"use strict";

const {
  createAttendanceSchema,
  updateAttendanceSchema,
} = require("./attendance.validation");
const { LESSON_SCORE_MAX } = require("#modules/4.05-residency/_services/lessonScore");

const RESIDENT = "6a5a0acbd34b3c21a575d59d";
const base = {
  resident: RESIDENT,
  date: "2026-03-02",
  status: "present",
};

const create = (score) =>
  createAttendanceSchema.validate({ ...base, score }, { abortEarly: false });
const update = (score) =>
  updateAttendanceSchema.validate({ score }, { abortEarly: false });

const ACCEPTED = [0, 100, 72.5, 7.5, null];
const REJECTED = [100.1, -0.1, 1000];

test("shkala — 100 (LSC-Q1=A)", () => {
  expect(LESSON_SCORE_MAX).toBe(100);
});

describe("createAttendanceSchema.score", () => {
  it.each(ACCEPTED)("%p QABUL qilinadi (chegaralar, o'nlik, null)", (score) => {
    expect(create(score).error).toBeUndefined();
  });

  it.each(REJECTED)("%p RAD etiladi", (score) => {
    const { error } = create(score);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/score/);
  });
});

describe("updateAttendanceSchema.score", () => {
  it.each(ACCEPTED)("%p QABUL qilinadi", (score) => {
    expect(update(score).error).toBeUndefined();
  });

  it.each(REJECTED)("%p RAD etiladi", (score) => {
    expect(update(score).error).toBeDefined();
  });
});
