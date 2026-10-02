const stripFileUrlQuery = require("./stripFileUrlQuery");

describe("stripFileUrlQuery", () => {
  test("D-019 imzo query'si (?t=...&e=...) kesiladi", () => {
    const url =
      "http://host/files/file/learning-process/167890.xlsx?t=55c28546c7a7d5bcf801b2c6a1e60263&e=2101457655";
    expect(stripFileUrlQuery(url)).toBe(
      "http://host/files/file/learning-process/167890.xlsx",
    );
  });

  test("query yo'q URL o'zgarishsiz qaytadi", () => {
    const url = "http://host/files/file/learning-process/167890.xlsx";
    expect(stripFileUrlQuery(url)).toBe(url);
  });

  test("bo'sh/undefined/null → chaqiruvchi qulashi shart emas", () => {
    expect(stripFileUrlQuery("")).toBe("");
    expect(stripFileUrlQuery(undefined)).toBe(undefined);
    expect(stripFileUrlQuery(null)).toBe(null);
  });

  test("string bo'lmagan qiymat xavfsiz o'tkaziladi", () => {
    expect(stripFileUrlQuery(123)).toBe(123);
  });
});
