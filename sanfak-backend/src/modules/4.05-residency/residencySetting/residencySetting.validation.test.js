"use strict";

const { updateSettingsSchema } = require("./residencySetting.validation");
const {
  TIME_RE,
  toMinutes,
  DEFAULT_WORK_DAY_FROM,
  DEFAULT_WORK_DAY_TO,
  DEFAULT_ABSENCE_STREAK_DAYS,
  DEFAULT_ABSENCE_WINDOW_DAYS,
  thresholdExceedsWindow,
  workDayOrderError,
  absenceFitError,
} = require("./residencySetting.model");

const v = (body) => updateSettingsSchema.validate(body, { abortEarly: false });

describe("sukut qiymatlari", () => {
  it("klinik ish kuni 09:00–14:00", () => {
    expect(DEFAULT_WORK_DAY_FROM).toBe("09:00");
    expect(DEFAULT_WORK_DAY_TO).toBe("14:00");
  });

  it("qoldirish ostonasi 3 kun", () => {
    expect(DEFAULT_ABSENCE_STREAK_DAYS).toBe(3);
  });

  it("oyna 7 kun (ABS-Q3=A)", () => {
    expect(DEFAULT_ABSENCE_WINDOW_DAYS).toBe(7);
  });

  it("sukut qiymatlari o'z naqshiga mos", () => {
    expect(TIME_RE.test(DEFAULT_WORK_DAY_FROM)).toBe(true);
    expect(TIME_RE.test(DEFAULT_WORK_DAY_TO)).toBe(true);
  });
});

describe("toMinutes", () => {
  it.each([
    ["00:00", 0],
    ["09:00", 540],
    ["09:30", 570],
    ["14:00", 840],
    ["23:59", 1439],
  ])("%s -> %i", (hhmm, want) => {
    expect(toMinutes(hhmm)).toBe(want);
  });

  it.each([null, undefined, "", "9:00", "24:00", "09:60", "salom", 900])(
    "%p -> null",
    (bad) => {
      expect(toMinutes(bad)).toBeNull();
    },
  );
});

describe("vaqt formati", () => {
  it("to'g'ri oraliq qabul qilinadi", () => {
    expect(v({ workDayFrom: "08:00", workDayTo: "18:00" }).error).toBeUndefined();
  });

  it.each(["9:00", "24:00", "09:60", "0900", "09-00", ""])(
    "%p RAD etiladi",
    (bad) => {
      expect(v({ workDayFrom: bad }).error).toBeDefined();
    },
  );

  it("xato xabari qaysi maydon ekanini aytadi", () => {
    expect(v({ workDayTo: "25:00" }).error.message).toContain("Ish kuni tugashi");
  });
});

describe("oraliq tartibi", () => {
  it("🔴 boshlanish tugashdan KEYIN — rad etiladi", () => {
    const { error } = v({ workDayFrom: "15:00", workDayTo: "09:00" });
    expect(error.message).toContain("oldin bo'lishi kerak");
  });

  it("teng qiymatlar ham rad etiladi (nol uzunlikdagi kun)", () => {
    expect(v({ workDayFrom: "09:00", workDayTo: "09:00" }).error).toBeDefined();
  });

  it("yolg'iz chegara Joi darajasida o'tadi (controller qayta tekshiradi)", () => {
    expect(v({ workDayTo: "08:00" }).error).toBeUndefined();
  });
});

describe("qoldirish ostonasi", () => {
  it.each([1, 3, 30])("%i kun qabul qilinadi", (n) => {
    expect(v({ absenceStreakDays: n }).error).toBeUndefined();
  });

  it.each([0, -1, 31, 2.5])("%p RAD etiladi", (n) => {
    expect(v({ absenceStreakDays: n }).error).toBeDefined();
  });

  it("0 kun «har doim bildirgi» degani bo'lardi", () => {
    expect(v({ absenceStreakDays: 0 }).error.message).toContain("kamida 1 kun");
  });
});

