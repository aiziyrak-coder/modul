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
jest.mock("#modules/4.05-residency/_services/residentNotify", () => ({
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyResident: jest.fn().mockResolvedValue(undefined),
  EVENTS: {
    ATTENDANCE_WARNING_SUPERVISOR: "supervisor_event",
    EXPULSION_DRAFT_OFFICE: "residency_expulsion_draft_office",
  },
  LINKS: {
    ATTENDANCE: "/residency/davomat",
    ATTENDANCE_OFFICE: "/residency/davomat",
  },
}));
jest.mock("./attendanceWarning", () => {
  const real = jest.requireActual("./attendanceWarning");
  return { ...real, revokeWarningInBackground: jest.fn() };
});
jest.mock("./officeRecipients", () => ({
  officeUserIds: jest.fn().mockResolvedValue(["office-1", "office-2"]),
}));
jest.mock("./expulsionOrderLifecycle", () => ({
  openDraft: jest.fn(),
  cancelDraftBelowThreshold: jest.fn(),
  settleDraftNotices: jest.fn().mockResolvedValue(undefined),
  reconcileDrafts: jest.fn().mockResolvedValue(undefined),
  markNoticesSent: jest.fn().mockResolvedValue(undefined),
  findUnannouncedDrafts: jest.fn().mockResolvedValue([]),
  findUndeliveredDecisions: jest.fn().mockResolvedValue([]),
  findDueReminders: jest.fn().mockResolvedValue([]),
}));
jest.mock("./autoAbsenceNotice", () => ({ syncAbsenceNotices: jest.fn().mockResolvedValue({ issued: 0, revoked: 0, announced: 0 }) }));
jest.mock("#shared/winston.logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const {
  notifyUser,
} = require("#modules/4.05-residency/_services/residentNotify");
const { officeUserIds } = require("./officeRecipients");
const {
  openDraft,
  cancelDraftBelowThreshold,
} = require("./expulsionOrderLifecycle");
const { notify } = require("#system/notification/notification.service");
const { dispatch } = require("#system/notification/notificationDispatcher");
const winston = require("#shared/winston.logger");
const {
  WARNING_HOURS,
  EXPULSION_HOURS,
  revokeWarningInBackground,
} = require("./attendanceWarning");
const {
  evaluateResident,
  sumUnexcusedHours,
  runExpulsionCheck,
  runExpulsionSweep,
} = require("./expulsionCheck");

const makeResident = (overrides = {}) => ({
  _id: "resident1",
  user: { _id: "u-resident", firstName: "Ali", lastName: "Valiyev" },
  warningIssued: false,
  expulsionOrderCreated: false,
  ...overrides,
});

const kinds = (effects) => effects.map((e) => e.kind);

beforeEach(() => {
  jest.clearAllMocks();
  Attendance.find = jest.fn().mockResolvedValue([]);
  Resident.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
  openDraft.mockResolvedValue({ opened: true, orderId: "order1", hours: 72 });
  cancelDraftBelowThreshold.mockResolvedValue(undefined);
});

const armWarning = () => {
  Attendance.find = jest.fn().mockResolvedValue([{ hours: WARNING_HOURS }]);
  Resident.findById = jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue(makeResident()),
  });
};

describe("yetkazish — controller yo'li (fon): har tarmoq ishlaydi", () => {

  test("Telegram xabari HAQIQATAN yuboriladi", async () => {
    armWarning();
    await runExpulsionCheck("resident1");
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "telegram" }),
    );
  });

  test("in-app dispatch `overrideChannels:{inApp:true}` bilan ketadi", async () => {
    armWarning();
    await runExpulsionCheck("resident1");
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "residency_attendance_warning",
        overrideChannels: { inApp: true },
      }),
    );
  });

  test("D-23 — bekor qilish HAQIQATAN chaqiriladi", async () => {
    Attendance.find = jest.fn().mockResolvedValue([]);
    Resident.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(makeResident({ warningIssued: true })),
    });
    await runExpulsionCheck("resident1");
    expect(revokeWarningInBackground).toHaveBeenCalledWith("u-resident");
  });

  test("D-16 — ustoz bildirishnomasi HAQIQATAN ketadi", async () => {
    Attendance.find = jest.fn().mockResolvedValue([{ hours: WARNING_HOURS }]);
    Resident.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(
        makeResident({ program: "ordinatura", supervisor: "u-ustoz" }),
      ),
    });
    await runExpulsionCheck("resident1");
    expect(notifyUser).toHaveBeenCalledWith(
      "u-ustoz",
      expect.objectContaining({ eventType: "supervisor_event" }),
    );
  });
});

