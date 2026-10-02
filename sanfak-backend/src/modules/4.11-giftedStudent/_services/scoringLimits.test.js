const mockFind = jest.fn();
jest.mock("#modules/4.11-giftedStudent/evaluationCriteria/evaluationCriteria.model", () => ({
  find: (...a) => mockFind(...a),
}));

const { buildMaxScoreMap, validateScores } = require("./scoringLimits");

const CRIT = "6a54b1e5b48443f1b2cebea8";
const CAT1 = "6a54b1e5b48443f1b2cebea4";
const CAT2 = "6a54b1e5b48443f1b2cebea5";
const CRIT2 = "6a7029b2b28f6431f7d6a178";

const catalog = [
  {
    _id: CRIT,
    categories: [
      { _id: CAT1, name: "Scopus/WoS", points: 50 },
      { _id: CAT2, name: "Mahalliy", points: 20 },
    ],
  },
  { _id: CRIT2, maxPoints: 28 },
];

const stubCatalog = () =>
  mockFind.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(catalog) }) });

const scholarship = {
  criteria: [
    {
      criteria: CRIT,
      categoryIds: [CAT1, CAT2],
      pointOverrides: [
        { categoryId: CAT1, points: 40 },
        { categoryId: CAT2, points: 12 },
      ],
    },
    { criteria: CRIT2, categoryIds: [], typePointOverride: 18 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  stubCatalog();
});

describe("buildMaxScoreMap", () => {
  test("override'lar katalog ballaridan ustun turadi", async () => {
    const max = await buildMaxScoreMap(scholarship);
    expect(max.get(`${CRIT}|${CAT1}`)).toBe(40);
    expect(max.get(`${CRIT}|${CAT2}`)).toBe(12);
    expect(max.get(`${CRIT2}|`)).toBe(18);
  });

  test("override bo'lmasa katalog qiymati olinadi", async () => {
    const max = await buildMaxScoreMap({
      criteria: [
        { criteria: CRIT, categoryIds: [CAT1], pointOverrides: [] },
        { criteria: CRIT2, categoryIds: [] },
      ],
    });
    expect(max.get(`${CRIT}|${CAT1}`)).toBe(50);
    expect(max.get(`${CRIT2}|`)).toBe(28);
  });
});

describe("validateScores", () => {
  test("chegara ichidagi ballar qabul qilinadi", async () => {
    const err = await validateScores(scholarship, [
      { criteria: CRIT, categoryId: CAT1, value: 40 },
      { criteria: CRIT, categoryId: CAT2, value: 0 },
      { criteria: CRIT2, value: 17 },
    ]);
    expect(err).toBeNull();
  });

  test("maksimaldan KATTA ball rad etiladi", async () => {
    const err = await validateScores(scholarship, [
      { criteria: CRIT, categoryId: CAT1, value: 9999 },
    ]);
    expect(err).toMatch(/9999 > 40/);
  });

  test("1 ball oshgani ham rad etiladi (chegara)", async () => {
    const err = await validateScores(scholarship, [
      { criteria: CRIT, categoryId: CAT2, value: 13 },
    ]);
    expect(err).toMatch(/13 > 12/);
  });

  test("yo'nalishga tegishli bo'lmagan mezon rad etiladi", async () => {
    const err = await validateScores(scholarship, [
      { criteria: "ffffffffffffffffffffffff", value: 5 },
    ]);
    expect(err).toMatch(/baholash ro'yxatida yo'q/);
  });

  test("tanlanmagan kategoriya rad etiladi", async () => {
    const err = await validateScores(
      { criteria: [{ criteria: CRIT, categoryIds: [CAT1], pointOverrides: [] }] },
      [{ criteria: CRIT, categoryId: CAT2, value: 5 }],
    );
    expect(err).toMatch(/baholash ro'yxatida yo'q/);
  });
});
