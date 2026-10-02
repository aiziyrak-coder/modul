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
  return {
    ...real,
    revokeWarning: jest.fn().mockResolvedValue(0),
    revokeWarningInBackground: jest.fn(),
  };
});
jest.mock("./officeRecipients", () => ({
  officeUserIds: jest.fn().mockResolvedValue(["office-1"]),
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
  isDraftOpen: jest.fn().mockResolvedValue(true),
}));
jest.mock("./autoAbsenceNotice", () => ({ syncAbsenceNotices: jest.fn().mockResolvedValue({ issued: 0, revoked: 0, announced: 0 }) }));
jest.mock("#shared/winston.logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { notifyUser } = require("#modules/4.05-residency/_services/residentNotify");
const { dispatch } = require("#system/notification/notificationDispatcher");
const winston = require("#shared/winston.logger");
const { officeUserIds } = require("./officeRecipients");
const {
  EXPULSION_HOURS,
  revokeWarning,
  revokeWarningInBackground,
} = require("./attendanceWarning");
const {
  openDraft,
  cancelDraftBelowThreshold,
  settleDraftNotices,
  reconcileDrafts,
  markNoticesSent,
  findUnannouncedDrafts,
  isDraftOpen,
} = require("./expulsionOrderLifecycle");
const {
  countUnexcusedHours,
  runExpulsionCheck,
  runExpulsionSweep,
} = require("./expulsionCheck");

const makeResident = (overrides = {}) => ({
  _id: "resident1",
  user: { _id: "u-resident", firstName: "Ali", lastName: "Valiyev" },
  warningIssued: true,
  expulsionOrderCreated: false,
  ...overrides,
});

const arm = (hours, resident = makeResident()) => {
  Attendance.find = jest.fn().mockResolvedValue([{ hours }]);
  Resident.findById = jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue(resident),
  });
  Resident.find = jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue([resident]),
  });
};

const flush = () => new Promise((r) => setImmediate(r));

const expulsionDispatches = () =>
  dispatch.mock.calls.filter(([p]) => p.eventType === "residency_expulsion");

beforeEach(() => {
  jest.clearAllMocks();
  Resident.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
  openDraft.mockResolvedValue({ opened: true, orderId: "order1", hours: 72 });
  cancelDraftBelowThreshold.mockResolvedValue(undefined);
});

describe("P6a — xabar loyiha NATIJASIGA bog'liq", () => {
  test("ochildi — rezident va bo'lim xabari buyruq id'si bilan ketadi", async () => {
    arm(EXPULSION_HOURS);
    await runExpulsionCheck("resident1");
    await flush();
    expect(expulsionDispatches()).toHaveLength(1);
    expect(expulsionDispatches()[0][0].metadata).toEqual({
      residentId: "resident1",
      orderId: "order1",
    });
    expect(notifyUser).toHaveBeenCalledWith(
      "office-1",
      expect.objectContaining({
        metadata: { residentId: "resident1", orderId: "order1" },
      }),
    );
  });

  test("ochilmadi (band qilish yutqazildi) — HECH BIR xabar ketmaydi", async () => {
    openDraft.mockResolvedValue({ opened: false, reason: "claim_lost" });
    arm(EXPULSION_HOURS);
    await runExpulsionCheck("resident1");
    await flush();
    expect(expulsionDispatches()).toHaveLength(0);
    expect(officeUserIds).not.toHaveBeenCalled();
  });

  test("tiklandi (hujjatsiz bayroq) — xabar TAKRORLANMAYDI", async () => {
    openDraft.mockResolvedValue({ opened: false, healed: true, orderId: "o2" });
    arm(EXPULSION_HOURS);
    await runExpulsionSweep();
    expect(expulsionDispatches()).toHaveLength(0);
    expect(winston.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("BUYRUQ LOYIHASI:"),
    );
  });

  test("`openDraft` xatosi yutiladi, loglanadi va hisoblagich YOZILADI", async () => {
    openDraft.mockRejectedValue(new Error("Mongo down"));
    arm(EXPULSION_HOURS);
    await expect(runExpulsionCheck("resident1")).resolves.toBeUndefined();
    expect(winston.error).toHaveBeenCalledWith(
      expect.stringContaining("Mongo down"),
    );
    expect(Resident.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(expulsionDispatches()).toHaveLength(0);
  });
});

describe("P6a — `openDraft` ga nima uzatiladi", () => {
  test("controller yo'li `attendance`, cron yo'li `cron`", async () => {
    arm(EXPULSION_HOURS);
    await runExpulsionCheck("resident1");
    expect(openDraft.mock.calls[0][0].source).toBe("attendance");

    openDraft.mockClear();
    await runExpulsionSweep();
    expect(openDraft.mock.calls[0][0].source).toBe("cron");
  });

  test("jonli qayta hisob uchun `countUnexcusedHours` uzatiladi", async () => {
    arm(EXPULSION_HOURS);
    await runExpulsionCheck("resident1");
    expect(openDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        residentId: "resident1",
        residentName: "Valiyev Ali",
        countHours: countUnexcusedHours,
      }),
    );
  });
});

