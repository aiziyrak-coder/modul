const { createSchema, updateSchema } = require("./qualTopic.validation");

const valid = {
  title: "Pedagogik mahorat",
  orderNumber: 1,
  kind: 1,
  duration: 2,
  course: "6a438ff65ade58ad3bb19ec9",
};

describe("qualTopic.validation", () => {
  it("to'g'ri payload o'tadi", () => {
    expect(createSchema.validate(valid).error).toBeUndefined();
  });

  it("tartib raqami berilmasa ham o'tadi (server oxiriga qo'yadi)", () => {
    const { orderNumber, ...rest } = valid;
    expect(createSchema.validate(rest).error).toBeUndefined();
  });

  it.each([0, -1, 1.5])("noto'g'ri tartib raqami rad etiladi: %s", (n) => {
    expect(createSchema.validate({ ...valid, orderNumber: n }).error).toBeDefined();
  });

  it.each(["title", "kind", "duration", "course"])("%s majburiy", (field) => {
    const payload = { ...valid };
    delete payload[field];
    expect(createSchema.validate(payload).error).toBeDefined();
  });

  it("dars turi faqat 1 (nazariy) yoki 2 (amaliy)", () => {
    expect(createSchema.validate({ ...valid, kind: 3 }).error).toBeDefined();
  });

  it("tahrirlashda faqat tartib raqamini yuborish mumkin", () => {
    expect(updateSchema.validate({ orderNumber: 5 }).error).toBeUndefined();
  });
});
