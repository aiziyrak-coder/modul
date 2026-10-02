"use strict";

const mockFindById = jest.fn();
jest.mock(
  "#modules/4.11-giftedStudent/evaluationCriteria/evaluationCriteria.model",
  () => ({ findById: (...a) => mockFindById(...a) }),
  { virtual: true },
);

const { validateAchievementScore } = require("./scoringLimits");

const catalogReturns = (doc) =>
  mockFindById.mockReturnValue({ select: () => ({ lean: async () => doc }) });

const CRIT_ID = "6a7efdac5916905f06cebea8";
const CAT_50 = "6a7efdac5916905f06cebea4";
const CAT_20 = "6a7efdac5916905f06cebea5";

const CATEGORISED = {
  name: "Ilmiy maqola",
  maxPoints: undefined,
  categories: [
    { _id: CAT_50, name: "Scopus/WoS maqola", points: 50 },
    { _id: CAT_20, name: "Mahalliy jurnal", points: 20 },
  ],
};

beforeEach(() => mockFindById.mockReset());

describe("validateAchievementScore — chegara (MD-02)", () => {
  test("maksimum ICHIDA — qabul", async () => {
    catalogReturns(CATEGORISED);
    expect(
      await validateAchievementScore({ scoreCriteria: CRIT_ID, scoreCategoryId: CAT_50, score: 50 }),
    ).toBeNull();
  });

  test("maksimumdan OSHIQ — rad, xabar ANIQ raqamlar bilan", async () => {
    catalogReturns(CATEGORISED);
    const err = await validateAchievementScore({
      scoreCriteria: CRIT_ID,
      scoreCategoryId: CAT_20,
      score: 500,
    });
    expect(err).toContain("500");
    expect(err).toContain("20");
    expect(err).toContain("Mahalliy jurnal");
  });

  test("JONLI HOLAT: 999 ball, maksimumi 50 — rad", async () => {
    catalogReturns(CATEGORISED);
    expect(
      await validateAchievementScore({ scoreCriteria: CRIT_ID, scoreCategoryId: CAT_50, score: 999 }),
    ).toContain("999 > 50");
  });

  test("aynan maksimum — QABUL (chegara inklyuziv)", async () => {
    catalogReturns(CATEGORISED);
    expect(
      await validateAchievementScore({ scoreCriteria: CRIT_ID, scoreCategoryId: CAT_20, score: 20 }),
    ).toBeNull();
  });
});

describe("validateAchievementScore — CHETLAB O'TISH yo'llari yopilgan", () => {
  test("mezonsiz ball — RAD (aks holda tekshiruvni yubormaslik bilan chetlab bo'lardi)", async () => {
    const err = await validateAchievementScore({ score: 999 });
    expect(err).toContain("mezon");
    expect(mockFindById).not.toHaveBeenCalled();
  });

  test("kategoriyali mezon, kategoriyasiz — RAD", async () => {
    catalogReturns(CATEGORISED);
    expect(
      await validateAchievementScore({ scoreCriteria: CRIT_ID, score: 999 }),
    ).toContain("kategoriya");
  });

  test("begona kategoriya (yetim havola) — RAD", async () => {
    catalogReturns(CATEGORISED);
    expect(
      await validateAchievementScore({
        scoreCriteria: CRIT_ID,
        scoreCategoryId: "6a90235d4a28f1c7ae0e91c9",
        score: 50,
      }),
    ).toContain("tegishli emas");
  });
});

describe("validateAchievementScore — kategoriyasiz mezon", () => {
  test("`maxPoints` ichida — qabul", async () => {
    catalogReturns({ name: "Sertifikat", maxPoints: 15, categories: [] });
    expect(await validateAchievementScore({ scoreCriteria: CRIT_ID, score: 15 })).toBeNull();
  });

  test("`maxPoints` dan oshiq — rad", async () => {
    catalogReturns({ name: "Sertifikat", maxPoints: 15, categories: [] });
    expect(await validateAchievementScore({ scoreCriteria: CRIT_ID, score: 16 })).toContain("16 > 15");
  });

  test("`maxPoints` belgilanmagan — RAD (jimgina cheksiz bo'lib qolmasin)", async () => {
    catalogReturns({ name: "Sertifikat", maxPoints: undefined, categories: [] });
    expect(await validateAchievementScore({ scoreCriteria: CRIT_ID, score: 1 })).toContain(
      "maksimal ball belgilanmagan",
    );
  });
});

describe("validateAchievementScore — TEGILMAYDIGAN holatlar (regressiya qulfi)", () => {
  test.each([
    ["berilmagan", undefined],
    ["null", null],
    ["0", 0],
  ])("score %s — tekshiruv umuman ishlamaydi", async (_label, score) => {
    expect(await validateAchievementScore({ score })).toBeNull();
    expect(mockFindById).not.toHaveBeenCalled();
  });

  test("mezon o'chirilgan bo'lsa — RAD (softDelete `findById` ni ham filtrlaydi)", async () => {
    catalogReturns(null);
    expect(await validateAchievementScore({ scoreCriteria: CRIT_ID, score: 10 })).toContain(
      "topilmadi",
    );
  });
});
