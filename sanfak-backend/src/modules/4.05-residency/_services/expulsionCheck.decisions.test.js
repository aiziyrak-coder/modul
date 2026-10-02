jest.mock("#modules/4.05-residency/attendance/attendance.model");
jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("#system/notification/notification.service", () => ({
  notify: jest.fn().mockResolvedValue(undefined),
  templates: { expulsionWarning: () => "w", expulsionOrder: () => "o" },
}));
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("./expulsionOrderLifecycle", () => ({
  openDraft: jest.fn().mockResolvedValue({ opened: false }),
  cancelDraftBelowThreshold: jest.fn().mockResolvedValue(undefined),
  settleDraftNotices: jest.fn().mockResolvedValue(undefined),
  reconcileDrafts: jest.fn().mockResolvedValue(undefined),
  markNoticesSent: jest.fn().mockResolvedValue(undefined),
  findUnannouncedDrafts: jest.fn().mockResolvedValue([]),
  isDraftOpen: jest.fn().mockResolvedValue(true),
}));
jest.mock("./expulsionOfficeNotices", () => ({
  fanOutToOffice: jest.fn().mockResolvedValue(undefined),
  deliverDecision: jest.fn().mockResolvedValue(true),
  deliverDecisionInBackground: jest.fn(),
  basisLostEffects: jest.fn().mockResolvedValue([]),
  announceOfficeFollowUps: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { findUnannouncedDrafts } = require("./expulsionOrderLifecycle");
const {
  deliverDecision,
  deliverDecisionInBackground,
  basisLostEffects,
  announceOfficeFollowUps,
} = require("./expulsionOfficeNotices");
const {
  evaluateResident,
  countUnexcusedHours,
  runExpulsionCheck,
  runExpulsionSweep,
} = require("./expulsionCheck");

const expelled = (overrides = {}) => ({
  _id: "r1",
  status: "chetlatilgan",
  user: { _id: "u1", firstName: "Ali", lastName: "Valiyev" },
  ...overrides,
});
const arm = (hours, resident) => {
  Attendance.find = jest.fn().mockResolvedValue([{ hours }]);
  Resident.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(resident) });
  Resident.find = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue([resident]) });
};
const CLAIMED = { _id: "o1", resident: "r1" };

beforeEach(() => {
  jest.clearAllMocks();
  Resident.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
});

describe("evaluateResident — U-7 effekti", () => {
  test("chetlatilgan + 20 soat — `basisLost`, bekor qilish YO'Q", () => {
    const { effects } = evaluateResident(expelled({ expulsionOrderCreated: false }), 20);
    expect(effects.map((e) => e.kind)).toEqual(["basisLost"]);
  });

  test.each([
    ["chetlatilgan + 72", expelled(), 72],
    ["o'qishda + 20", expelled({ status: "oquvda" }), 20],
    ["chetlatilgan + NaN", expelled(), NaN],
  ])("%s — `basisLost` YO'Q", (_label, resident, hours) => {
    expect(evaluateResident(resident, hours).effects.map((e) => e.kind)).not.toContain("basisLost");
  });
});

describe("da'vo va yetkazish", () => {
  test("sweep: da'vo `cron` manbasi bilan, yetkazish KUTILADI", async () => {
    arm(20, expelled());
    basisLostEffects.mockResolvedValueOnce([{ kind: "basisLostNotice", order: CLAIMED }]);
    await expect(runExpulsionSweep()).resolves.toBe(true);
    expect(basisLostEffects).toHaveBeenCalledWith({ residentId: "r1", source: "cron", countHours: countUnexcusedHours });
    expect(deliverDecision).toHaveBeenCalledWith(CLAIMED, "basisLost");
    expect(deliverDecisionInBackground).not.toHaveBeenCalled();
  });

  test("davomat yo'li: yetkazish FONDA (so'rov kutmaydi)", async () => {
    arm(20, expelled());
    basisLostEffects.mockResolvedValueOnce([{ kind: "basisLostNotice", order: CLAIMED }]);
    await runExpulsionCheck("r1");
    expect(basisLostEffects).toHaveBeenCalledWith(expect.objectContaining({ source: "attendance" }));
    expect(deliverDecisionInBackground).toHaveBeenCalledWith(CLAIMED, "basisLost");
    expect(deliverDecision).not.toHaveBeenCalled();
  });

  test("da'vo yutqazildi — xabar YO'Q", async () => {
    arm(20, expelled());
    await runExpulsionSweep();
    expect(deliverDecision).not.toHaveBeenCalled();
  });

  test("e'lon yarashtirish boshlagan vaqt bilan", async () => {
    const { reconcileDrafts } = require("./expulsionOrderLifecycle");
    const started = new Date("2026-10-05T03:00:00Z");
    reconcileDrafts.mockResolvedValueOnce(started);
    arm(0, expelled({ status: "oquvda" }));
    await runExpulsionSweep();
    expect(findUnannouncedDrafts).toHaveBeenCalledWith(started);
  });

  test("sweep oxirida `announceOfficeFollowUps(true)`", async () => {
    arm(0, expelled({ status: "oquvda" }));
    await runExpulsionSweep();
    expect(announceOfficeFollowUps).toHaveBeenCalledTimes(1);
    expect(announceOfficeFollowUps).toHaveBeenCalledWith(true);
    expect(announceOfficeFollowUps.mock.invocationCallOrder[0]).toBeGreaterThan(
      findUnannouncedDrafts.mock.invocationCallOrder[0],
    );
  });
});

test("sweep yiqilsa ham qaror xabarlari qayta e'lon qilinadi (eslatmasiz), natija `false`", async () => {
  Resident.find = jest.fn().mockReturnValue({ populate: jest.fn().mockRejectedValue(new Error("Mongo down")) });
  await expect(runExpulsionSweep()).resolves.toBe(false);
  expect(announceOfficeFollowUps).toHaveBeenCalledTimes(1);
  expect(announceOfficeFollowUps).toHaveBeenCalledWith(false);
});

test("qayta e'lon yiqilsa — natija `false`", async () => {
  arm(0, expelled({ status: "oquvda" }));
  announceOfficeFollowUps.mockRejectedValueOnce(new Error("Mongo down"));
  await expect(runExpulsionSweep()).resolves.toBe(false);
});
