"use strict";

const V = require("./residencySession.validation");

const ID = "a".repeat(24);
const body = (extra = {}) => ({
  day: "2026-09-28",
  group: ID,
  science: "b".repeat(24),
  lessonType: "amaliy",
  hours: 2,
  ...extra,
});
const errorOf = (schema, value) => schema.validate(value).error?.message;

describe("announceSchema", () => {
  test("to'g'ri tana o'tadi", () => {
    expect(V.announceSchema.validate(body())).toEqual({ value: body() });
  });

  test.each(["day", "group", "science", "lessonType", "hours"])("`%s` siz — xato", (key) => {
    const b = body();
    delete b[key];
    expect(errorOf(V.announceSchema, b)).toContain(key);
  });

  test.each([0, 9, 2.5, "x"])("hours %p — rad", (hours) => {
    expect(errorOf(V.announceSchema, body({ hours }))).toBeDefined();
  });

  test.each(["2026-2-3", "2026-02-30", "26-09-27", "2026-09-28T00:00:00Z", 20260928])("day %p — rad", (day) => {
    expect(errorOf(V.announceSchema, body({ day }))).toBe("Sana YYYY-MM-DD ko'rinishida bo'lishi kerak");
  });

  test("noto'g'ri lessonType va ObjectId — rad", () => {
    expect(errorOf(V.announceSchema, body({ lessonType: "seminar" }))).toBeDefined();
    expect(errorOf(V.announceSchema, body({ group: "123" }))).toBeDefined();
  });

  test("`teacher`/`announcedBy` jimgina olib tashlanadi (D-17)", () => {
    const { value, error } = V.announceSchema.validate(body({ teacher: ID, announcedBy: ID }));
    expect(error).toBeUndefined();
    expect(value).toEqual(body());
  });

  test.each(["status", "rosterScope", "groupTitle", "date"])("noma'lum `%s` — 400", (key) => {
    expect(errorOf(V.announceSchema, body({ [key]: "x" }))).toBe(`"${key}" is not allowed`);
  });
});

describe("cancelSchema", () => {
  test.each([
    [{}, "sababi"],
    [{ reason: "a" }, "qisqa"],
    [{ reason: "x".repeat(501) }, "500"],
  ])("%p — rad", (value, fragment) => {
    expect(errorOf(V.cancelSchema, value)).toContain(fragment);
  });

  test("trim", () => {
    expect(V.cancelSchema.validate({ reason: "  ab  " }).value).toEqual({ reason: "ab" });
  });
});

describe("paginateQuery / unsupervisedQuery / idSchema", () => {
  test("default page 1, limit 20; bo'sh qiymatlar ham default", () => {
    expect(V.paginateQuery.validate({}).value).toEqual({ page: 1, limit: 20 });
    expect(V.paginateQuery.validate({ page: "", limit: null }).value).toEqual({ page: 1, limit: 20 });
    expect(V.unsupervisedQuery.validate({}).value).toEqual({ page: 1, limit: 20 });
  });

  test("limit 101 va noto'g'ri sana formati — rad", () => {
    expect(errorOf(V.paginateQuery, { limit: 101 })).toBeDefined();
    expect(errorOf(V.paginateQuery, { from: "2026-9-1" })).toBeDefined();
    expect(errorOf(V.paginateQuery, { status: "loyiha" })).toBeDefined();
  });

  test("filtrlar qabul qilinadi; bo'sh ObjectId → null", () => {
    const q = { from: "2026-09-01", to: "2026-09-30", group: ID, lessonType: "maruza", status: "cancelled", language: "uz" };
    expect(V.paginateQuery.validate(q).value).toMatchObject(q);
    expect(V.paginateQuery.validate({ group: "" }).value.group).toBeNull();
  });

  test("idSchema", () => {
    expect(errorOf(V.idSchema, { id: ID })).toBeUndefined();
    expect(errorOf(V.idSchema, { id: "paginate" })).toBeDefined();
  });
});
