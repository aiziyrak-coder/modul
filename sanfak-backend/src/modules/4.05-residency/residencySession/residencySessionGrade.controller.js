"use strict";

const { ErrorHandler } = require("#shared/error");
const S = require("./residencySessionGrade.service");

const wrap = (label, fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (err) {
    return next(err instanceof ErrorHandler ? err : new ErrorHandler(500, label, err.message));
  }
};

module.exports = {
  grade: wrap("Mashg'ulotga ball qo'yishda xato", async (req, res) => {
    const result = await S.gradeEntry({
      sessionId: req.params.id,
      residentId: req.params.resident,
      score: req.body.score,
      user: req.user,
    });
    return res.status(200).json(result);
  }),

  context: wrap("Davomat kontekstini olishda xato", async (req, res) => {
    const result = await S.attendanceContext(req.params.resident, req.user);
    return res.status(200).json(result);
  }),
};
