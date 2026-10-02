"use strict";

const mockResidentAggregate = jest.fn();
const mockResidentFind = jest.fn();
const mockLogAggregate = jest.fn();
const mockLogDistinct = jest.fn();

jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  aggregate: (...a) => mockResidentAggregate(...a),
  find: (...a) => mockResidentFind(...a),
}));

jest.mock("#modules/4.05-residency/attendance/attendance.model", () => ({
  aggregate: jest.fn(),
}));

jest.mock(
  "#modules/4.05-residency/residencyAttestation/residencyAttestationResult.model",
  () => ({ aggregate: jest.fn() }),
);

jest.mock("#modules/4.05-residency/dailyLog/dailyLog.model", () => ({
  aggregate: (...a) => mockLogAggregate(...a),
  distinct: (...a) => mockLogDistinct(...a),
}));

const service = require("./residencyReport.service");

const RESIDENT_IDS = ["r1", "r2", "r3"];

const findChain = (ids) => ({ distinct: jest.fn(() => Promise.resolve(ids)) });

beforeEach(() => {
  jest.clearAllMocks();
  mockResidentFind.mockReturnValue(findChain(RESIDENT_IDS));
});

describe("studyPeriodDistribution — o'qish muddati (TZ: 1/2/3 yil)", () => {
  it("yillar bo'yicha O'SISH tartibida qaytadi", async () => {
    mockResidentAggregate.mockResolvedValue([
      { _id: 3, count: 2 },
      { _id: 1, count: 5 },
      { _id: 2, count: 4 },
    ]);

    const out = await service.studyPeriodDistribution({});

    expect(out).toEqual([
      { years: 1, title: "1 yil", count: 5 },
      { years: 2, title: "2 yil", count: 4 },
      { years: 3, title: "3 yil", count: 2 },
    ]);
  });

  it("muddati BELGILANMAGAN rezidentlar alohida guruh bo'lib, OXIRIDA turadi", async () => {
    mockResidentAggregate.mockResolvedValue([
      { _id: 2, count: 4 },
      { _id: null, count: 3 },
    ]);

    const out = await service.studyPeriodDistribution({});

    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({ years: null, title: "Belgilanmagan", count: 3 });
    expect(out.reduce((n, r) => n + r.count, 0)).toBe(7);
  });

  it("son bo'lmagan qiymat ham 'Belgilanmagan' ga qo'shiladi", async () => {
    mockResidentAggregate.mockResolvedValue([
      { _id: null, count: 1 },
      { _id: "", count: 2 },
      { _id: 1, count: 1 },
    ]);

    const out = await service.studyPeriodDistribution({});

    expect(out.find((r) => r.years === null).count).toBe(3);
  });

  it("ma'lumot yo'q -> bo'sh massiv", async () => {
    mockResidentAggregate.mockResolvedValue([]);
    expect(await service.studyPeriodDistribution({})).toEqual([]);
  });
});

describe("clinicalActivity — klinik amaliyot faolligi", () => {
  it("holatlar bo'yicha jamlaydi va o'rtachani hisoblaydi", async () => {
    mockLogAggregate.mockResolvedValue([
      { _id: "tasdiqlangan", n: 5 },
      { _id: "kutilmoqda", n: 3 },
      { _id: "qaytarilgan", n: 1 },
    ]);
    mockLogDistinct.mockResolvedValue(["r1", "r2"]);

    const out = await service.clinicalActivity({});

    expect(out.total).toBe(9);
    expect(out.byStatus).toEqual({ tasdiqlangan: 5, kutilmoqda: 3, qaytarilgan: 1 });
    expect(out.avgPerResident).toBe(3);
  });

  it("kundalik yuritmayotgan rezidentlarni sanaydi", async () => {
    mockLogAggregate.mockResolvedValue([{ _id: "tasdiqlangan", n: 2 }]);
    mockLogDistinct.mockResolvedValue(["r1"]);

    const out = await service.clinicalActivity({});

    expect(out.activeResidents).toBe(1);
    expect(out.silentResidents).toBe(2);
  });

  it("noma'lum holat jamiga kiradi, lekin `byStatus` ni buzmaydi", async () => {
    mockLogAggregate.mockResolvedValue([
      { _id: "tasdiqlangan", n: 2 },
      { _id: "allaqachon_yoq_holat", n: 4 },
    ]);
    mockLogDistinct.mockResolvedValue(["r1"]);

    const out = await service.clinicalActivity({});

    expect(out.total).toBe(6);
    expect(Object.keys(out.byStatus).sort()).toEqual([
      "kutilmoqda",
      "qaytarilgan",
      "tasdiqlangan",
    ]);
  });

  it("rezident yo'q -> nollar, DBga umuman borilmaydi", async () => {
    mockResidentFind.mockReturnValue(findChain([]));

    const out = await service.clinicalActivity({});

    expect(out).toMatchObject({ total: 0, activeResidents: 0, silentResidents: 0 });
    expect(mockLogAggregate).not.toHaveBeenCalled();
  });

  it("yozuv yo'q -> nollar, lekin silentResidents TO'LIQ", async () => {
    mockLogAggregate.mockResolvedValue([]);
    mockLogDistinct.mockResolvedValue([]);

    const out = await service.clinicalActivity({});

    expect(out.total).toBe(0);
    expect(out.silentResidents).toBe(3);
    expect(out.avgPerResident).toBe(0);
  });
});

