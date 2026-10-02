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
jest.mock("./autoAbsenceNotice", () => ({ syncAbsenceNotices: jest.fn().mockResolvedValue({ issued: 0, revoked: 0, announced: 0 }) }));

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const {
  notifyUser,
} = require("#modules/4.05-residency/_services/residentNotify");
const { notify } = require("#system/notification/notification.service");
const { dispatch } = require("#system/notification/notificationDispatcher");
const winston = require("#shared/winston.logger");
const {
  WARNING_HOURS,
  EXPULSION_HOURS,
  revokeWarningInBackground,
} = require("./attendanceWarning");
const {
  openDraft,
  cancelDraftBelowThreshold,
} = require("./expulsionOrderLifecycle");
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
const draftNotices = (effects) =>
  effects.find((e) => e.kind === "openDraft")?.notices ?? [];

beforeEach(() => {
  jest.clearAllMocks();
  Attendance.find = jest.fn().mockResolvedValue([]);
  Resident.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
  openDraft.mockResolvedValue({ opened: true, orderId: "order1", hours: 72 });
  cancelDraftBelowThreshold.mockResolvedValue(undefined);
});

describe("sumUnexcusedHours — bo'sh `hours` 2 soat", () => {
  test("yozuvda hours bo'lmasa 2 deb sanaladi (mavjud qoida)", () => {
    expect(sumUnexcusedHours([{ hours: 4 }, {}, { hours: null }])).toBe(8);
  });

  test("yozuv yo'q — 0", () => {
    expect(sumUnexcusedHours([])).toBe(0);
  });
});

describe("evaluateResident — ostona chegaralari", () => {
  test("ostonadan PAST — birorta bayroq yoqilmaydi", () => {
    const { update, effects } = evaluateResident(makeResident(), 5.9);
    expect(update).toEqual({ totalUnexcusedHours: 5.9 });
    expect(effects).toEqual([]);
  });

  test("AYNAN ogohlantirish ostonasi — bayroq + xabar", () => {
    const { update, effects } = evaluateResident(
      makeResident(),
      WARNING_HOURS,
    );
    expect(update.warningIssued).toBe(true);
    expect(update.warningIssuedAt).toBeInstanceOf(Date);
    expect(update.expulsionOrderCreated).toBeUndefined();
    expect(kinds(effects)).toEqual(["telegram", "inApp", "log"]);
  });

  test("chetlatish ostonasidan bir chaqirim past — chetlatish YO'Q", () => {
    const { update } = evaluateResident(makeResident(), EXPULSION_HOURS - 0.1);
    expect(update.expulsionOrderCreated).toBeUndefined();
    expect(update.active).toBeUndefined();
  });

  test("ostonalar QOTIRILMAGAN — `attendanceWarning` dan keladi", () => {
    const past = evaluateResident(makeResident(), WARNING_HOURS - 0.01);
    const aynan = evaluateResident(makeResident(), WARNING_HOURS);
    expect(past.update.warningIssued).toBeUndefined();
    expect(aynan.update.warningIssued).toBe(true);
  });
});

describe("evaluateResident — 72 soat ostonasi (P6a)", () => {
  test("AYNAN chetlatish ostonasi — `openDraft`, bayroq `update` ga YOZILMAYDI", () => {
    const { update, effects } = evaluateResident(makeResident(), EXPULSION_HOURS);
    expect(update).not.toHaveProperty("expulsionOrderCreated");
    expect(update).not.toHaveProperty("expulsionOrderCreatedAt");
    expect(kinds(effects)).toEqual(["telegram", "inApp", "log", "openDraft"]);
    expect(kinds(draftNotices(effects))).toEqual(["inApp", "office", "log"]);
  });

  test("`openDraft` rezident, ism va soatni olib yuradi", () => {
    const { effects } = evaluateResident(makeResident(), EXPULSION_HOURS);
    const draft = effects.find((e) => e.kind === "openDraft");
    expect(draft).toMatchObject({
      residentId: "resident1",
      residentName: "Valiyev Ali",
      hours: EXPULSION_HOURS,
    });
  });

  test("bayroq allaqachon yoqilgan — effekt baribir chiqadi, qarorni BAZA qiladi", () => {
    const resident = makeResident({
      warningIssued: true,
      expulsionOrderCreated: true,
    });
    const { update, effects } = evaluateResident(resident, 100);
    expect(update).toEqual({ totalUnexcusedHours: 100 });
    expect(kinds(effects)).toEqual(["openDraft"]);
  });
});

