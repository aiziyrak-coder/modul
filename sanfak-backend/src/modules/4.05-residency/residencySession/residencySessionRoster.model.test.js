"use strict";

const mongoose = require("mongoose");
const Roster = require("./residencySessionRoster.model");

const oid = () => new mongoose.Types.ObjectId();
const frame = (score) =>
  new Roster({
    session: oid(),
    resident: oid(),
    day: "2026-09-28",
    science: oid(),
    lessonType: "maruza",
    hours: 2,
    outcome: "present",
    score,
  });
const scoreError = (score) => frame(score).validateSync()?.errors?.score;

describe("freym `score` — 0..100 (LSC-Q1=A)", () => {
  it.each([0, 72.5, 100, null])("%p — xato yo'q", (score) => {
    expect(scoreError(score)).toBeUndefined();
  });

  it.each([100.1, -0.1])("%p — xato", (score) => {
    expect(scoreError(score)).toBeDefined();
  });
});
