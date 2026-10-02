"use strict";

const LESSON_SCORE_MAX = 100;

const SCORED_PRESENT = Object.freeze({
  $and: [{ $eq: ["$status", "present"] }, { $ne: [{ $ifNull: ["$score", null] }, null] }],
});

const SCORE_ROLLUP = Object.freeze({
  group: Object.freeze({
    scoredCount: { $sum: { $cond: [SCORED_PRESENT, 1, 0] } },
    scoreAvg: { $avg: { $cond: [SCORED_PRESENT, "$score", null] } },
  }),
  project: Object.freeze({ scoredCount: 1, scoreAvg: 1 }),
});

module.exports = { LESSON_SCORE_MAX, SCORE_ROLLUP };
