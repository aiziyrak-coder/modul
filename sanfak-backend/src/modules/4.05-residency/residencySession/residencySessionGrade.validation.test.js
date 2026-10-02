"use strict";

const { gradeBody } = require("./residencySessionGrade.validation");

const check = (body) => gradeBody.validate(body, { abortEarly: false });

describe("gradeBody.score (LSC-Q1=A)", () => {
  it.each([0, 100, 72.5, null])("%p QABUL qilinadi", (score) => {
    expect(check({ score }).error).toBeUndefined();
  });

  it.each([100.1, -1, 1000])("%p RAD etiladi", (score) => {
    const { error } = check({ score });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/score/);
  });

  it("kalitsiz tana RAD etiladi — bo'sh so'rov bahoni o'chirmasin", () => {
    expect(check({}).error).toBeDefined();
  });
});
