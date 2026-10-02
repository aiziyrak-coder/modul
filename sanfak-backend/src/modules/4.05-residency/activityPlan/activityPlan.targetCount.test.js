"use strict";

const { createSchema, updateSchema } = require("./activityPlan.validation");

const task = (targetCount) => ({
  category: "ilmiy_tadqiqot",
  title: "Maqola chop etish",
  targetCount,
});
const create = (targetCount) =>
  createSchema.validate(
    { title: "2026 reja", tasks: [task(targetCount)] },
    { abortEarly: false },
  );
const update = (targetCount) =>
  updateSchema.validate({ tasks: [task(targetCount)] }, { abortEarly: false });

describe("activityPlan — tasks[].targetCount", () => {
  it("butun son QABUL qilinadi (chegara 1 va oddiy 3)", () => {
    expect(create(1).error).toBeUndefined();
    expect(create(3).error).toBeUndefined();
  });

  it("kasr son RAD etiladi (2.5) — \"0/2.5\" holati", () => {
    const { error } = create(2.5);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/integer/);
  });

  it("chegaradan pastdagi butun son RAD etiladi (0)", () => {
    expect(create(0).error).toBeDefined();
  });

  it("tahrirlash yo'li ham yopiq (kasr son)", () => {
    expect(update(2.5).error).toBeDefined();
    expect(update(3).error).toBeUndefined();
  });

  it("\"\" hamon qabul qilinadi va kalit olib tashlanadi (D-074 regressiyasi yo'q)", () => {
    const { error, value } = create("");
    expect(error).toBeUndefined();
    expect(
      Object.prototype.hasOwnProperty.call(value.tasks[0], "targetCount"),
    ).toBe(false);
  });
});