describe("evaluateResident — D-23 (soat pasayganda ogohlantirish bekor)", () => {
  test("bayroq yoqilgan, soat ostonadan pastga tushdi — bekor qilinadi", () => {
    const resident = makeResident({ warningIssued: true });
    const { update, effects } = evaluateResident(resident, 2);
    expect(update.warningIssued).toBe(false);
    expect(update.warningIssuedAt).toBeNull();
    expect(kinds(effects)).toEqual(["revokeWarning"]);
  });

  test("bayroq yoqilmagan — bekor qilishga hech narsa yo'q", () => {
    const { effects } = evaluateResident(makeResident(), 2);
    expect(effects).toEqual([]);
  });

  test("`user` yo'q — revoke effekti yaratilmaydi (manzil yo'q)", () => {
    const resident = makeResident({ warningIssued: true, user: null });
    const { update, effects } = evaluateResident(resident, 2);
    expect(update.warningIssued).toBe(false);
    expect(effects).toEqual([]);
  });
});

describe("evaluateResident — D-16 (ustozga xabar)", () => {
  test("ordinatura + ustoz bor — ustoz effekti qo'shiladi", () => {
    const resident = makeResident({
      program: "ordinatura",
      supervisor: "u-ustoz",
    });
    const { effects } = evaluateResident(resident, WARNING_HOURS);
    expect(kinds(effects)).toContain("supervisor");
    const eff = effects.find((e) => e.kind === "supervisor");
    expect(eff.userId).toBe("u-ustoz");
    expect(eff.payload.eventType).toBe("supervisor_event");
  });

  test("ordinatura, lekin ustoz biriktirilmagan — jimgina o'tkaziladi", () => {
    const resident = makeResident({ program: "ordinatura" });
    const { effects } = evaluateResident(resident, WARNING_HOURS);
    expect(kinds(effects)).not.toContain("supervisor");
  });

  test("magistratura — ustozga YUBORILMAYDI (ilmiy_rahbarda grant yo'q)", () => {
    const resident = makeResident({
      program: "magistratura",
      supervisor: "u-rahbar",
    });
    const { effects } = evaluateResident(resident, WARNING_HOURS);
    expect(kinds(effects)).not.toContain("supervisor");
  });

  test("chetlatish ostonasida ustoz effekti TAKRORLANMAYDI", () => {
    const resident = makeResident({
      program: "ordinatura",
      supervisor: "u-ustoz",
    });
    const { effects } = evaluateResident(resident, EXPULSION_HOURS);
    expect(kinds(effects).filter((k) => k === "supervisor")).toHaveLength(1);
  });
});

describe("evaluateResident — ism yasash", () => {
  test("populate qilingan user'dan", () => {
    expect(evaluateResident(makeResident(), 0).fullName).toBe("Valiyev Ali");
  });

  test("user yo'q — `resident.fullName` zaxirasi", () => {
    const resident = makeResident({ user: null, fullName: "Karimov Bek" });
    expect(evaluateResident(resident, 0).fullName).toBe("Karimov Bek");
  });

  test("ikkisi ham yo'q — \"Rezident\"", () => {
    const resident = makeResident({ user: null });
    expect(evaluateResident(resident, 0).fullName).toBe("Rezident");
  });
});

