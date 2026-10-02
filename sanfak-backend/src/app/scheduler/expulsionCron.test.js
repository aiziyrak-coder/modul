jest.mock("#modules/4.05-residency/attendance/attendance.model");
jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("#system/notification/notification.service", () => ({
  notify: jest.fn().mockResolvedValue(undefined),
  templates: {
    expulsionWarning: (ism, soat) => `${ism} — ${soat} soat`,
    expulsionOrder: (ism) => `${ism} — chetlatish`,
  },
}));
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.05-residency/_services/expulsionOrderLifecycle", () => ({
  openDraft: jest.fn().mockResolvedValue({ opened: true, orderId: "order1" }),
  cancelDraftBelowThreshold: jest.fn().mockResolvedValue(undefined),
  settleDraftNotices: jest.fn().mockResolvedValue(undefined),
  reconcileDrafts: jest.fn().mockResolvedValue(undefined),
  markNoticesSent: jest.fn().mockResolvedValue(undefined),
  findUnannouncedDrafts: jest.fn().mockResolvedValue([]),
  findUndeliveredDecisions: jest.fn().mockResolvedValue([]),
  findDueReminders: jest.fn().mockResolvedValue([]),
}));
jest.mock("#modules/4.05-residency/_services/autoAbsenceNotice", () => ({ syncAbsenceNotices: jest.fn().mockResolvedValue({ issued: 0, revoked: 0, announced: 0 }) }));

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const { notify } = require("#system/notification/notification.service");

jest.mock("node-cron", () => ({ schedule: jest.fn() }));
const cron = require("node-cron");
const { startExpulsionCron } = require("./expulsionCron");

const makeResident = (overrides = {}) => ({
  _id: "resident1",
  user: { _id: "u-resident", firstName: "Ali", lastName: "Valiyev" },
  warningIssued: false,
  expulsionOrderCreated: false,
  ...overrides,
});

startExpulsionCron();
const cronCallback = cron.schedule.mock.calls[0][1];
const run = () => cronCallback();

beforeEach(() => {
  jest.clearAllMocks();
  Attendance.find = jest.fn().mockResolvedValue([]);
  Resident.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
});

describe("expulsionCron — 6 soat ostonasi (ogohlantirish)", () => {
  test("rezidentning o'ziga in-app dispatch ketadi, overrideChannels:{inApp:true}", async () => {
    const resident = makeResident();
    Resident.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([resident]),
    });
    Attendance.find = jest.fn().mockResolvedValue(
      Array.from({ length: 3 }, () => ({ hours: 2 })),
    );

    await run();

    expect(notify).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-resident",
        eventType: "residency_attendance_warning",
        overrideChannels: { inApp: true },
      }),
    );
  });

  test("resident.user yo'q — in-app dispatch chaqirilmaydi (Telegram hamon ketadi)", async () => {
    const resident = makeResident({ user: null });
    Resident.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([resident]),
    });
    Attendance.find = jest.fn().mockResolvedValue(
      Array.from({ length: 3 }, () => ({ hours: 2 })),
    );

    await run();

    expect(notify).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("expulsionCron — 72 soat ostonasi (chetlatish)", () => {
  test("residency_expulsion in-app dispatch ketadi", async () => {
    const resident = makeResident({ warningIssued: true });
    Resident.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([resident]),
    });
    Attendance.find = jest.fn().mockResolvedValue(
      Array.from({ length: 36 }, () => ({ hours: 2 })),
    );

    await run();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-resident",
        eventType: "residency_expulsion",
        overrideChannels: { inApp: true },
      }),
    );
  });
});

describe("expulsionCron — dispatch xatosi butun sweep'ni yiqitmaydi", () => {
  test("dispatch reject qilsa ham Resident.findByIdAndUpdate baribir chaqiriladi", async () => {
    const resident = makeResident();
    Resident.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([resident]),
    });
    Attendance.find = jest.fn().mockResolvedValue(
      Array.from({ length: 3 }, () => ({ hours: 2 })),
    );
    dispatch.mockRejectedValueOnce(new Error("dispatch xato"));

    await expect(run()).resolves.toBe(true);
    expect(Resident.findByIdAndUpdate).toHaveBeenCalled();
  });
});
