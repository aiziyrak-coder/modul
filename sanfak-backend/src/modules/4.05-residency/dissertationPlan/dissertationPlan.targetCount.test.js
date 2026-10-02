"use strict";

const { createSchema, updateSchema } = require("./dissertationPlan.validation");

const task = (targetCount) => ({
  category: "rejalashtirish",
  title: "Adabiyotlar sharhi",
  targetCount,
});
const create = (targetCount) =>
  createSchema.validate(
    { title: "Dissertatsiya rejasi", tasks: [task(targetCount)] },
    { abortEarly: false },
  );
const update = (targetCount) =>
  updateSchema.validate({ tasks: [task(targetCount)] }, { abortEarly: false });

describe("dissertationPlan — tasks[].targetCount", () => {
  it("butun son QABUL qilinadi (chegara 1 va oddiy 3)", () => {
    expect(create(1).error).toBeUndefined();
    expect(create(3).error).toBeUndefined();
  });

  it("kasr son RAD etiladi (2.5)", () => {
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
});
