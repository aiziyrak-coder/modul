const { createSchema, updateSchema, listQuery, paginateQuery } = require("./residencyLesson.validation");

const validCreate = {
  science: "64b2f0c2a1b2c3d4e5f60718",
  startDate: "2030-01-01",
  endDate: "2030-01-02",
};

describe("residencyLesson.validation — D-074 (base + create .required() override)", () => {
  test("createSchema — startDate/endDate haqiqiy sana bilan qabul qilinadi", () => {
    const { error } = createSchema.validate(validCreate);
    expect(error).toBeUndefined();
  });

  test("createSchema — startDate:'' RAD ETILADI (required override .empty()dan keyin ham ishlaydi)", () => {
    const { error } = createSchema.validate({ ...validCreate, startDate: "" });
    expect(error).toBeDefined();
  });

  test("createSchema — endDate:'' RAD ETILADI", () => {
    const { error } = createSchema.validate({ ...validCreate, endDate: "" });
    expect(error).toBeDefined();
  });

  test("updateSchema — startDate:'' boshqa maydon bilan birga qabul qilinadi VA kalit olib tashlanadi (eski qiymat buzilmaydi)", () => {
    const { error, value } = updateSchema.validate({ startDate: "", academicYear: "2030-2031" });
    expect(error).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value, "startDate")).toBe(false);
  });

  test("updateSchema — active:'' boshqa maydon bilan birga qabul qilinadi", () => {
    const { error, value } = updateSchema.validate({ active: "", academicYear: "2030-2031" });
    expect(error).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value, "active")).toBe(false);
  });

  test("updateSchema — YAGONA maydon sifatida startDate:'' RAD ETILADI (min(1) — yangilanadigan narsa yo'q)", () => {
    const { error } = updateSchema.validate({ startDate: "" });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/at least 1 key/);
  });

  test("listQuery — courseNumber/fromDate/toDate/active/page/limit bo'sh satr bilan qabul qilinadi", () => {
    const { error, value } = paginateQuery.validate({
      courseNumber: "",
      fromDate: "",
      toDate: "",
      active: "",
      page: "",
      limit: "",
    });
    expect(error).toBeUndefined();
    expect(value.page).toBe(1);
    expect(value.limit).toBe(10);
  });
});

describe("residencyLesson.validation — D-014 anti-degenerat (science, ataylab tegilmagan)", () => {
  test("createSchema — science:'' RAD ETILADI", () => {
    const { error } = createSchema.validate({ ...validCreate, science: "" });
    expect(error).toBeDefined();
  });
});

describe("residencyLesson.validation — sana oralig'i (MD-23)", () => {
  test("endDate > startDate — QABUL", () => {
    const { error } = createSchema.validate(validCreate);
    expect(error).toBeUndefined();
  });

  test("endDate === startDate — QABUL (bir kunlik dars)", () => {
    const { error } = createSchema.validate({
      ...validCreate,
      startDate: "2030-01-01",
      endDate: "2030-01-01",
    });
    expect(error).toBeUndefined();
  });

  test("endDate < startDate — RAD (QA jonli takrorlagan holat)", () => {
    const { error } = createSchema.validate({
      ...validCreate,
      startDate: "2026-12-31",
      endDate: "2026-09-01",
    });
    expect(error).toBeDefined();
  });

  test("update: YOLG'IZ endDate Joi `ref` xatosi BERMAYDI", () => {
    const { error } = updateSchema.validate({ endDate: "2026-09-01" });
    expect(error).toBeUndefined();
  });

  test("update: YOLG'IZ startDate ham o'tadi", () => {
    const { error } = updateSchema.validate({ startDate: "2026-09-01" });
    expect(error).toBeUndefined();
  });
});
