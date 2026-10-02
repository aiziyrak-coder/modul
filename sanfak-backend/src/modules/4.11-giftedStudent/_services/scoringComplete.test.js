const mockFind = jest.fn();
jest.mock(
  "#modules/4.11-giftedStudent/scholarshipApplication/scholarshipApplication.model",
  () => ({ find: (...a) => mockFind(...a) }),
);

const { isScoringComplete, touchesScoring } = require("./scoringComplete");

const J1 = "111111111111111111111111";
const J2 = "222222222222222222222222";
const SCH = { _id: "sch1", type: "rektor", judges: [J1, J2] };

const stubApps = (apps) =>
  mockFind.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(apps) }) });

beforeEach(() => jest.clearAllMocks());

describe("isScoringComplete", () => {
  test("barcha hakamlar barcha arizalarni baholagan → true", async () => {
    stubApps([{ judgeScores: [{ judge: J1 }, { judge: J2 }] }]);
    await expect(isScoringComplete(SCH)).resolves.toBe(true);
  });

  test("bitta hakam baholamagan → false", async () => {
    stubApps([{ judgeScores: [{ judge: J1 }] }]);
    await expect(isScoringComplete(SCH)).resolves.toBe(false);
  });

  test("ikkinchi arizani hech kim baholamagan → false", async () => {
    stubApps([{ judgeScores: [{ judge: J1 }, { judge: J2 }] }, { judgeScores: [] }]);
    await expect(isScoringComplete(SCH)).resolves.toBe(false);
  });

  test("ariza umuman yo'q → false (baholanadigan narsa yo'q)", async () => {
    stubApps([]);
    await expect(isScoringComplete(SCH)).resolves.toBe(false);
  });

  test("hakam tayinlanmagan → false", async () => {
    await expect(isScoringComplete({ ...SCH, judges: [] })).resolves.toBe(false);
  });

  test("nomdor stipendiya — hech qachon 'yakunlangan' emas", async () => {
    await expect(isScoringComplete({ ...SCH, type: "nomdor" })).resolves.toBe(false);
  });
});

describe("touchesScoring", () => {
  test("`active` toggle baholashga tegmaydi (ruxsat)", () => {
    expect(touchesScoring({ active: false })).toBe(false);
  });

  test("minScore / criteria / judges — tegadi (bloklanadi)", () => {
    expect(touchesScoring({ minScore: 40 })).toBe(true);
    expect(touchesScoring({ criteria: [] })).toBe(true);
    expect(touchesScoring({ judges: [] })).toBe(true);
    expect(touchesScoring({ active: true, minScore: 10 })).toBe(true);
  });

  test("bo'sh payload — tegmaydi", () => {
    expect(touchesScoring({})).toBe(false);
  });
});
