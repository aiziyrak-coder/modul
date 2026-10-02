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

const MOCK_WARNING = 10;
const MOCK_EXPULSION = 20;

jest.mock("./attendanceWarning", () => ({
  EVENT_TYPE: "residency_attendance_warning",
  WARNING_HOURS: 10,
  EXPULSION_HOURS: 20,
  revokeWarning: jest.fn().mockResolvedValue(0),
  revokeWarningInBackground: jest.fn(),
  clearWarningIfBelowThreshold: (resident, hours, update) => {
    if (hours >= 10) return false;
    if (!resident?.warningIssued) return false;
    update.warningIssued = false;
    update.warningIssuedAt = null;
    return true;
  },
}));

const { evaluateResident } = require("./expulsionCheck");

const makeResident = (overrides = {}) => ({
  _id: "resident1",
  user: { _id: "u-resident", firstName: "Ali", lastName: "Valiyev" },
  warningIssued: false,
  expulsionOrderCreated: false,
  ...overrides,
});

describe("ostonalar FAQAT `attendanceWarning.js` dan keladi", () => {
  test("ogohlantirish chegarasi MOCK qiymatga suriladi (6 ga EMAS)", () => {
    expect(evaluateResident(makeResident(), 6).update.warningIssued).toBeUndefined();
    expect(evaluateResident(makeResident(), 9.9).update.warningIssued).toBeUndefined();
    expect(
      evaluateResident(makeResident(), MOCK_WARNING).update.warningIssued,
    ).toBe(true);
  });

  test("chetlatish chegarasi MOCK qiymatga suriladi (72 ga EMAS)", () => {
    const drafts = (r) => r.effects.filter((e) => e.kind === "openDraft");
    const past = evaluateResident(makeResident(), 19.9);
    expect(drafts(past)).toHaveLength(0);
    expect(past.update.active).toBeUndefined();

    const aynan = evaluateResident(makeResident(), MOCK_EXPULSION);
    expect(drafts(aynan)).toHaveLength(1);
    expect(aynan.update).not.toHaveProperty("active");
  });

  test("D-23 ham MOCK ostona bo'yicha ishlaydi", () => {
    const resident = makeResident({ warningIssued: true });
    const { update, effects } = evaluateResident(resident, 9);
    expect(update.warningIssued).toBe(false);
    expect(effects.map((e) => e.kind)).toEqual(["revokeWarning"]);
  });
});
