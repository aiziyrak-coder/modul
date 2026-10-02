jest.mock("#shared/winston.logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));
jest.mock("#system/notification/notification.model", () => ({
  updateMany: jest.fn(),
}));

const winston = require("#shared/winston.logger");
const Notification = require("#system/notification/notification.model");
const {
  EVENT_TYPE,
  WARNING_HOURS,
  EXPULSION_HOURS,
  revokeWarning,
  revokeWarningInBackground,
  clearWarningIfBelowThreshold,
} = require("./attendanceWarning");

beforeEach(() => jest.clearAllMocks());

describe("clearWarningIfBelowThreshold", () => {
  test("🔴 soat ostonadan PASTGA tushdi — bayroq tozalanadi", () => {
    const update = { totalUnexcusedHours: 2 };
    const cleared = clearWarningIfBelowThreshold({ warningIssued: true }, 2, update);

    expect(cleared).toBe(true);
    expect(update.warningIssued).toBe(false);
    expect(update.warningIssuedAt).toBeNull();
    expect(update.totalUnexcusedHours).toBe(2);
  });

  test("soat hamon ostonada — TEGILMAYDI", () => {
    const update = {};
    expect(clearWarningIfBelowThreshold({ warningIssued: true }, WARNING_HOURS, update)).toBe(false);
    expect(update).toEqual({});
  });

  test("ogohlantirish umuman berilmagan — ortiqcha yozuv yo'q", () => {
    const update = {};
    expect(clearWarningIfBelowThreshold({ warningIssued: false }, 0, update)).toBe(false);
    expect(update).toEqual({});
  });

  test("rezident topilmadi — yiqilmaydi", () => {
    expect(clearWarningIfBelowThreshold(null, 0, {})).toBe(false);
    expect(clearWarningIfBelowThreshold(undefined, 0, {})).toBe(false);
  });

  test("0 soat ham ostonadan past — tozalanadi", () => {
    const update = {};
    expect(clearWarningIfBelowThreshold({ warningIssued: true }, 0, update)).toBe(true);
    expect(update.warningIssued).toBe(false);
  });
});

describe("revokeWarning", () => {
  test("🔴 FAQAT shu foydalanuvchining FAOL ogohlantirishi olib tashlanadi", async () => {
    Notification.updateMany.mockResolvedValue({ modifiedCount: 1 });

    await expect(revokeWarning("u1")).resolves.toBe(1);

    const [filter, patch] = Notification.updateMany.mock.calls[0];
    expect(filter).toEqual({ user: "u1", eventType: EVENT_TYPE, active: true });
    expect(patch).toEqual({ active: false });
  });

  test("foydalanuvchi yo'q (OneID bog'lanmagan talaba) — so'rov yuborilmaydi", async () => {
    await expect(revokeWarning(null)).resolves.toBe(0);
    await expect(revokeWarning(undefined)).resolves.toBe(0);
    expect(Notification.updateMany).not.toHaveBeenCalled();
  });

  test("`modifiedCount` yo'q bo'lsa 0 qaytadi", async () => {
    Notification.updateMany.mockResolvedValue({});
    await expect(revokeWarning("u1")).resolves.toBe(0);
  });
});

describe("revokeWarningInBackground", () => {
  test("sinxron qaytadi — chaqiruvchini kutdirmaydi", () => {
    Notification.updateMany.mockResolvedValue({ modifiedCount: 1 });
    expect(revokeWarningInBackground("u1")).toBeUndefined();
  });

  test("xato yutiladi va log'ga tushadi — ariza tasdig'i yiqilmaydi", async () => {
    Notification.updateMany.mockImplementationOnce(() => Promise.reject(new Error("mongo tushdi")));

    expect(() => revokeWarningInBackground("u1")).not.toThrow();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(winston.error).toHaveBeenCalled();
    expect(winston.error.mock.calls[0][0]).toMatch(/attendanceWarning/);
  });
});

describe("ostonalar YAGONA joyda", () => {
  test("TZ 4.5.4 raqamlari", () => {
    expect(WARNING_HOURS).toBe(6);
    expect(EXPULSION_HOURS).toBe(72);
  });
});
