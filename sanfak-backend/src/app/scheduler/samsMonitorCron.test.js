let mockTickLoaded = false;
jest.mock("node-cron", () => ({ schedule: jest.fn() }));
jest.mock("#modules/4.05-residency/samsIngest/samsMonitorTick", () => {
  mockTickLoaded = true;
  return { runSamsMonitorTick: jest.fn().mockResolvedValue(true) };
});
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const cron = require("node-cron");
const winston = require("#shared/winston.logger");

describe("samsMonitorCron", () => {
  let mod;
  beforeEach(() => {
    jest.clearAllMocks();
    mod = require("./samsMonitorCron");
  });

  test("require — hech narsa rejalashtirilmaydi, tik moduli yuklanmaydi", () => {
    expect(cron.schedule).not.toHaveBeenCalled();
    expect(mockTickLoaded).toBe(false);
  });

  test("start: '7-59/15 * * * *' (haqiqiy node-cron uni qabul qiladi), bitta info qatori", () => {
    mod.startSamsMonitorCron();
    expect(cron.schedule).toHaveBeenCalledTimes(1);
    expect(cron.schedule.mock.calls[0][0]).toBe("7-59/15 * * * *");
    expect(jest.requireActual("node-cron").validate("7-59/15 * * * *")).toBe(true);
    expect(winston.info).toHaveBeenCalledWith(expect.stringContaining("[SamsMonitorCron]"));
  });

  test("callback tikka delegat qiladi; tik yiqilsa — faqat error log", async () => {
    const tick = jest.requireMock("#modules/4.05-residency/samsIngest/samsMonitorTick");
    mod.startSamsMonitorCron();
    const callback = cron.schedule.mock.calls[0][1];
    await expect(callback()).resolves.toBe(true);
    expect(tick.runSamsMonitorTick).toHaveBeenCalledTimes(1);
    tick.runSamsMonitorTick.mockRejectedValueOnce(new Error("boom"));
    await expect(callback()).resolves.toBe(false);
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("tik yiqildi: boom"));
  });

  test("tik moduli yuklanmasa — boot yiqilmaydi, faqat error log", async () => {
    jest.resetModules();
    jest.doMock("#modules/4.05-residency/samsIngest/samsMonitorTick", () => {
      throw new Error("OverwriteModelError");
    });
    const freshCron = require("node-cron");
    const freshLog = require("#shared/winston.logger");
    require("./samsMonitorCron").startSamsMonitorCron();
    await expect(freshCron.schedule.mock.calls[0][1]()).resolves.toBe(false);
    expect(freshLog.error).toHaveBeenCalledWith(expect.stringContaining("tik moduli yuklanmadi: OverwriteModelError"));
  });
});
