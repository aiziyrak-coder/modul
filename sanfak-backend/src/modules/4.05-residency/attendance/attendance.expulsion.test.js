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

const { notify } = require("#system/notification/notification.service");
const winston = require("#shared/winston.logger");
const { _notifyInBackground } = require("./attendance.controller");

describe("checkExpulsion — xabarnoma so'rovni bloklamaydi", () => {
  beforeEach(() => jest.clearAllMocks());

  test("HECH QACHON tugamaydigan `notify` ham chaqiruvni ushlab turmaydi", async () => {
    notify.mockReturnValue(new Promise(() => {}));

    const boshlandi = Date.now();
    const natija = _notifyInBackground({ message: "x", type: "telegram" });
    const ketganVaqt = Date.now() - boshlandi;

    expect(natija).toBeUndefined();
    expect(ketganVaqt).toBeLessThan(50);
  });

  test("`notify` xato bersa — yutiladi va log'ga tushadi (chaqiruvchi yiqilmaydi)", async () => {
    notify.mockRejectedValue(new Error("Telegram 502"));

    expect(() => _notifyInBackground({ message: "x" })).not.toThrow();

    await new Promise((r) => setImmediate(r));

    expect(winston.error).toHaveBeenCalledWith(
      expect.stringContaining("Telegram 502"),
    );
  });

  test("`notify` sinxron throw qilsa ham chaqiruvchiga o'tmaydi", async () => {
    notify.mockImplementation(() => {
      throw new Error("bot ishga tushmagan");
    });

    expect(() => _notifyInBackground({ message: "x" })).not.toThrow();
    await new Promise((r) => setImmediate(r));

    expect(winston.error).toHaveBeenCalledWith(
      expect.stringContaining("bot ishga tushmagan"),
    );
  });

  test("muvaffaqiyatli holatda ham xabar yuboriladi", async () => {
    notify.mockResolvedValue({ ok: true });

    _notifyInBackground({ message: "salom", type: "telegram" });
    await new Promise((r) => setImmediate(r));

    expect(notify).toHaveBeenCalledWith({ message: "salom", type: "telegram" });
    expect(winston.error).not.toHaveBeenCalled();
  });
});