describe("supervisorWorkload — ilmiy rahbarlar yuklamasi", () => {
  const ROW = {
    _id: "u1",
    name: "Eski Snapshot",
    total: 3,
    magistratura: 2,
    ordinatura: 1,
    u: [{ lastName: "Karimov", firstName: "Anvar", middleName: "B." }],
  };

  it("dastur kesimida sanaydi", async () => {
    mockResidentAggregate.mockResolvedValue([ROW]);

    const [row] = await service.supervisorWorkload({});

    expect(row).toEqual({
      supervisorId: "u1",
      name: "Karimov Anvar B.",
      total: 3,
      magistratura: 2,
      ordinatura: 1,
    });
  });

  it("akkaunt topilmasa snapshot ism ishlatiladi", async () => {
    mockResidentAggregate.mockResolvedValue([{ ...ROW, u: [] }]);
    expect((await service.supervisorWorkload({}))[0].name).toBe("Eski Snapshot");
  });

  it("ism umuman yo'q -> 'Noma'lum' (satr bo'sh chiqmaydi)", async () => {
    mockResidentAggregate.mockResolvedValue([{ ...ROW, name: null, u: [] }]);
    expect((await service.supervisorWorkload({}))[0].name).toBe("Noma'lum");
  });

  it("biriktirilmagan rezidentlar hisobga kirmaydi", async () => {
    mockResidentAggregate.mockResolvedValue([]);
    await service.supervisorWorkload({});

    const [pipeline] = mockResidentAggregate.mock.calls[0];
    expect(pipeline[0].$match.supervisor).toEqual({ $ne: null });
  });

  it("`$lookup` proyeksiyasida MAXFIY maydon YO'Q", async () => {
    mockResidentAggregate.mockResolvedValue([]);
    await service.supervisorWorkload({});

    const [pipeline] = mockResidentAggregate.mock.calls[0];
    const lookup = pipeline.find((st) => st.$lookup);
    const project = lookup.$lookup.pipeline.find((st) => st.$project).$project;

    for (const secret of ["oneIdPin", "refreshToken", "passportNumber", "eriCertificate"]) {
      expect(project).not.toHaveProperty(secret);
    }
    expect(Object.keys(project).sort()).toEqual(["_id", "firstName", "lastName", "middleName"]);
  });

  it("eng yuklangan ustoz BIRINCHI turadi", async () => {
    mockResidentAggregate.mockResolvedValue([]);
    await service.supervisorWorkload({});

    const [pipeline] = mockResidentAggregate.mock.calls[0];
    expect(pipeline.find((st) => st.$sort).$sort).toEqual({ total: -1 });
  });
});

describe("o'chirilgan rezident hisobotga KIRMAYDI", () => {
  it("`residentFilter` da `deletedAt: null` bor — distinct yo'li ham yopiq", async () => {
    mockResidentAggregate.mockResolvedValue([]);
    await service.studyPeriodDistribution({});

    const [pipeline] = mockResidentAggregate.mock.calls[0];
    expect(pipeline[0].$match).toMatchObject({ active: true, deletedAt: null });
  });

  it("`clinicalActivity` ham o'sha filtrni `find()` ga uzatadi", async () => {
    mockLogAggregate.mockResolvedValue([]);
    mockLogDistinct.mockResolvedValue([]);

    await service.clinicalActivity({});

    const [filter] = mockResidentFind.mock.calls[0];
    expect(filter).toMatchObject({ active: true, deletedAt: null });
  });

  it("`supervisorWorkload` da ham shart saqlanadi", async () => {
    mockResidentAggregate.mockResolvedValue([]);
    await service.supervisorWorkload({});

    const [pipeline] = mockResidentAggregate.mock.calls[0];
    expect(pipeline[0].$match).toMatchObject({ active: true, deletedAt: null });
  });
});