describe("P2 qulfi — controller va cron BIR XIL natija beradi", () => {
  const absences = [{ hours: 40 }, { hours: 32 }];

  test("bir xil kirishda `findByIdAndUpdate` ga bir xil obyekt ketadi", async () => {
    const resident = makeResident({ program: "ordinatura", supervisor: "u-1" });

    Attendance.find = jest.fn().mockResolvedValue(absences);
    Resident.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(resident),
    });
    await runExpulsionCheck("resident1");
    const controllerUpdate = Resident.findByIdAndUpdate.mock.calls[0][1];

    jest.clearAllMocks();
    Attendance.find = jest.fn().mockResolvedValue(absences);
    Resident.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
    Resident.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([resident]),
    });
    await runExpulsionSweep();
    const cronUpdate = Resident.findByIdAndUpdate.mock.calls[0][1];

    const shape = (u) => ({
      ...u,
      warningIssuedAt: u.warningIssuedAt instanceof Date,
      expulsionOrderCreatedAt: u.expulsionOrderCreatedAt instanceof Date,
    });
    expect(shape(cronUpdate)).toEqual(shape(controllerUpdate));
    expect(controllerUpdate.totalUnexcusedHours).toBe(72);
    expect(controllerUpdate.warningIssued).toBe(true);
    expect(controllerUpdate).not.toHaveProperty("expulsionOrderCreated");
    expect(openDraft).toHaveBeenCalledTimes(1);
  });

  test("cron yo'li ham D-16 ustoz xabarini yuboradi (ilgari YO'Q edi)", async () => {
    Attendance.find = jest.fn().mockResolvedValue([{ hours: 6 }]);
    Resident.find = jest.fn().mockReturnValue({
      populate: jest
        .fn()
        .mockResolvedValue([
          makeResident({ program: "ordinatura", supervisor: "u-ustoz" }),
        ]),
    });

    await runExpulsionSweep();

    expect(notifyUser).toHaveBeenCalledWith(
      "u-ustoz",
      expect.objectContaining({ eventType: "supervisor_event" }),
    );
  });
});

