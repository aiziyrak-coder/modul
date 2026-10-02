jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn(),
}));

jest.mock("#system/notification/notification.service", () => ({
  notify: jest.fn(),
  templates: {
    expulsionWarning: (ism, soat) => `${ism} — ${soat} soat`,
    expulsionOrder: (ism) => `${ism} — chetlatish`,
  },
}));

jest.mock("#shared/winston.logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const { dispatch } = require("#system/notification/notificationDispatcher");
const winston = require("#shared/winston.logger");
const { _dispatchInAppInBackground } = require("./attendance.controller");

describe("_dispatchInAppInBackground — in-app bildirishnoma so'rovni bloklamaydi", () => {
  beforeEach(() => jest.clearAllMocks());

  test("HECH QACHON tugamaydigan `dispatch` ham chaqiruvni ushlab turmaydi", async () => {
    dispatch.mockReturnValue(new Promise(() => {}));

    const boshlandi = Date.now();
    const natija = _dispatchInAppInBackground({
      userId: "u1",
      eventType: "residency_attendance_warning",
      title: "T",
    });
    const ketganVaqt = Date.now() - boshlandi;

    expect(natija).toBeUndefined();
    expect(ketganVaqt).toBeLessThan(50);
  });

  test("`dispatch` xato bersa — yutiladi va log'ga tushadi (chaqiruvchi yiqilmaydi)", async () => {
    dispatch.mockRejectedValue(new Error("Dispatch xato"));

    expect(() =>
      _dispatchInAppInBackground({ userId: "u1", eventType: "x", title: "T" }),
    ).not.toThrow();
    await new Promise((r) => setImmediate(r));

    expect(winston.error).toHaveBeenCalledWith(
      expect.stringContaining("Dispatch xato"),
    );
  });

  test("`dispatch` sinxron throw qilsa ham chaqiruvchiga o'tmaydi", async () => {
    dispatch.mockImplementation(() => {
      throw new Error("dispatcher ishga tushmagan");
    });

    expect(() =>
      _dispatchInAppInBackground({ userId: "u1", eventType: "x", title: "T" }),
    ).not.toThrow();
    await new Promise((r) => setImmediate(r));

    expect(winston.error).toHaveBeenCalledWith(
      expect.stringContaining("dispatcher ishga tushmagan"),
    );
  });

  test("overrideChannels:{inApp:true} bilan chaqiriladi (Telegram dublikat bo'lmasin)", async () => {
    dispatch.mockResolvedValue({ notification: {}, channels: ["inApp"] });

    _dispatchInAppInBackground({
      userId: "u1",
      eventType: "residency_attendance_warning",
      title: "T",
      body: "B",
    });
    await new Promise((r) => setImmediate(r));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        eventType: "residency_attendance_warning",
        title: "T",
        body: "B",
        overrideChannels: { inApp: true },
      }),
    );
  });
});
