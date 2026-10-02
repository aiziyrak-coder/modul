"use strict";

const mockFindOne = jest.fn();
const mockFindById = jest.fn();
const mockFindByIdAndUpdate = jest.fn();
const mockSave = jest.fn();

jest.mock("./residencySetting.model", () => {
  const actual = jest.requireActual("./residencySetting.model");
  function Model(doc) {
    this.doc = doc;
    this.save = () => mockSave(doc);
  }
  Model.findOne = (...a) => mockFindOne(...a);
  Model.findById = (...a) => mockFindById(...a);
  Model.findByIdAndUpdate = (...a) => mockFindByIdAndUpdate(...a);
  Model.DEFAULT_WORK_DAY_FROM = actual.DEFAULT_WORK_DAY_FROM;
  Model.DEFAULT_WORK_DAY_TO = actual.DEFAULT_WORK_DAY_TO;
  Model.DEFAULT_ABSENCE_STREAK_DAYS = actual.DEFAULT_ABSENCE_STREAK_DAYS;
  Model.DEFAULT_ABSENCE_WINDOW_DAYS = actual.DEFAULT_ABSENCE_WINDOW_DAYS;
  return Model;
});

const { getOrCreate, update, withDefaults, DEFAULT } = require("./residencySetting.service");

const lean = (doc) => ({ lean: () => Promise.resolve(doc) });
const LEGACY = { _id: "s1", workDayFrom: "09:00", workDayTo: "14:00", absenceStreakDays: 4 };

beforeEach(() => jest.clearAllMocks());

describe("withDefaults — maydonma-maydon (ABS-Q7=A)", () => {
  it("eski hujjatga W=7 qo'shiladi, qolgani o'zgarmaydi", () => {
    expect(withDefaults(LEGACY)).toEqual({ ...LEGACY, absenceWindowDays: 7 });
  });

  it("saqlangan W ustun", () => {
    expect(withDefaults({ ...LEGACY, absenceWindowDays: 10 }).absenceWindowDays).toBe(10);
  });

  it("hujjat yo'q — null o'tadi", () => {
    expect(withDefaults(null)).toBeNull();
  });

  it("DEFAULT to'rt maydonli: 09:00, 14:00, 3, 7", () => {
    expect(DEFAULT).toEqual({
      workDayFrom: "09:00",
      workDayTo: "14:00",
      absenceStreakDays: 3,
      absenceWindowDays: 7,
    });
  });
});

describe("getOrCreate", () => {
  it("🔴 mavjud eski singleton — W=7 bilan qaytadi", async () => {
    mockFindOne.mockReturnValue(lean(LEGACY));
    await expect(getOrCreate()).resolves.toMatchObject({ absenceStreakDays: 4, absenceWindowDays: 7 });
  });

  it("yangi yaratilganda ham to'ldirilgan", async () => {
    mockFindOne.mockReturnValue(lean(null));
    mockSave.mockResolvedValue({ _id: "s2" });
    mockFindById.mockReturnValue(lean({ _id: "s2", absenceStreakDays: 3 }));
    await expect(getOrCreate()).resolves.toMatchObject({ absenceWindowDays: 7 });
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ absenceWindowDays: 7 }));
  });
});

describe("update", () => {
  it("mavjud hujjat yangilanadi va javob to'ldirilgan", async () => {
    mockFindOne.mockResolvedValue({ _id: "s1" });
    mockFindByIdAndUpdate.mockReturnValue(lean({ ...LEGACY, absenceStreakDays: 5 }));
    await expect(update({ absenceStreakDays: 5 }, "u1")).resolves.toMatchObject({
      absenceStreakDays: 5,
      absenceWindowDays: 7,
    });
    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
      "s1",
      { absenceStreakDays: 5, updatedBy: "u1" },
      expect.objectContaining({ runValidators: true }),
    );
  });
});
