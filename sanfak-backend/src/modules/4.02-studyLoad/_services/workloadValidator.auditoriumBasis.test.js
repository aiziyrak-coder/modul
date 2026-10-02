jest.mock("#references/auditoriumHour/auditoriumHour.model", () => ({
  findOne: jest.fn(),
}));

const AuditoriumHour = require("#references/auditoriumHour/auditoriumHour.model");
const {
  calcEntryAuditoriumHour,
  validateOneEntry,
  validateMaxOverload,
  clearNormaCache,
} = require("./workloadValidator");

const NORMA = {
  auditoriumHour: 880,
  categories: [
    { slug: "assistant", value: 400 },
    { slug: "docent", value: 350 },
    { slug: "professor", value: 300 },
  ],
};

const block = (aud, total, nonAudit = 0) => ({
  studyWork: {
    thisSemester: { auditoriumHour: aud, totalHour: total - nonAudit },
  },
  nonAuditHour: nonAudit,
  totalHour: total,
});

beforeEach(() => {
  clearNormaCache();
  AuditoriumHour.findOne.mockReturnValue({
    sort: () => ({ lean: () => Promise.resolve(NORMA) }),
  });
});

afterEach(() => {
  clearNormaCache();
  jest.clearAllMocks();
});

describe("calcEntryAuditoriumHour — sof auditoriya yig'indisi", () => {
  test("bloklar yig'indisi qaytadi (nonAuditHour va items KIRMAYDI)", () => {
    const entry = { blocks: [block(300, 460, 40), block(100, 120, 0)] };
    expect(calcEntryAuditoriumHour(entry)).toBe(400);
  });

  test("blocks yo'q / entry null → 0 (qulamaydi)", () => {
    expect(calcEntryAuditoriumHour(null)).toBe(0);
    expect(calcEntryAuditoriumHour({})).toBe(0);
    expect(calcEntryAuditoriumHour({ blocks: [] })).toBe(0);
  });

  test("eski/fallback blokda `thisSemester` yo'q → 0 hissa (ma'lum bo'shliq)", () => {
    expect(calcEntryAuditoriumHour({ blocks: [{ totalHour: 500 }] })).toBe(0);
  });

  test("min() QO'RIQCHISI: `updateBlockHours` bilan soat QO'LDA pasaytirilgan blok", () => {
    const entry = { blocks: [block(400, 200, 0)] };
    expect(calcEntryAuditoriumHour(entry)).toBe(200);
  });

  test("min() qo'riqchisi tahrirsiz holatda hech narsani o'zgartirmaydi", () => {
    expect(calcEntryAuditoriumHour({ blocks: [block(300, 460, 40)] })).toBe(300);
  });

  test("manfiy natija chiqmaydi (nonAuditHour > totalHour — buzuq yozuv)", () => {
    expect(calcEntryAuditoriumHour({ blocks: [block(50, 10, 40)] })).toBe(0);
  });
});

describe("validateOneEntry — taqqoslash bazasi AUDITORIYA (D-129)", () => {
  test("jami soat KATTA, auditoriya KICHIK → XATO beriladi", async () => {
    const entry = {
      _id: "e1",
      position: "assistant",
      stavka: 1.0,
      totalHour: 900,
      blocks: [block(300, 900, 100)],
    };
    const err = await validateOneEntry(entry);
    expect(err).not.toBeNull();
    expect(err.severity).toBe("error");
    expect(err.minHour).toBe(400);
    expect(err.auditoriumHour).toBe(300);
    expect(err.shortage).toBe(100);
    expect(err.totalHour).toBe(900);
  });

  test("auditoriya YETARLI, entry.totalHour kichik → XATO BERILMAYDI", async () => {
    const entry = {
      _id: "e2",
      position: "assistant",
      stavka: 1.0,
      totalHour: 100,
      blocks: [block(420, 420, 0)],
    };
    expect(await validateOneEntry(entry)).toBeNull();
  });

  test("dotsent 350 — lavozim normasi hisobga olinadi", async () => {
    const base = { _id: "e3", position: "docent", stavka: 1.0, totalHour: 0 };
    expect(
      await validateOneEntry({ ...base, blocks: [block(350, 350, 0)] }),
    ).toBeNull();
    const err = await validateOneEntry({
      ...base,
      blocks: [block(349, 349, 0)],
    });
    expect(err.minHour).toBe(350);
    expect(err.auditoriumHour).toBe(349);
  });

  test("0.5 stavka → norma ham yarim", async () => {
    const entry = {
      _id: "e4",
      position: "assistant",
      stavka: 0.5,
      totalHour: 0,
      blocks: [block(200, 200, 0)],
    };
    expect(await validateOneEntry(entry)).toBeNull();
  });

  test("min() qo'riqchisi validatsiyada ham ishlaydi (qo'lda pasaytirilgan blok)", async () => {
    const entry = {
      _id: "e5",
      position: "assistant",
      stavka: 1.0,
      totalHour: 200,
      blocks: [block(400, 200, 0)],
    };
    const err = await validateOneEntry(entry);
    expect(err).not.toBeNull();
    expect(err.auditoriumHour).toBe(200);
    expect(err.shortage).toBe(200);
  });

  test("vakant yozuv tekshirilmaydi (o'zgarmagan xulq)", async () => {
    expect(
      await validateOneEntry({ _id: "e6", isVacant: true, blocks: [] }),
    ).toBeNull();
  });
});