describe("oyna W (ABS-Q6=A)", () => {
  it.each([1, 7, 30])("%i kun qabul qilinadi", (w) => {
    expect(v({ absenceWindowDays: w }).error).toBeUndefined();
  });

  it.each([0, -1, 31, 2.5])("%p RAD etiladi", (w) => {
    expect(v({ absenceWindowDays: w }).error).toBeDefined();
  });

  it("0 kun — tushunarli xabar", () => {
    expect(v({ absenceWindowDays: 0 }).error.message).toContain("Oyna kamida 1 kun");
  });

  it("🔴 ikkalasi kelganda N > W rad etiladi", () => {
    const { error } = v({ absenceStreakDays: 8, absenceWindowDays: 7 });
    expect(error.message).toContain("oyna kunlaridan");
  });

  it("N = W qabul qilinadi", () => {
    expect(v({ absenceStreakDays: 7, absenceWindowDays: 7 }).error).toBeUndefined();
  });

  it("yolg'iz N=30 yoki W=1 Joi darajasida o'tadi (controller qayta tekshiradi)", () => {
    expect(v({ absenceStreakDays: 30 }).error).toBeUndefined();
    expect(v({ absenceWindowDays: 1 }).error).toBeUndefined();
  });
});

describe("qisman PUT tekshiruvlari — saqlangan qiymat bilan", () => {
  const current = { workDayFrom: "09:00", workDayTo: "14:00", absenceStreakDays: 3, absenceWindowDays: 7 };

  it.each([
    [3, 7, false],
    [7, 7, false],
    [8, 7, true],
    [null, 7, false],
    [3, undefined, false],
  ])("thresholdExceedsWindow(%p, %p) -> %p", (n, w, want) => {
    expect(thresholdExceedsWindow(n, w)).toBe(want);
  });

  it("yolg'iz N=8 saqlangan W=7 bilan — xato", () => {
    expect(absenceFitError({ absenceStreakDays: 8 }, current)).toContain("oyna kunlaridan");
  });

  it("yolg'iz W=2 saqlangan N=3 bilan — xato", () => {
    expect(absenceFitError({ absenceWindowDays: 2 }, current)).toContain("oyna kunlaridan");
  });

  it("N ham, W ham yuborilmagan — tekshirilmaydi (eski N > 7 ish kuni saqlashni to'smaydi)", () => {
    expect(absenceFitError({ workDayFrom: "08:00" }, { ...current, absenceStreakDays: 9 })).toBeNull();
  });

  it("ikkalasi mos — null", () => {
    expect(absenceFitError({ absenceStreakDays: 8, absenceWindowDays: 10 }, current)).toBeNull();
  });

  it("eski singleton (W yo'q) — N ≤ W tekshiruvi o'tkazib yuborilmaydi, sukut bilan keladi", () => {
    expect(absenceFitError({ absenceStreakDays: 8 }, { ...current, absenceWindowDays: 7 })).not.toBeNull();
  });

  it("ish kuni tartibi — yolg'iz `workDayTo` saqlangan boshlanishdan oldin", () => {
    expect(workDayOrderError({ workDayTo: "08:00" }, current)).toContain("oldin bo'lishi kerak");
    expect(workDayOrderError({ workDayTo: "15:00" }, current)).toBeNull();
  });
});

describe("noma'lum va bo'sh tana", () => {
  it("bo'sh tana RAD etiladi (jimgina «yangilandi» bo'lmasin)", () => {
    expect(v({}).error).toBeDefined();
  });

  it("noma'lum kalit RAD etiladi", () => {
    expect(v({ workDayFrom: "09:00", nimadir: 1 }).error).toBeDefined();
  });

  it("`updatedBy` ni mijoz yubora olmaydi (audit maydoni)", () => {
    expect(v({ updatedBy: "6a5a0acbd34b3c21a575d59d" }).error).toBeDefined();
  });
});
