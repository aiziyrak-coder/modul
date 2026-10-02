const { toGlobalSemKey, semesterDisplayNo } = require("./semesterKey");

describe("toGlobalSemKey — (kurs-1)*2 + lokal", () => {
  test.each([
    ["1", 1, "1"],
    ["2", 1, "2"],
    ["1", 3, "5"],
    ["2", 3, "6"],
    ["1", 6, "11"],
    ["2", 6, "12"],
    [2, "4", "8"],
  ])("lokal %s, kurs %s → %s", (local, course, expected) => {
    expect(toGlobalSemKey(local, course)).toBe(expected);
  });

  test.each([
    ["1", undefined],
    ["1", null],
    ["1", 0],
    ["1", 1.5],
    ["1", "III"],
    ["0", 2],
    ["x", 2],
  ])("noto'g'ri kirish (lokal %s, kurs %s) → null", (local, course) => {
    expect(toGlobalSemKey(local, course)).toBeNull();
  });
});

describe("semesterDisplayNo — ko'rsatish uchun, hech qachon bo'sh emas", () => {
  test("kurs bo'lsa global raqam", () => {
    expect(semesterDisplayNo("1", 3)).toBe("5");
    expect(semesterDisplayNo("2", 3)).toBe("6");
  });

  test("kurs bo'lmasa lokal kalitning o'zi (eski hujjat / fixture)", () => {
    expect(semesterDisplayNo("1", undefined)).toBe("1");
    expect(semesterDisplayNo("2", null)).toBe("2");
    expect(semesterDisplayNo(2, "III")).toBe("2");
  });
});