describe("P6a — holat effektlari rezident yozuvidan OLDIN", () => {
  test("`openDraft` hisoblagich yozuvidan oldin KUTILADI", async () => {
    let release;
    openDraft.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve({ opened: false });
      }),
    );
    arm(EXPULSION_HOURS);
    const run = runExpulsionCheck("resident1");
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(Resident.findByIdAndUpdate).not.toHaveBeenCalled();
    release();
    await run;
    expect(Resident.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  test("`cancelDraft` baholangan suratni (ko'rsatkichi bilan) oladi", async () => {
    const at = new Date("2026-09-20T08:00:00Z");
    const resident = makeResident({ warningIssued: false, expulsionOrderCreated: true, expulsionOrderCreatedAt: at });
    arm(2, resident);
    await runExpulsionCheck("resident1");
    expect(cancelDraftBelowThreshold).toHaveBeenCalledWith(resident, {
      hours: 2,
      source: "attendance",
      awaitRevoke: false,
    });
    expect(cancelDraftBelowThreshold.mock.invocationCallOrder[0]).toBeLessThan(
      Resident.findByIdAndUpdate.mock.invocationCallOrder[0],
    );
  });
});

describe("P6a — xabarlar yetkazilgach loyiha qayta tekshiriladi", () => {
  test("controller yo'li — xabarlardan KEYIN `settleDraftNotices(rezident, buyruq)`", async () => {
    arm(EXPULSION_HOURS);
    await runExpulsionCheck("resident1");
    await flush();
    expect(settleDraftNotices).toHaveBeenCalledWith("resident1", "order1");
    expect(notifyUser.mock.invocationCallOrder[0]).toBeLessThan(
      settleDraftNotices.mock.invocationCallOrder[0],
    );
  });

  test("cron yo'li — `settle` hisoblagich yozuvidan OLDIN kutiladi", async () => {
    arm(EXPULSION_HOURS);
    await runExpulsionSweep();
    expect(settleDraftNotices.mock.invocationCallOrder[0]).toBeLessThan(
      Resident.findByIdAndUpdate.mock.invocationCallOrder[0],
    );
  });

  test("controller yo'li loyiha log'ini YOZMAYDI, cron yo'li yozadi", async () => {
    arm(EXPULSION_HOURS);
    await runExpulsionCheck("resident1");
    await flush();
    const draftLog = expect.stringContaining("BUYRUQ LOYIHASI:");
    expect(winston.warn).not.toHaveBeenCalledWith(draftLog);
    await runExpulsionSweep();
    expect(winston.warn).toHaveBeenCalledWith(draftLog);
  });

  test("loyiha ochilmadi — `settle` ham chaqirilmaydi", async () => {
    openDraft.mockResolvedValue({ opened: false, reason: "already_open" });
    arm(EXPULSION_HOURS);
    await runExpulsionCheck("resident1");
    await flush();
    expect(settleDraftNotices).not.toHaveBeenCalled();
  });
});

