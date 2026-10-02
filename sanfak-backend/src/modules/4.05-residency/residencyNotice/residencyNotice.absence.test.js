"use strict";

jest.mock("../_services/residentScope", () => ({ allowedResidentIds: jest.fn() }));
jest.mock("../_services/absenceNotice", () => ({
  residentStreak: jest.fn(),
  checkEligible: jest.requireActual("../_services/absenceNotice").checkEligible,
  notEligibleMessage: jest.requireActual("../_services/absenceNotice").notEligibleMessage,
  lastDavomatNotice: jest.fn(),
  buildDocument: jest.fn(),
  notifyOffice: jest.fn(),
}));
jest.mock("#modules/4.05-residency/residencySetting/residencySetting.service", () => ({
  getOrCreate: jest.fn(),
}));
jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const Notice = require("./residencyNotice.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const C = require("./residencyNotice.controller");
const { allowedResidentIds } = require("../_services/residentScope");
const absence = require("../_services/absenceNotice");
const settingsService = require("#modules/4.05-residency/residencySetting/residencySetting.service");

const RESIDENT = "6a5a0acbd34b3c21a575daaa";
const MENTOR = { _id: "6a5a0acbd34b3c21a575d59d", firstName: "Ustoz", role: { title: "klinik_ustoz" } };
const SETTINGS = { absenceStreakDays: 3, absenceWindowDays: 7 };
const STREAK = {
  days: 3,
  from: "2026-09-21",
  to: "2026-09-25",
  dayKeys: ["2026-09-21", "2026-09-23", "2026-09-25"],
  windowDays: 7,
  windowFrom: "2026-09-19",
  windowTo: "2026-09-25",
};
const ROWS = [{ day: "2026-09-21", science: "Kardiologiya", lessonType: "amaliy", hours: 2 }];

const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

beforeEach(() => {
  jest.clearAllMocks();
  allowedResidentIds.mockResolvedValue([RESIDENT]);
  settingsService.getOrCreate.mockResolvedValue(SETTINGS);
  absence.residentStreak.mockResolvedValue({ streak: STREAK, rows: ROWS });
  absence.lastDavomatNotice.mockResolvedValue(null);
  absence.buildDocument.mockResolvedValue({
    storageKey: "2026/09/x.pdf",
    fileName: "bildirgi-2026-09-26.pdf",
    size: 9,
    sha256: "abc",
    generatedAt: new Date(),
  });
  absence.notifyOffice.mockResolvedValue(1);
});

afterEach(() => jest.restoreAllMocks());

describe("GET /absence-streak", () => {
  const get = async (resident = RESIDENT) => {
    const r = res();
    const next = jest.fn();
    await C.absenceStreak({ query: { resident }, user: MENTOR }, r, next);
    return { r, next };
  };

  it("doiradan tashqari rezident — 404, o'lchov yo'q", async () => {
    allowedResidentIds.mockResolvedValue([]);
    const { r } = await get();
    expect(r.status).toHaveBeenCalledWith(404);
    expect(absence.residentStreak).not.toHaveBeenCalled();
  });

  it("eski kalitlar + oyna + sanalgan kunlar + lastNotice; W sozlamadan uzatiladi", async () => {
    const last = { id: "n1", createdAt: new Date("2026-09-24T10:00:00Z"), days: 3, from: "2026-09-19", to: "2026-09-23" };
    absence.lastDavomatNotice.mockResolvedValue(last);
    const { r } = await get();
    expect(absence.residentStreak).toHaveBeenCalledWith(RESIDENT, SETTINGS);
    expect(absence.lastDavomatNotice).toHaveBeenCalledWith(RESIDENT, "2026-09-19");
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.json).toHaveBeenCalledWith({
      resident: RESIDENT,
      days: 3,
      from: "2026-09-21",
      to: "2026-09-25",
      threshold: 3,
      eligible: true,
      windowDays: 7,
      windowFrom: "2026-09-19",
      windowTo: "2026-09-25",
      dayKeys: ["2026-09-21", "2026-09-23", "2026-09-25"],
      lastNotice: last,
    });
  });

  it("servis yiqilsa — 400 yangi matn bilan", async () => {
    absence.residentStreak.mockRejectedValue(new Error("db"));
    const { next } = await get();
    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: 400,
      message: "Qoldirilgan kunlarni hisoblashda xato",
    });
  });
});

const post = async (body) => {
  const r = res();
  const next = jest.fn();
  await C.addNotice(
    {
      body: { kind: "davomat", resident: RESIDENT, program: "ordinatura", title: "Bildirgi", content: "izoh", ...body },
      user: MENTOR,
    },
    r,
    next,
  );
  return { r, next };
};

function stubResidentAndSave() {
  jest.spyOn(Resident, "findById").mockReturnValue({
    lean: () => Promise.resolve({ _id: RESIDENT, fullName: "Aliyev Sardor" }),
  });
  jest.spyOn(Notice.prototype, "save").mockImplementation(function save() {
    return Promise.resolve(this);
  });
}

describe("POST davomat bildirgisi — rad etish", () => {
  beforeEach(stubResidentAndSave);

  it("rezident tanlanmagan — 400", async () => {
    const { r } = await post({ resident: undefined });
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it("doiradan tashqari — 404", async () => {
    allowedResidentIds.mockResolvedValue([]);
    const { r } = await post();
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it("ostonaga yetmagan — 400 aniq matn, hech narsa saqlanmaydi", async () => {
    absence.residentStreak.mockResolvedValue({ streak: { ...STREAK, days: 2 }, rows: ROWS });
    const { r } = await post();
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json).toHaveBeenCalledWith({
      message:
        "Davomat bildirgisi oxirgi 7 kunda kamida 3 kun sababsiz qoldirilganda yuboriladi (hozir: 2 kun)",
    });
    expect(Notice.prototype.save).not.toHaveBeenCalled();
    expect(absence.buildDocument).not.toHaveBeenCalled();
  });

});

describe("POST davomat bildirgisi — yuborish", () => {
  beforeEach(stubResidentAndSave);

  it("🔴 yetgan — snapshot oyna bilan saqlanadi, PDF sanalgan qatorlar bilan, 201", async () => {
    jest.useFakeTimers();
    try {
      const { r } = await post({ absence: { days: 99, from: "x", to: "y" } });
      expect(r.status).toHaveBeenCalledWith(201);

      const saved = Notice.prototype.save.mock.contexts[0];
      expect(saved.absence.toObject()).toEqual({
        days: 3,
        from: "2026-09-21",
        to: "2026-09-25",
        windowDays: 7,
        windowFrom: "2026-09-19",
        windowTo: "2026-09-25",
      });
      expect(absence.buildDocument).toHaveBeenCalledWith(
        expect.objectContaining({ streak: STREAK, rows: ROWS, content: "izoh" }),
      );

      expect(absence.notifyOffice).not.toHaveBeenCalled();
      jest.runAllTimers();
      expect(absence.notifyOffice).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
