const {
  createSchema,
  responseSchema,
  finalizeSchema,
} = require("./task.validation");

const validBase = {
  title: "Yangi topshiriq",
  deadline: "2030-01-01",
  assignees: ["64b2f0c2a1b2c3d4e5f60718"],
};

describe("task.validation — createSchema", () => {
  test("to'g'ri payload (title + deadline + assignees) qabul qilinadi", () => {
    const { error } = createSchema.validate(validBase);
    expect(error).toBeUndefined();
  });

  test("assignees JSON-string ko'rinishida ham qabul qilinadi", () => {
    const { error } = createSchema.validate({
      ...validBase,
      assignees: '["64b2f0c2a1b2c3d4e5f60718"]',
    });
    expect(error).toBeUndefined();
  });

  test("title majburiy (yo'q bo'lsa xato)", () => {
    const { error } = createSchema.validate({
      deadline: "2030-01-01",
      assignees: ["x"],
    });
    expect(error).toBeDefined();
  });

  test("assignees majburiy (yo'q bo'lsa xato)", () => {
    const { error } = createSchema.validate({
      title: "x",
      deadline: "2030-01-01",
    });
    expect(error).toBeDefined();
  });

  test("deadline majburiy (yo'q bo'lsa xato)", () => {
    const { error } = createSchema.validate({ title: "x", assignees: ["y"] });
    expect(error).toBeDefined();
  });

  test("{uz,ru,eng} obyekt title RAD etiladi (multi-lang olib tashlangan)", () => {
    const { error } = createSchema.validate({
      ...validBase,
      title: { uz: "a", ru: "b", eng: "c" },
    });
    expect(error).toBeDefined();
  });

  test("bo'sh string title RAD etiladi (min 1)", () => {
    const { error } = createSchema.validate({ ...validBase, title: "" });
    expect(error).toBeDefined();
  });
});

describe("task.validation — responseSchema", () => {
  test("oddiy javob (text) qabul qilinadi", () => {
    const { error } = responseSchema.validate({ text: "bajaryapman" });
    expect(error).toBeUndefined();
  });

  test("isRejected=true bo'lsa rejectionReason majburiy", () => {
    const { error } = responseSchema.validate({ isRejected: true });
    expect(error).toBeDefined();
  });

  test("isRejected=true + rejectionReason qabul qilinadi", () => {
    const { error } = responseSchema.validate({
      isRejected: true,
      rejectionReason: "menga tegishli emas",
    });
    expect(error).toBeUndefined();
  });
});

describe("task.validation — finalizeSchema", () => {
  test("outcome=completed qabul qilinadi", () => {
    const { error } = finalizeSchema.validate({ outcome: "completed" });
    expect(error).toBeUndefined();
  });

  test("noto'g'ri outcome RAD etiladi", () => {
    const { error } = finalizeSchema.validate({ outcome: "bajarildi" });
    expect(error).toBeDefined();
  });
});
