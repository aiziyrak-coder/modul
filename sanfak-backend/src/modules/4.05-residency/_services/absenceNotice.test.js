"use strict";

const mockDispatch = jest.fn();
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: mockDispatch,
}));

const mockOfficeUserIds = jest.fn();
jest.mock("./officeRecipients", () => ({ officeUserIds: mockOfficeUserIds }));

const mockBuildPdf = jest.fn();
jest.mock("#modules/4.05-residency/_pdf/absenceNotice.pdf", () => ({
  buildAbsenceNoticePdf: mockBuildPdf,
}));

const mockSave = jest.fn();
jest.mock("./noticeFiles", () => ({ save: mockSave }));

const mockFind = jest.fn();
const mockFindOne = jest.fn();
const mockModelName = jest.fn();
jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");
  return {
    isValidObjectId: actual.isValidObjectId,
    Types: actual.Types,
    model: (name) => {
      mockModelName(name);
      return { find: mockFind, findOne: mockFindOne };
    },
  };
});

jest.mock("#shared/winston.logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const {
  residentStreak,
  checkEligible,
  notEligibleMessage,
  lastDavomatNotice,
  buildDocument,
  notifyOffice,
  WARNING_HOURS,
  EXPULSION_HOURS,
} = require("./absenceNotice");

const chain = (rows) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.populate = jest.fn(() => c);
  c.sort = jest.fn(() => c);
  c.lean = jest.fn(() => Promise.resolve(rows));
  return c;
};

const day = (d, status, extra = {}) => ({
  date: new Date(`${d}T06:00:00.000Z`),
  status,
  hours: 2,
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDispatch.mockResolvedValue(undefined);
  mockOfficeUserIds.mockResolvedValue(["o1", "o2"]);
  mockBuildPdf.mockResolvedValue(Buffer.from("%PDF-fake"));
  mockSave.mockResolvedValue({ storageKey: "2026/09/x.pdf", size: 9, sha256: "abc" });
});

describe("checkEligible — ostona sozlamadan, `>=` (ABS-Q2=A)", () => {
  it.each([
    [4, 3, true],
    [3, 3, true],
    [2, 3, false],
    [2, 1, true],
  ])("%i kun, ostona %i -> %p", (days, absenceStreakDays, want) => {
    expect(checkEligible({ days }, { absenceStreakDays }).eligible).toBe(want);
  });

  it("ostona qaytariladi (xato matnida ishlatiladi)", () => {
    expect(checkEligible({ days: 9 }, { absenceStreakDays: 5 }).threshold).toBe(5);
  });

  it("sozlama o'qilmasa hech qachon ochilmaydi (fail-closed)", () => {
    expect(checkEligible({ days: 99 }, {}).eligible).toBe(false);
    expect(checkEligible({ days: 99 }, undefined).eligible).toBe(false);
  });
});

describe("residentStreak — oxirgi W yopilgan kun (ABS-Q1=A, ABS-Q4=A)", () => {
  const NOW = new Date("2026-09-04T06:00:00.000Z");
  const SETTINGS = { absenceWindowDays: 7 };

  it("sanalgan kunlar va faqat o'sha kunlardagi qoldirilgan qatorlar qaytadi", async () => {
    mockFind.mockReturnValue(
      chain([
        day("2026-08-20", "absent"),
        day("2026-09-01", "present"),
        day("2026-09-02", "absent", { scienceTitle: "Kardiologiya", lessonType: "amaliy" }),
        day("2026-09-02", "present", { hours: 1 }),
        day("2026-09-03", "absent", { scienceTitle: "Kardiologiya", lessonType: "amaliy" }),
        day("2026-09-04", "absent"),
      ]),
    );

    const { streak, rows } = await residentStreak("r1", SETTINGS, NOW);

    expect(streak).toMatchObject({
      days: 1,
      dayKeys: ["2026-09-03"],
      windowDays: 7,
      windowFrom: "2026-08-28",
      windowTo: "2026-09-03",
    });
    expect(rows.map((r) => r.day)).toEqual(["2026-09-03"]);
    expect(rows[0]).toMatchObject({ science: "Kardiologiya", lessonType: "amaliy", hours: 2 });
  });

  it("kun ora qoldirilgan kunlar ham sanaladi", async () => {
    mockFind.mockReturnValue(
      chain([
        day("2026-08-31", "absent"),
        day("2026-09-01", "present"),
        day("2026-09-02", "absent"),
        day("2026-09-03", "absent"),
      ]),
    );
    const { streak, rows } = await residentStreak("r1", SETTINGS, NOW);
    expect(streak.days).toBe(3);
    expect(rows).toHaveLength(3);
  });

});