describe("P6a — sweep: yarashtirish birinchi, bekor qilishlar kutiladi", () => {
  test("`reconcileDrafts` rezidentlar o'qilishidan OLDIN kutiladi", async () => {
    arm(2);
    await runExpulsionSweep();
    expect(reconcileDrafts.mock.invocationCallOrder[0]).toBeLessThan(
      Resident.find.mock.invocationCallOrder[0],
    );
  });

  test("ogohlantirish bekori sweep'da KUTILADI (fonda emas)", async () => {
    let release;
    revokeWarning.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    arm(2, makeResident({ warningIssued: true }));
    const sweep = runExpulsionSweep();
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
    expect(Resident.findByIdAndUpdate).not.toHaveBeenCalled();
    release(1);
    await sweep;
    expect(revokeWarning).toHaveBeenCalledWith("u-resident");
    expect(revokeWarningInBackground).not.toHaveBeenCalled();
  });

  test("controller yo'lida ogohlantirish bekori FONDA qoladi", async () => {
    arm(2, makeResident({ warningIssued: true }));
    await runExpulsionCheck("resident1");
    expect(revokeWarningInBackground).toHaveBeenCalledWith("u-resident");
    expect(revokeWarning).not.toHaveBeenCalled();
  });
});

describe("P6a — e'lon belgisi va qayta e'lon", () => {
  test("xabarlar yetkazilgach `markNoticesSent` — `settle` dan KEYIN", async () => {
    arm(EXPULSION_HOURS);
    await runExpulsionSweep();
    expect(markNoticesSent).toHaveBeenCalledWith("order1");
    expect(settleDraftNotices.mock.invocationCallOrder[0]).toBeLessThan(
      markNoticesSent.mock.invocationCallOrder[0],
    );
  });

  test("sweep e'lon qilinmagan loyihani QAYTA e'lon qiladi (buyruq id'si bilan) va belgilaydi", async () => {
    findUnannouncedDrafts.mockResolvedValueOnce([
      { _id: "orphan1", resident: "resident1", hoursAtDraft: 74 },
    ]);
    arm(2);
    await runExpulsionSweep();
    const sent = expulsionDispatches();
    expect(sent).toHaveLength(1);
    expect(sent[0][0].metadata).toEqual({ residentId: "resident1", orderId: "orphan1" });
    expect(notifyUser).toHaveBeenCalledWith(
      "office-1",
      expect.objectContaining({ metadata: { residentId: "resident1", orderId: "orphan1" } }),
    );
    expect(markNoticesSent).toHaveBeenCalledWith("orphan1");
    expect(findUnannouncedDrafts.mock.invocationCallOrder[0]).toBeGreaterThan(
      Resident.findByIdAndUpdate.mock.invocationCallOrder[0],
    );
  });

  test("xabari allaqachon saqlangan loyiha — qayta YUBORILMAYDI, faqat belgilanadi", async () => {
    findUnannouncedDrafts.mockResolvedValueOnce([{ _id: "half1", resident: "resident1", hoursAtDraft: 74 }]);
    markNoticesSent.mockResolvedValueOnce(true);
    arm(2);
    await runExpulsionSweep();
    expect(expulsionDispatches()).toHaveLength(0);
    expect(markNoticesSent).toHaveBeenCalledWith("half1");
  });

  test("rezident o'chirilgan (topilmadi) — qayta e'lon YO'Q", async () => {
    findUnannouncedDrafts.mockResolvedValueOnce([{ _id: "o9", resident: "gone", hoursAtDraft: 80 }]);
    Resident.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    Resident.find = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue([]) });
    await expect(runExpulsionSweep()).resolves.toBe(true);
    expect(expulsionDispatches()).toHaveLength(0);
    expect(markNoticesSent).toHaveBeenCalledTimes(1);
  });
});

describe("P6a-2 — qayta e'lon yopilgan loyihani o'tkazib yuboradi", () => {
  test("loyiha endi ochiq emas — xabar YO'Q", async () => {
    findUnannouncedDrafts.mockResolvedValueOnce([{ _id: "decided1", resident: "resident1", hoursAtDraft: 74 }]);
    isDraftOpen.mockResolvedValueOnce(null);
    arm(2);
    await runExpulsionSweep();
    expect(isDraftOpen).toHaveBeenCalledWith("decided1");
    expect(expulsionDispatches()).toHaveLength(0);
    expect(notifyUser).not.toHaveBeenCalled();
  });
});