describe("runExpulsionCheck — rezident topilmasa", () => {
  test("jimgina qaytadi, hech narsa yozmaydi", async () => {
    Resident.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });
    await expect(runExpulsionCheck("yoq")).resolves.toBeUndefined();
    expect(Resident.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe("P3 — chetlatish ostonasi rezidentni DEAKTIVATSIYA QILMAYDI", () => {
  test("`update` da `active` maydoni UMUMAN bo'lmaydi", () => {
    const { update } = evaluateResident(makeResident(), EXPULSION_HOURS);
    expect(update).not.toHaveProperty("active");
  });

  test("`update` kalitlari TO'LIQ qulflangan — ortiqcha maydon qo'shilmaydi", () => {
    const { update } = evaluateResident(makeResident(), EXPULSION_HOURS);
    expect(Object.keys(update).sort()).toEqual([
      "totalUnexcusedHours",
      "warningIssued",
      "warningIssuedAt",
    ]);
  });

  test("bo'limga (`office`) effekt yaratiladi — ilgari 72 soatda hech kim xabar olmasdi", () => {
    const { effects } = evaluateResident(makeResident(), EXPULSION_HOURS);
    const office = draftNotices(effects).find((e) => e.kind === "office");
    expect(office).toBeDefined();
    expect(office.payload.eventType).toBe("residency_expulsion_draft_office");
    expect(office.payload.metadata).toEqual({ residentId: "resident1" });
  });

  test("umumiy Telegram chatiga xabar YUBORILMAYDI (R-2)", () => {
    const { effects } = evaluateResident(makeResident(), EXPULSION_HOURS);
    expect(kinds(effects).filter((k) => k === "telegram")).toHaveLength(1);
  });

  test("rezidentga INFORMATSION xabar + `metadata.residentId` (qaytarish uchun)", () => {
    const { effects } = evaluateResident(makeResident(), EXPULSION_HOURS);
    const inApp = draftNotices(effects).filter((e) => e.kind === "inApp");
    const expulsion = inApp.find(
      (e) => e.payload.eventType === "residency_expulsion",
    );
    expect(expulsion.payload.title).toMatch(/loyiha/i);
    expect(expulsion.payload.metadata).toEqual({ residentId: "resident1" });
  });
});

describe("P3 — soat 72 dan pastga tushsa loyiha BEKOR qilinadi", () => {
  test("`cancelDraft` effekti; bayroq `update` ga YOZILMAYDI (P6a)", () => {
    const resident = makeResident({ expulsionOrderCreated: true });
    const { update, effects } = evaluateResident(resident, 20);
    expect(update).not.toHaveProperty("expulsionOrderCreated");
    expect(update).not.toHaveProperty("expulsionOrderCreatedAt");
    expect(effects.find((e) => e.kind === "cancelDraft")).toEqual({
      kind: "cancelDraft",
      hours: 20,
    });
  });

  test("bayroq yo'q — bekor qilishga hech narsa yo'q", () => {
    const { update, effects } = evaluateResident(makeResident(), 20);
    expect(update).not.toHaveProperty("expulsionOrderCreated");
    expect(kinds(effects)).not.toContain("cancelDraft");
  });

  test("HAMON ostonada — bekor qilinmaydi", () => {
    const resident = makeResident({ expulsionOrderCreated: true });
    const { update, effects } = evaluateResident(resident, EXPULSION_HOURS);
    expect(update).not.toHaveProperty("expulsionOrderCreated");
    expect(kinds(effects)).not.toContain("cancelDraft");
  });

  test("`user` yo'q bo'lsa ham bekor qilinadi — bo'lim xabarlari ham bor", () => {
    const resident = makeResident({ expulsionOrderCreated: true, user: null });
    const { effects } = evaluateResident(resident, 20);
    expect(kinds(effects)).toContain("cancelDraft");
  });

  test("NaN soatda bekor QILINMAYDI", () => {
    const resident = makeResident({ expulsionOrderCreated: true });
    const { update } = evaluateResident(resident, NaN);
    expect(update).not.toHaveProperty("expulsionOrderCreated");
  });
});

describe("P5 — holat darvozasi: hisob faqat `oquvda`", () => {
  test("`oquvda` — ostona ISHLAYDI", () => {
    const { effects } = evaluateResident(
      makeResident({ status: "oquvda" }),
      EXPULSION_HOURS,
    );
    expect(kinds(effects)).toContain("openDraft");
  });

  test("`chetlatilgan` — ostona ISHLAMAYDI", () => {
    const { update, effects } = evaluateResident(
      makeResident({ status: "chetlatilgan" }),
      EXPULSION_HOURS,
    );
    expect(update).toEqual({ totalUnexcusedHours: EXPULSION_HOURS });
    expect(effects).toEqual([]);
  });

  test("`akademik_tatil` — ostona ISHLAMAYDI", () => {
    const { update, effects } = evaluateResident(
      makeResident({ status: "akademik_tatil" }),
      WARNING_HOURS,
    );
    expect(update).toEqual({ totalUnexcusedHours: WARNING_HOURS });
    expect(effects).toEqual([]);
  });

  test("`status` YO'Q (eski hujjat) — ostona ISHLAYDI", () => {
    const { effects } = evaluateResident(makeResident(), EXPULSION_HOURS);
    expect(kinds(effects)).toContain("openDraft");
  });

  test("`status: null` — ostona ISHLAYDI", () => {
    const { update } = evaluateResident(
      makeResident({ status: null }),
      WARNING_HOURS,
    );
    expect(update.warningIssued).toBe(true);
  });
});

describe("P5 — holat darvozasi: bekor qilish har holatda", () => {
  test("`akademik_tatil` bo'lsa ham ogohlantirish bekor qilinadi (D-23)", () => {
    const resident = makeResident({
      status: "akademik_tatil",
      warningIssued: true,
    });
    const { update, effects } = evaluateResident(resident, 2);
    expect(update.warningIssued).toBe(false);
    expect(kinds(effects)).toContain("revokeWarning");
  });

  test("`akademik_tatil` bo'lsa ham buyruq loyihasi bekor qilinadi (P3)", () => {
    const resident = makeResident({
      status: "akademik_tatil",
      expulsionOrderCreated: true,
    });
    const { effects } = evaluateResident(resident, 20);
    expect(kinds(effects)).toContain("cancelDraft");
  });

  test("`active: false` — `cancelDraft` YO'Q (migratsiya kutilmoqda)", () => {
    const resident = makeResident({ active: false, expulsionOrderCreated: true });
    const { effects } = evaluateResident(resident, 20);
    expect(kinds(effects)).not.toContain("cancelDraft");
  });

  test("`chetlatilgan` — bayroq TEGILMAYDI, `cancelDraft` YO'Q (P6a)", () => {
    const resident = makeResident({
      status: "chetlatilgan",
      expulsionOrderCreated: true,
    });
    const { update, effects } = evaluateResident(resident, 20);
    expect(update).not.toHaveProperty("expulsionOrderCreated");
    expect(kinds(effects)).not.toContain("cancelDraft");
  });
});