describe("residentStreak — so'rov chegarasi va fail-closed (ABS-Q7=A, ABS-Q8=A)", () => {
  const NOW = new Date("2026-09-04T06:00:00.000Z");
  const SETTINGS = { absenceWindowDays: 7 };

  it("jonli ma'lumotnoma nomi snapshot'dan USTUN", async () => {
    mockFind.mockReturnValue(
      chain([
        day("2026-09-02", "absent", {
          science: { title: "Jonli nom" },
          scienceTitle: "Eski snapshot",
        }),
      ]),
    );
    const { rows } = await residentStreak("r1", SETTINGS, NOW);
    expect(rows[0].science).toBe("Jonli nom");
  });

  it("sanalgan kun yo'q — qatorlar ham bo'sh", async () => {
    mockFind.mockReturnValue(chain([day("2026-09-03", "present")]));
    const { streak, rows } = await residentStreak("r1", SETTINGS, NOW);
    expect(streak.days).toBe(0);
    expect(rows).toEqual([]);
  });

  it("so'rov AYNAN oyna bilan chegaralanadi va faqat AKTIV yozuvlar (ABS-Q8=A)", async () => {
    mockFind.mockReturnValue(chain([]));
    await residentStreak("r1", SETTINGS, NOW);
    expect(mockFind).toHaveBeenCalledWith({
      resident: "r1",
      active: true,
      date: {
        $gte: new Date("2026-08-27T19:00:00.000Z"),
        $lt: new Date("2026-09-03T19:00:00.000Z"),
      },
    });
  });

  it.each([[{}], [{ absenceWindowDays: 0 }], [undefined]])(
    "W yaroqsiz (%p) — so'rov yuborilmaydi, hech narsa sanalmaydi",
    async (settings) => {
      const { streak, rows } = await residentStreak("r1", settings, NOW);
      expect(mockFind).not.toHaveBeenCalled();
      expect(streak).toMatchObject({ days: 0, windowDays: null });
      expect(rows).toEqual([]);
    },
  );
});

describe("notEligibleMessage — 400 matni", () => {
  it("oyna va ostona bilan", () => {
    expect(notEligibleMessage({ days: 2, windowDays: 7 }, 3)).toBe(
      "Davomat bildirgisi oxirgi 7 kunda kamida 3 kun sababsiz qoldirilganda yuboriladi (hozir: 2 kun)",
    );
  });

  it.each([
    [{ days: 0, windowDays: null }, 3],
    [{ days: 2, windowDays: 7 }, null],
  ])("sozlama buzuq (%p, %p) — sonlarsiz umumiy matn", (streak, threshold) => {
    expect(notEligibleMessage(streak, threshold)).toBe(
      "Davomat bildirgisi hozir yuborib bo'lmaydi — sozlamani tekshiring",
    );
  });
});

