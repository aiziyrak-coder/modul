"use strict";

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
  LINKS: { ATTENDANCE: "/residency/davomat", ATTENDANCE_OFFICE: "/residency/davomat" },
}));
jest.mock("./attendanceWarning", () => {
  const real = jest.requireActual("./attendanceWarning");
  return { ...real, revokeWarningInBackground: jest.fn() };
});
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
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
jest.mock("./autoAbsenceNotice", () => ({
  syncAbsenceNotices: jest.fn().mockResolvedValue({ issued: 0, revoked: 0, announced: 0 }),
}));

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { notifyUser } = require("#modules/4.05-residency/_services/residentNotify");
const { notify } = require("#system/notification/notification.service");
const { dispatch } = require("#system/notification/notificationDispatcher");
const winston = require("#shared/winston.logger");
const { openDraft } = require("./expulsionOrderLifecycle");
const { runExpulsionCheck, runExpulsionSweep } = require("./expulsionCheck");

const uz = (hhmm) => new Date(`2026-10-13T${hhmm}:00.000+05:00`);
const NIGHT = uz("01:30");
const resident = () => ({
  _id: "resident1",
  program: "ordinatura",
  supervisor: "u-ustoz",
  user: { _id: "u-resident", firstName: "Ali", lastName: "Valiyev" },
  warningIssued: false,
  expulsionOrderCreated: false,
});
const flush = () => new Promise((r) => setImmediate(r));
const withHours = (hours, over = {}) => {
  Attendance.find = jest.fn().mockResolvedValue([{ hours }]);
  const doc = { ...resident(), ...over };
  Resident.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(doc) });
};
const written = () => Resident.findByIdAndUpdate.mock.calls[0][1];
const heldLines = () =>
  winston.info.mock.calls.map(([m]) => m).filter((m) => m.includes("ushlab turildi"));
const notOpened = () => openDraft.mockResolvedValueOnce({ opened: false, reason: "already_open" });

beforeEach(() => {
  jest.clearAllMocks();
  Resident.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
  openDraft.mockResolvedValue({ opened: true, orderId: "order1", hours: 72 });
});

describe("runExpulsionCheck — tungi `sams` tetigi", () => {
  test("6 soat ushlanadi: soat yoziladi, bayroq va xabarlar yo'q; id-only log", async () => {
    withHours(8);
    await runExpulsionCheck("resident1", { source: "sams", now: NIGHT });
    await flush();
    expect(written()).toEqual({ totalUnexcusedHours: 8 });
    expect(notify).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(notifyUser).not.toHaveBeenCalled();
    const held = winston.info.mock.calls.map(([m]) => m).filter((m) => m.includes("ushlab turildi"));
    expect(held).toEqual([expect.stringContaining("resident=resident1 soat=8")]);
    expect(held[0]).not.toContain("Valiyev");
  });

  test.each([
    ["22:00 (egasi: 00:00 emas)", "22:00", true],
    ["21:59", "21:59", false],
    ["08:00", "08:00", false],
  ])("chegara %s", async (_l, hhmm, heldWant) => {
    withHours(8);
    await runExpulsionCheck("resident1", { source: "sams", now: uz(hhmm) });
    expect(written().warningIssued === true).toBe(!heldWant);
  });

  test("E1 72 soat loyihasi ham ushlanadi: hujjat va xabar yo'q, soat yoziladi; log [6h, 72h]", async () => {
    withHours(80);
    await runExpulsionCheck("resident1", { source: "sams", now: NIGHT });
    await flush();
    expect(openDraft).not.toHaveBeenCalled();
    expect(written()).toEqual({ totalUnexcusedHours: 80 });
    expect(notify).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(notifyUser).not.toHaveBeenCalled();
    expect(heldLines()).toEqual([
      expect.stringContaining("6 soat ogohlantirishi 08:00 sweep'gacha ushlab turildi resident=resident1 soat=80"),
      expect.stringContaining("72 soat loyihasi 08:00 sweep'gacha ushlab turildi resident=resident1 soat=80"),
    ]);
  });

  test("E4 loyiha allaqachon ochiq (bayroq) — openDraft yo'q, 72 soat logi yo'q (N72-Q4=A)", async () => {
    withHours(80, { expulsionOrderCreated: true });
    await runExpulsionCheck("resident1", { source: "sams", now: NIGHT });
    expect(openDraft).not.toHaveBeenCalled();
    expect(heldLines().filter((m) => m.includes("72 soat loyihasi"))).toEqual([]);
  });
});

describe("ushlanmaydigan yo'llar", () => {
  test("qo'lda davomat (`attendance`) tunda ham darhol ogohlantiradi", async () => {
    withHours(8);
    await runExpulsionCheck("resident1", { source: "attendance", now: NIGHT });
    await flush();
    expect(written().warningIssued).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  test("E2 `sams` 08:00 da (oynadan tashqari) — 72 soat loyihasi ochiladi", async () => {
    withHours(80);
    notOpened();
    await runExpulsionCheck("resident1", { source: "sams", now: uz("08:00") });
    expect(openDraft).toHaveBeenCalledTimes(1);
    expect(openDraft).toHaveBeenCalledWith(expect.objectContaining({ source: "sams" }));
  });

  test("E3 qo'lda davomat (`attendance`) tunda ham 72 soat loyihasini darhol ochadi", async () => {
    withHours(80);
    notOpened();
    await runExpulsionCheck("resident1", { source: "attendance", now: NIGHT });
    expect(openDraft).toHaveBeenCalledTimes(1);
  });

  test("sweep tunda ham chiqaradi (chiqaruvchi — N6H-Q4=A)", async () => {
    jest.useFakeTimers({
      now: NIGHT,
      doNotFake: ["nextTick", "setImmediate", "setTimeout", "setInterval", "clearTimeout",
        "clearInterval", "clearImmediate", "queueMicrotask", "hrtime", "performance"],
    });
    try {
      Attendance.find = jest.fn().mockResolvedValue([{ hours: 8 }]);
      Resident.find = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue([resident()]) });
      await runExpulsionSweep();
      expect(written().warningIssued).toBe(true);
      expect(notify).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("sweep — tunda ushlangan 72 soatni ochadi (N72-Q3=A)", () => {
  test("E5 sweep tunda ham `cron` manbai bilan ochadi va 6 soatni chiqaradi", async () => {
    jest.useFakeTimers({
      now: NIGHT,
      doNotFake: ["nextTick", "setImmediate", "setTimeout", "setInterval", "clearTimeout",
        "clearInterval", "clearImmediate", "queueMicrotask", "hrtime", "performance"],
    });
    try {
      notOpened();
      Attendance.find = jest.fn().mockResolvedValue([{ hours: 80 }]);
      Resident.find = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue([resident()]) });
      await runExpulsionSweep();
      expect(openDraft).toHaveBeenCalledTimes(1);
      expect(openDraft).toHaveBeenCalledWith(expect.objectContaining({ source: "cron" }));
      expect(notify).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
