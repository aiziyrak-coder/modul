const {
  createSchema,
  updateSchema,
  paginate,
  findAll,
  idSchema,
} = require("./taskCategory.validation");

const validBase = { name: "Ilmiy ishlar" };

describe("taskCategory.validation — createSchema", () => {
  test("to'g'ri payload (name) qabul qilinadi", () => {
    const { error } = createSchema.validate(validBase);
    expect(error).toBeUndefined();
  });

  test("name + active birga qabul qilinadi", () => {
    const { error } = createSchema.validate({ ...validBase, active: false });
    expect(error).toBeUndefined();
  });

  test("name avtomatik trim qilinadi", () => {
    const { value } = createSchema.validate({ name: "  Ilmiy ishlar  " });
    expect(value.name).toBe("Ilmiy ishlar");
  });

  test("name majburiy (yo'q bo'lsa xato)", () => {
    const { error } = createSchema.validate({ active: true });
    expect(error).toBeDefined();
  });

  test("bo'sh string name RAD etiladi (min 1)", () => {
    const { error } = createSchema.validate({ name: "" });
    expect(error).toBeDefined();
  });

  test("name noto'g'ri turda (raqam) RAD etiladi", () => {
    const { error } = createSchema.validate({ name: 123 });
    expect(error).toBeDefined();
  });

  test("active noto'g'ri turda (string) RAD etiladi", () => {
    const { error } = createSchema.validate({ ...validBase, active: "yes" });
    expect(error).toBeDefined();
  });

  test("{uz,ru,eng} obyekt name RAD etiladi (multi-lang olib tashlangan)", () => {
    const { error } = createSchema.validate({
      name: { uz: "a", ru: "b", eng: "c" },
    });
    expect(error).toBeDefined();
  });
});

describe("taskCategory.validation — updateSchema", () => {
  test("bo'sh obyekt qabul qilinadi (barcha maydon ixtiyoriy)", () => {
    const { error } = updateSchema.validate({});
    expect(error).toBeUndefined();
  });

  test("to'g'ri payload (name) qabul qilinadi", () => {
    const { error } = updateSchema.validate({ name: "Yangi nom" });
    expect(error).toBeUndefined();
  });

  test("name noto'g'ri turda (raqam) RAD etiladi", () => {
    const { error } = updateSchema.validate({ name: 123 });
    expect(error).toBeDefined();
  });
});

describe("taskCategory.validation — paginate", () => {
  test("to'g'ri payload (page+limit) qabul qilinadi", () => {
    const { error } = paginate.validate({ page: 1, limit: 10 });
    expect(error).toBeUndefined();
  });

  test("limit majburiy (yo'q bo'lsa xato)", () => {
    const { error } = paginate.validate({ page: 1 });
    expect(error).toBeDefined();
  });

  test("page majburiy (yo'q bo'lsa xato)", () => {
    const { error } = paginate.validate({ limit: 10 });
    expect(error).toBeDefined();
  });

  test("limit noto'g'ri turda (raqam bo'lmagan qiymat) RAD etiladi", () => {
    const { error } = paginate.validate({ page: 1, limit: "abc" });
    expect(error).toBeDefined();
  });
});

describe("taskCategory.validation — findAll", () => {
  test("bo'sh obyekt qabul qilinadi (barcha maydon ixtiyoriy)", () => {
    const { error } = findAll.validate({});
    expect(error).toBeUndefined();
  });

  test("active noto'g'ri turda RAD etiladi", () => {
    const { error } = findAll.validate({ active: "yes" });
    expect(error).toBeDefined();
  });
});

describe("taskCategory.validation — idSchema", () => {
  test("to'g'ri id qabul qilinadi", () => {
    const { error } = idSchema.validate({ id: "64b2f0c2a1b2c3d4e5f60718" });
    expect(error).toBeUndefined();
  });

  test("id majburiy (yo'q bo'lsa xato)", () => {
    const { error } = idSchema.validate({});
    expect(error).toBeDefined();
  });

  test("id noto'g'ri turda (raqam) RAD etiladi", () => {
    const { error } = idSchema.validate({ id: 123 });
    expect(error).toBeDefined();
  });
});