describe("yetkazish — controller yo'li (fon): so'rovni bloklamaydi", () => {
  test("controller yo'li operatsion log YOZMAYDI", async () => {
    armWarning();
    await runExpulsionCheck("resident1");
    expect(winston.info).not.toHaveBeenCalled();
    expect(winston.warn).not.toHaveBeenCalled();
  });

  test("osilgan `notify` so'rovni USHLAB TURMAYDI va hisoblagich yoziladi", async () => {
    armWarning();
    notify.mockReturnValueOnce(new Promise(() => {}));
    await expect(runExpulsionCheck("resident1")).resolves.toBeUndefined();
    expect(Resident.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });
});

const armSweep = (resident = makeResident(), hours = WARNING_HOURS) => {
  Attendance.find = jest.fn().mockResolvedValue([{ hours }]);
  Resident.find = jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue([resident]),
  });
};

describe("yetkazish — cron yo'li (await): kutish va log", () => {

  test("`notify` tugamaguncha hisoblagich YOZILMAYDI", async () => {
    armSweep();
    let release;
    notify.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const sweep = runExpulsionSweep();
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(Resident.findByIdAndUpdate).not.toHaveBeenCalled();

    release();
    await sweep;
    expect(Resident.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  test("ostona log'i yoziladi va `dispatch` dan KEYIN turadi (eski tartib)", async () => {
    armSweep();
    await runExpulsionSweep();

    const logCall = winston.info.mock.calls.findIndex((c) =>
      String(c[0]).includes("Ogohlantirish:"),
    );
    expect(logCall).toBeGreaterThanOrEqual(0);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.invocationCallOrder[0]).toBeLessThan(
      winston.info.mock.invocationCallOrder[logCall],
    );
  });

  test("buyruq loyihasi log'i `warn` darajasida", async () => {
    armSweep(makeResident(), EXPULSION_HOURS);
    await runExpulsionSweep();
    expect(winston.warn).toHaveBeenCalledWith(
      expect.stringContaining("BUYRUQ LOYIHASI:"),
    );
  });
});

describe("yetkazish — cron yo'li (await): xato siyosati", () => {
  test("ustoz bildirishnomasi xatosi sweep'ni YIQITMAYDI", async () => {
    armSweep(makeResident({ program: "ordinatura", supervisor: "u-ustoz" }));
    notifyUser.mockRejectedValueOnce(new Error("notifyUser 500"));
    await expect(runExpulsionSweep()).resolves.toBe(true);
    expect(Resident.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  test("Telegram xatosi sweep'ni to'xtatadi — hisoblagich YOZILMAYDI", async () => {
    Attendance.find = jest.fn().mockResolvedValue([{ hours: WARNING_HOURS }]);
    Resident.find = jest.fn().mockReturnValue({
      populate: jest
        .fn()
        .mockResolvedValue([makeResident(), makeResident({ _id: "resident2" })]),
    });
    notify.mockRejectedValueOnce(new Error("Telegram 502"));

    await expect(runExpulsionSweep()).resolves.toBe(false);
    expect(Resident.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(winston.error).toHaveBeenCalledWith(
      expect.stringContaining("Telegram 502"),
    );
  });

  test("DB xatosi yutiladi — sweep reject QILMAYDI", async () => {
    Resident.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error("Mongo down")),
    });
    await expect(runExpulsionSweep()).resolves.toBe(false);
    expect(winston.error).toHaveBeenCalledWith(
      expect.stringContaining("Mongo down"),
    );
  });
});

describe("DB so'rov filtrlari", () => {
  test("`Attendance.find` FAQAT sababsiz, aktiv va JORIY O'QUV YILI yozuvlarini oladi", async () => {
    Attendance.find = jest.fn().mockResolvedValue([]);
    Resident.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(makeResident()),
    });
    await runExpulsionCheck("resident1");
    expect(Attendance.find).toHaveBeenCalledWith({
      resident: "resident1",
      status: "absent",
      active: true,
      date: { $gte: expect.any(Date), $lte: expect.any(Date) },
    });
  });

  test("oyna so'rovda — `date` sharti mavjud va Date oralig'i", async () => {
    Attendance.find = jest.fn().mockResolvedValue([]);
    Resident.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(makeResident()),
    });
    await runExpulsionCheck("resident1");
    const { date } = Attendance.find.mock.calls[0][0];
    expect(date.$gte).toBeInstanceOf(Date);
    expect(date.$lte).toBeInstanceOf(Date);
    expect(date.$gte.getTime()).toBeLessThan(date.$lte.getTime());
  });

  test("`Resident.find` FAQAT aktiv rezidentlarni oladi", async () => {
    Attendance.find = jest.fn().mockResolvedValue([]);
    Resident.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([]),
    });
    await runExpulsionSweep();
    expect(Resident.find).toHaveBeenCalledWith({ active: true });
  });
});