describe("validateMaxOverload — max ham AUDITORIYA bazasida (SHART 6)", () => {
  test("auditoriya 1.5× normadan oshsa → ogohlantirish", async () => {
    const entry = {
      _id: "m1",
      position: "assistant",
      stavka: 1.0,
      totalHour: 900,
      blocks: [block(700, 900, 50)],
    };
    const w = await validateMaxOverload(entry);
    expect(w).not.toBeNull();
    expect(w.severity).toBe("warning");
    expect(w.maxHour).toBe(600);
    expect(w.auditoriumHour).toBe(700);
    expect(w.excess).toBe(100);
    expect(w.totalHour).toBe(900);
  });

  test("jami soat 600 dan oshgan, AUDITORIYA oshmagan → ogohlantirish YO'Q", async () => {
    const entry = {
      _id: "m2",
      position: "assistant",
      stavka: 1.0,
      totalHour: 900,
      blocks: [block(500, 900, 100)],
    };
    expect(await validateMaxOverload(entry)).toBeNull();
  });

  test("bitta entry bir vaqtda min-xato VA max-ogohlantirish bo'la olmaydi", async () => {
    const entry = {
      _id: "m3",
      position: "assistant",
      stavka: 1.0,
      totalHour: 5000,
      blocks: [block(120, 5000, 0)],
    };
    const err = await validateOneEntry(entry);
    const warn = await validateMaxOverload(entry);
    expect(err).not.toBeNull();
    expect(warn).toBeNull();
  });

  test("vakant yozuv tekshirilmaydi (o'zgarmagan xulq)", async () => {
    expect(
      await validateMaxOverload({ _id: "m4", isVacant: true, blocks: [] }),
    ).toBeNull();
  });
});

describe("calcEntryAuditoriumHour — `teachingAuditoriumHour` va classTypes fallback (2026-09-02)", () => {
  const distBlock = ({ aud, teaching = null, classTypes = null, total, nonAudit = 0 }) => ({
    studyWork: {
      thisSemester: {
        auditoriumHour: aud,
        totalHour: total - nonAudit,
        ...(teaching !== null ? { teachingAuditoriumHour: teaching } : {}),
      },
      ...(classTypes !== null ? { classTypes } : {}),
    },
    nonAuditHour: nonAudit,
    totalHour: total,
  });

  test("1) `teachingAuditoriumHour` saqlangan bo'lsa — o'shani ishlatadi (60 EMAS, 168)", () => {
    const entry = {
      blocks: [distBlock({ aud: 60, teaching: 168, total: 174, nonAudit: 6 })],
    };
    expect(calcEntryAuditoriumHour(entry)).toBe(168);
  });

  test("2) jonli regressiya — `teachingAuditoriumHour` YO'Q, classTypes'dan qayta hisoblanadi (60 EMAS, 168)", () => {
    const entry = {
      blocks: [
        distBlock({
          aud: 60,
          classTypes: [
            { slug: "maruza", stream: 12, total: 24 },
            { slug: "amaliy", stream: 48, total: 144 },
          ],
          total: 174,
          nonAudit: 6,
        }),
      ],
    };
    expect(calcEntryAuditoriumHour(entry)).toBe(168);
  });

  test("3) classTypes umuman yo'q, `teachingAuditoriumHour` ham yo'q → eski `auditoriumHour`ga tayanadi (120)", () => {
    const entry = { blocks: [distBlock({ aud: 120, total: 120 })] };
    expect(calcEntryAuditoriumHour(entry)).toBe(120);
  });

  test("4) dotsent 1.0 stavka (norma 350) 168 soat bilan XATO beradi, 0.25 stavkada O'TADI", async () => {
    const makeEntry = (stavka) => ({
      _id: "d1",
      position: "docent",
      stavka,
      totalHour: 174,
      blocks: [
        distBlock({
          aud: 60,
          classTypes: [
            { slug: "maruza", stream: 12, total: 24 },
            { slug: "amaliy", stream: 48, total: 144 },
          ],
          total: 174,
          nonAudit: 6,
        }),
      ],
    });

    const full = await validateOneEntry(makeEntry(1.0));
    expect(full).not.toBeNull();
    expect(full.auditoriumHour).toBe(168);
    expect(full.minHour).toBe(350);

    const quarter = await validateOneEntry(makeEntry(0.25));
    expect(quarter).toBeNull();
  });
});
