const {
  DEFAULT_ALLOWED_STAKES,
  getAllowedStakes,
  isAllowedStake,
} = require("./workloadValidator");

describe("workloadValidator — getAllowedStakes (ADR-006 fallback)", () => {
  test("norma=null → DEFAULT 4 qiymat", () => {
    expect(getAllowedStakes(null)).toEqual([0.25, 0.5, 0.75, 1.0]);
    expect(getAllowedStakes(null)).toEqual(DEFAULT_ALLOWED_STAKES);
  });

  test("norma.allowedStakes=[] (bo'sh) → DEFAULT 4 qiymat (bo'sh dropdown TAQIQ)", () => {
    expect(getAllowedStakes({ allowedStakes: [] })).toEqual([
      0.25, 0.5, 0.75, 1.0,
    ]);
  });

  test("norma.allowedStakes to'ldirilgan → o'sha ro'yxat qaytadi", () => {
    expect(getAllowedStakes({ allowedStakes: [0.5, 1, 1.5] })).toEqual([
      0.5, 1, 1.5,
    ]);
  });
});

describe("workloadValidator — isAllowedStake", () => {
  test("ro'yxatdagi qiymat → true", () => {
    expect(isAllowedStake({ allowedStakes: [0.5, 1, 1.5] }, 1)).toBe(true);
    expect(isAllowedStake(null, 0.25)).toBe(true);
  });

  test("ro'yxatdan tashqari qiymat → false", () => {
    expect(isAllowedStake({ allowedStakes: [0.5, 1, 1.5] }, 1.25)).toBe(
      false,
    );
    expect(isAllowedStake(null, 1.25)).toBe(false);
  });
});
