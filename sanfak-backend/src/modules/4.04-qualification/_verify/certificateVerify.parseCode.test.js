const { parseCode } = require("./certificateVerify.service");

describe("certificateVerify.service — parseCode", () => {
  test("guilloche seriya (I) to'g'ri ajratiladi", () => {
    expect(parseCode("I00001")).toEqual({
      template: 1,
      prefix: "I",
      number: "00001",
      reference: false,
    });
  });

  test("MO seriya (ikki harfli prefiks) to'g'ri ajratiladi", () => {
    expect(parseCode("MO00042")).toEqual({
      template: 2,
      prefix: "MO",
      number: "00042",
      reference: false,
    });
  });

  test("MM seriya to'g'ri ajratiladi", () => {
    expect(parseCode("MM00007")).toEqual({
      template: 3,
      prefix: "MM",
      number: "00007",
      reference: false,
    });
  });

  test("MN seriya — MA'LUMOTNOMA (shablonga bog'liq emas)", () => {
    expect(parseCode("MN00005")).toEqual({
      template: null,
      prefix: "MN",
      number: "00005",
      reference: true,
    });
  });

  test("MN va MM prefikslari chalkashmaydi", () => {
    expect(parseCode("MM00001").reference).toBe(false);
    expect(parseCode("MN00001").reference).toBe(true);
  });

  test("kichik harf ham qabul qilinadi (case-insensitive)", () => {
    expect(parseCode("mo00042")).toEqual({
      template: 2,
      prefix: "MO",
      number: "00042",
      reference: false,
    });
    expect(parseCode("mn00042").reference).toBe(true);
  });

  test("bo'sh/null qiymat null qaytaradi", () => {
    expect(parseCode("")).toBeNull();
    expect(parseCode(null)).toBeNull();
    expect(parseCode(undefined)).toBeNull();
  });

  test("noma'lum prefiks null qaytaradi", () => {
    expect(parseCode("XX00001")).toBeNull();
  });

  test("faqat prefiks, raqamsiz — null qaytaradi", () => {
    expect(parseCode("MO")).toBeNull();
    expect(parseCode("MN")).toBeNull();
  });
});