describe("lastDavomatNotice — oynaga tushgan oldingi bildirgi (ABS-Q13=A)", () => {
  const one = (doc) => {
    const c = {};
    c.sort = jest.fn(() => c);
    c.select = jest.fn(() => c);
    c.lean = jest.fn(() => Promise.resolve(doc));
    return c;
  };

  it("oyna boshidan kech tugagan eng so'nggi davomat bildirgisini qaytaradi", async () => {
    const createdAt = new Date("2026-09-02T10:00:00.000Z");
    const c = one({ _id: "n1", createdAt, absence: { days: 3, from: "2026-08-28", to: "2026-09-01" } });
    mockFindOne.mockReturnValue(c);

    await expect(lastDavomatNotice("r1", "2026-08-28")).resolves.toEqual({
      id: "n1",
      createdAt,
      days: 3,
      from: "2026-08-28",
      to: "2026-09-01",
    });
    expect(mockModelName).toHaveBeenCalledWith("residencyNotice");
    expect(mockFindOne).toHaveBeenCalledWith({
      resident: "r1",
      kind: "davomat",
      "absence.to": { $gte: "2026-08-28" },
    });
    expect(c.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it("topilmasa null", async () => {
    mockFindOne.mockReturnValue(one(null));
    await expect(lastDavomatNotice("r1", "2026-08-28")).resolves.toBeNull();
  });

  it("oyna yo'q (fail-closed) — so'rov yuborilmaydi", async () => {
    await expect(lastDavomatNotice("r1", null)).resolves.toBeNull();
    expect(mockFindOne).not.toHaveBeenCalled();
  });
});

describe("🔴 buildDocument — PDF ga nima UZATILADI", () => {
  const resident = {
    fullName: "Aliyev Sardor",
    program: "ordinatura",
    specialtyTitle: "Kardiologiya",
    departmentTitle: "Kafedra",
    courseNumber: 2,
    groupTitle: "ORD-201",
    totalUnexcusedHours: 10,
    jshshir: "12345678901234",
    passportSeria: "AA",
    passportNumber: "1234567",
    email: "a@b.uz",
    phone: "+998901112233",
    address: "Farg'ona sh.",
  };

  it("JSHSHIR, pasport, email, telefon va manzil UZATILMAYDI", async () => {
    await buildDocument({
      resident,
      supervisor: { fullName: "Ustoz" },
      streak: { days: 5, from: "2026-09-01", to: "2026-09-08" },
      rows: [],
      content: "izoh",
    });

    const passed = mockBuildPdf.mock.calls[0][0];
    const keys = Object.keys(passed.resident);
    expect(keys.sort()).toEqual(
      [
        "courseNumber",
        "departmentTitle",
        "fullName",
        "groupTitle",
        "program",
        "specialtyTitle",
      ].sort(),
    );
    const flat = JSON.stringify(passed);
    expect(flat).not.toContain("12345678901234");
    expect(flat).not.toContain("1234567");
    expect(flat).not.toContain("a@b.uz");
    expect(flat).not.toContain("+998901112233");
  });

  it("ostonalar hujjatga uzatiladi", async () => {
    await buildDocument({
      resident,
      supervisor: {},
      streak: { days: 5 },
      rows: [],
      content: "",
    });
    expect(mockBuildPdf.mock.calls[0][0].totals).toEqual({
      unexcusedHours: 10,
      warningHours: WARNING_HOURS,
      expulsionHours: EXPULSION_HOURS,
    });
  });

  it("saqlangan metadata + ko'rinadigan nom qaytadi", async () => {
    const meta = await buildDocument({
      resident,
      supervisor: {},
      streak: { days: 5 },
      rows: [],
      content: "",
    });
    expect(meta).toMatchObject({ storageKey: "2026/09/x.pdf", size: 9, sha256: "abc" });
    expect(meta.fileName).toMatch(/^bildirgi-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(meta.generatedAt).toBeInstanceOf(Date);
  });
});

describe("notifyOffice — best effort", () => {
  const notice = { _id: "n1", absence: { days: 3, windowDays: 7 } };
  const resident = { fullName: "Aliyev Sardor" };

  it("matn: oyna bilan; eski (oynasiz) snapshot — oynasiz (ABS-Q10=A)", async () => {
    await notifyOffice(notice, resident);
    expect(mockDispatch.mock.calls[0][0].body).toBe(
      "Aliyev Sardor — oxirgi 7 kunda 3 kun sababsiz qoldirdi",
    );
    mockDispatch.mockClear();
    await notifyOffice({ _id: "n0", absence: { days: 5 } }, resident);
    expect(mockDispatch.mock.calls[0][0].body).toBe("Aliyev Sardor — 5 kun sababsiz qoldirdi");
  });

  it("har bir bo'lim xodimiga yuboriladi", async () => {
    const count = await notifyOffice(notice, resident);
    expect(count).toBe(2);
    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch.mock.calls[0][0]).toMatchObject({
      userId: "o1",
      eventType: "residency_absence_notice",
    });
    expect(mockDispatch.mock.calls[0][0].body).toContain("3 kun");
  });

  it("bittasi yiqilsa qolgani yuboriladi va throw QILINMAYDI", async () => {
    mockDispatch.mockRejectedValueOnce(new Error("tarmoq"));
    await expect(notifyOffice(notice, resident)).resolves.toBe(2);
    expect(mockDispatch).toHaveBeenCalledTimes(2);
  });

  it("xodim topilmasa jimgina 0 qaytadi", async () => {
    mockOfficeUserIds.mockResolvedValue([]);
    await expect(notifyOffice(notice, resident)).resolves.toBe(0);
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