describe("NaN soat — eski kod kabi HECH NARSA qilmaydi", () => {
  test("NaN da birorta bayroq yoqilmaydi", () => {
    const { update, effects } = evaluateResident(makeResident(), NaN);
    expect(update.warningIssued).toBeUndefined();
    expect(update.expulsionOrderCreated).toBeUndefined();
    expect(update.active).toBeUndefined();
    expect(effects).toEqual([]);
  });
});

describe("P3 yetkazish — bo'lim (`office`)", () => {
  const armExpulsion = () => {
    Attendance.find = jest.fn().mockResolvedValue([{ hours: EXPULSION_HOURS }]);
    Resident.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(makeResident()),
    });
    Resident.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([makeResident()]),
    });
  };

  test("controller yo'li — bo'limning HAR BIR xodimiga yuboriladi", async () => {
    armExpulsion();
    await runExpulsionCheck("resident1");
    await new Promise((r) => setImmediate(r));
    expect(notifyUser).toHaveBeenCalledWith(
      "office-1",
      expect.objectContaining({
        eventType: "residency_expulsion_draft_office",
        metadata: { residentId: "resident1", orderId: "order1" },
      }),
    );
    expect(notifyUser).toHaveBeenCalledWith("office-2", expect.anything());
  });

  test("cron yo'li — bo'limga yuboriladi va KUTILADI", async () => {
    armExpulsion();
    await runExpulsionSweep();
    expect(notifyUser).toHaveBeenCalledWith("office-1", expect.anything());
    expect(notifyUser).toHaveBeenCalledWith("office-2", expect.anything());
  });

  test("ostona kesilmasa bo'lim ro'yxati O'QILMAYDI", async () => {
    Attendance.find = jest.fn().mockResolvedValue([{ hours: 2 }]);
    Resident.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(makeResident()),
    });
    await runExpulsionCheck("resident1");
    await new Promise((r) => setImmediate(r));
    expect(officeUserIds).not.toHaveBeenCalled();
  });

  test("bo'lim xodimi topilmasa sweep yiqilmaydi", async () => {
    armExpulsion();
    officeUserIds.mockResolvedValueOnce([]);
    await expect(runExpulsionSweep()).resolves.toBe(true);
    expect(Resident.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("P6a yetkazish — bekor qilish (`cancelDraft`)", () => {
  const armReversal = () => {
    Attendance.find = jest.fn().mockResolvedValue([]);
    Resident.findById = jest.fn().mockReturnValue({
      populate: jest
        .fn()
        .mockResolvedValue(makeResident({ expulsionOrderCreated: true })),
    });
    Resident.find = jest.fn().mockReturnValue({
      populate: jest
        .fn()
        .mockResolvedValue([makeResident({ expulsionOrderCreated: true })]),
    });
  };

  test("controller yo'li — yopish HAQIQATAN chaqiriladi (`attendance`)", async () => {
    armReversal();
    await runExpulsionCheck("resident1");
    expect(cancelDraftBelowThreshold).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "resident1", expulsionOrderCreated: true }),
      { hours: 0, source: "attendance", awaitRevoke: false },
    );
  });

  test("cron yo'li — yopish HAQIQATAN chaqiriladi (`cron`)", async () => {
    armReversal();
    await runExpulsionSweep();
    expect(cancelDraftBelowThreshold).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "resident1" }),
      { hours: 0, source: "cron", awaitRevoke: true },
    );
  });

  test("hisoblagich yoziladi, bayroq esa `update` da YO'Q", async () => {
    armReversal();
    await runExpulsionCheck("resident1");
    const update = Resident.findByIdAndUpdate.mock.calls[0][1];
    expect(update).not.toHaveProperty("expulsionOrderCreated");
    expect(update).not.toHaveProperty("expulsionOrderCreatedAt");
    expect(update.totalUnexcusedHours).toBe(0);
  });
});
