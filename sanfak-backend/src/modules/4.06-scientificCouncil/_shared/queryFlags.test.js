const { parseBool, isTrue } = require("./queryFlags");

describe("queryFlags — Joi coercion regressiyasi", () => {
  test("Joi BOOLEAN'ga aylantirgan qiymat tan olinadi", () => {
    expect(isTrue(true)).toBe(true);
    expect(parseBool(true)).toBe(true);
    expect(parseBool(false)).toBe(false);
  });

  test("xom SATR ham tan olinadi (validatorsiz route uchun)", () => {
    expect(isTrue("true")).toBe(true);
    expect(parseBool("true")).toBe(true);
    expect(parseBool("false")).toBe(false);
  });

  test("berilmagan bayroq — `parseBool` undefined (filtr qo'llanmaydi)", () => {
    expect(parseBool(undefined)).toBeUndefined();
    expect(parseBool(null)).toBeUndefined();
    expect(parseBool("")).toBeUndefined();
  });

  test("berilmagan bayroq — `isTrue` false (yoqilmagan)", () => {
    expect(isTrue(undefined)).toBe(false);
    expect(isTrue("")).toBe(false);
    expect(isTrue("1")).toBe(false);
  });
});
