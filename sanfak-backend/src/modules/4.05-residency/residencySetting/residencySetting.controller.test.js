"use strict";

const mockGetOrCreate = jest.fn();
const mockUpdate = jest.fn();
jest.mock("./residencySetting.service", () => ({
  getOrCreate: (...a) => mockGetOrCreate(...a),
  update: (...a) => mockUpdate(...a),
}));

const { updateSettings } = require("./residencySetting.controller");

const SAVED = { workDayFrom: "09:00", workDayTo: "14:00", absenceStreakDays: 3, absenceWindowDays: 7 };

const run = async (body) => {
  const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
  const next = jest.fn();
  await updateSettings({ body, user: { _id: "u1" } }, res, next);
  return { res, next };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetOrCreate.mockResolvedValue(SAVED);
  mockUpdate.mockImplementation(async (body) => ({ ...SAVED, ...body }));
});

describe("updateSettings — N ≤ W (ABS-Q6=A)", () => {
  it.each([[{ absenceStreakDays: 8 }], [{ absenceWindowDays: 2 }]])(
    "qisman %p saqlangan qiymat bilan to'qnashadi -> 400, yozilmaydi",
    async (body) => {
      const { res } = await run(body);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Sababsiz kunlar soni oyna kunlaridan ko'p bo'lmasligi kerak",
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    },
  );

  it("ikkalasi birga mos -> yoziladi", async () => {
    const { res } = await run({ absenceStreakDays: 8, absenceWindowDays: 10 });
    expect(mockUpdate).toHaveBeenCalledWith({ absenceStreakDays: 8, absenceWindowDays: 10 }, "u1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("ish kuni tartibi ham avvalgidek tekshiriladi", async () => {
    const { res } = await run({ workDayTo: "08:00" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
