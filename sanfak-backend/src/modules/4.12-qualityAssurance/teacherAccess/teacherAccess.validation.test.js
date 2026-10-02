const { teacherAccessSchema } = require("./teacherAccess.validation");

const ok = (value) => teacherAccessSchema.validate(value).error === undefined;

describe("teacherAccessSchema", () => {
  test("faol qilish — sanasiz ham to'g'ri", () => {
    expect(ok({ active: true })).toBe(true);
    expect(ok({ active: false, activeFrom: null })).toBe(true);
  });

  test("`YYYY-MM-DD` — to'g'ri", () => {
    expect(ok({ active: false, activeFrom: "2026-10-01" })).toBe(true);
  });

  test("boshqa sana formati — RAD etiladi", () => {
    expect(ok({ active: false, activeFrom: "01.10.2026" })).toBe(false);
    expect(ok({ active: false, activeFrom: "2026-10-01T00:00:00Z" })).toBe(false);
    expect(ok({ active: false, activeFrom: "nosana" })).toBe(false);
  });

  test("`active` majburiy", () => {
    expect(ok({ activeFrom: "2026-10-01" })).toBe(false);
  });

  test("begona maydon — RAD etiladi (allowlist)", () => {
    expect(ok({ active: true, teacher: "6a439099c8a1cdc8767be49f" })).toBe(false);
  });
});
