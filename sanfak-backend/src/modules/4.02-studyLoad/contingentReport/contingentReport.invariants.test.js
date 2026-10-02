"use strict";

const {
  rowInvariantError,
  foreignRowInvariantError,
  collectInvariantViolations,
} = require("./contingentReport.invariants");

const validBase = {
  direction: "d1",
  directionTitle: "Davolash ishi",
  course: 1,
  total: 10,
  boys: 6,
  girls: 4,
  grant: 7,
  contract: 3,
  grantBoys: 4,
  grantGirls: 3,
  contractBoys: 2,
  contractGirls: 1,
};

describe("rowInvariantError — to'rt qoida", () => {
  test("mos qator — xato yo'q", () => {
    expect(rowInvariantError(validBase)).toBeNull();
  });

  test.each([
    ["o'g'il + qiz ≠ jami", { boys: 5 }],
    ["grant + shartnoma ≠ jami", { grant: 6, grantBoys: 3 }],
    ["grant o'g'il + qiz ≠ grant", { grantBoys: 2 }],
    ["shartnoma o'g'il + qiz ≠ shartnoma", { contractGirls: 5 }],
  ])("%s — xato qaytadi", (_label, override) => {
    expect(rowInvariantError({ ...validBase, ...override })).not.toBeNull();
  });

  test("yo'q katak 0 deb o'qiladi (model default) — prefill qatori xato", () => {
    expect(rowInvariantError({ direction: "d1", course: 2, total: 100 })).not.toBeNull();
    expect(rowInvariantError({ direction: "d1", course: 2, total: 0 })).toBeNull();
  });
});

describe("foreignRowInvariantError", () => {
  test("o'g'il + qiz = jami — mos, aks holda xato", () => {
    expect(foreignRowInvariantError({ country: "Hindiston", total: 3, boys: 1, girls: 2 })).toBeNull();
    expect(foreignRowInvariantError({ country: "Hindiston", total: 3, boys: 1, girls: 1 })).not.toBeNull();
  });
});

describe("collectInvariantViolations — butun hujjat", () => {
  test("jadval va xorijiy qatorlardagi BARCHA buzilishlar nomi bilan", () => {
    const violations = collectInvariantViolations({
      rows: [validBase, { ...validBase, course: 2, boys: 0 }],
      foreignByCountry: [{ country: "Hindiston", total: 2, boys: 0, girls: 0 }],
    });
    expect(violations).toEqual([
      { kind: "row", label: "Davolash ishi 2-kurs", message: "o'g'il + qiz jami talabaga teng emas" },
      { kind: "foreign", label: "Hindiston", message: "o'g'il + qiz jami talabaga teng emas" },
    ]);
  });

  test("bo'sh yoki qatorsiz hujjat — buzilish yo'q", () => {
    expect(collectInvariantViolations({})).toEqual([]);
    expect(collectInvariantViolations(null)).toEqual([]);
  });
});
