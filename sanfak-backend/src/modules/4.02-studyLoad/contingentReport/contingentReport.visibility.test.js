"use strict";

jest.mock("./contingentReport.model");
jest.mock("./contingentReport.prefill", () => ({
  PREFILL_CELLS: ["total", "groupCount", "streamCount"],
  buildPrefillRows: jest.fn(),
  mergePrefill: jest.fn(),
  rowKey: () => "",
}));
jest.mock("#references/direction/direction.model", () => ({ find: jest.fn() }));
jest.mock("#references/faculty/faculty.model", () => ({ find: jest.fn() }));

const ContingentReport = require("./contingentReport.model");
const service = require("./contingentReport.service");
const {
  buildChainVisibilityFilter,
  andFilters,
} = require("#modules/4.02-studyLoad/_shared/chainVisibility");
const { ROLES } = require("#config/constants");

const OWN = "f-own";
const OTHER = "f-other";

const readFilter = (role, scope) =>
  andFilters(scope, buildChainVisibilityFilter("contingentReport", role, { userId: "u1" }));

const capture = async (query, visibility) => {
  ContingentReport.paginate = jest.fn().mockResolvedValue({ docs: [] });
  await service.paginateReports(query, visibility);
  return ContingentReport.paginate.mock.calls[0][0];
};

const base = { page: 1, limit: 10 };

describe("paginate filtri — so'rov kaliti scope'ni USTIDAN YOZMAYDI", () => {
  test("dekan `?faculty=<begona>` — ikkala shart ham saqlanadi ($and), natija bo'sh bo'ladi", async () => {
    const filter = await capture({ ...base, faculty: OTHER }, readFilter(ROLES.DEKAN, { faculty: OWN }));
    expect(JSON.stringify(filter)).toContain(OWN);
    expect(filter.faculty).not.toBe(OTHER);
    expect(filter.$and).toEqual([{ faculty: OTHER }, { faculty: OWN }]);
    expect(filter.active).toBe(true);
  });

  test("dekan o'z fakultetini so'rasa — natija o'zgarmaydi (bir xil qiymat, $and)", async () => {
    const filter = await capture({ ...base, faculty: OWN }, readFilter(ROLES.DEKAN, { faculty: OWN }));
    expect(filter).toEqual({ $and: [{ faculty: OWN }, { faculty: OWN }], active: true });
  });

  test("kotib (submitterRoles) `?faculty=<begona>` — baribir o'z fakulteti bilan cheklanadi", async () => {
    const filter = await capture(
      { ...base, faculty: OTHER },
      readFilter(ROLES.FAKULTET_KENGASH_KOTIBI, { faculty: OWN }),
    );
    expect(filter.$and).toEqual([{ faculty: OTHER }, { faculty: OWN }]);
  });

  test.each([ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.REKTOR, ROLES.PROREKTOR])(
    "%s `?status=draft` — kuzatuvchi cheklovi ($nin) saqlanadi",
    async (role) => {
      const filter = await capture({ ...base, status: "draft" }, readFilter(role, {}));
      expect(filter.$and).toEqual([{ status: "draft" }, { status: { $nin: ["draft", "rejected"] } }]);
    },
  );

  test("kuzatuvchi `?status=approved` — to'qnashuv bor, lekin natija mantiqan bo'sh emas", async () => {
    const filter = await capture({ ...base, status: "approved" }, readFilter(ROLES.REKTOR, {}));
    expect(filter.$and).toEqual([{ status: "approved" }, { status: { $nin: ["draft", "rejected"] } }]);
  });

  test("zanjirda yo'q rol (kafedra mudiri) — FAIL_CLOSED filtri so'rov bilan yo'qolmaydi", async () => {
    const filter = await capture({ ...base, faculty: OTHER }, readFilter(ROLES.KAFEDRA_MUDIRI, {}));
    expect(JSON.stringify(filter)).toContain("$expr");
    expect(filter.faculty).toBe(OTHER);
  });

  test("o'quv yili filtri — ko'rinishga tegmaydi", async () => {
    const filter = await capture({ ...base, academicYear: "ay1" }, readFilter(ROLES.DEKAN, { faculty: OWN }));
    expect(filter).toEqual({ academicYear: "ay1", faculty: OWN, active: true });
  });
});

describe("javobda sirli maydonlar yo'q", () => {
  test("ro'yxat select: rows/foreignByCountry + verify.token + imzo izlari chiqarilgan", async () => {
    ContingentReport.paginate = jest.fn().mockResolvedValue({ docs: [] });
    await service.paginateReports(base, {});
    const opts = ContingentReport.paginate.mock.calls[0][1];
    expect(opts.select).toMatchObject({
      rows: 0,
      foreignByCountry: 0,
      __v: 0,
      "verify.token": 0,
      "approvalSteps.eriSignature": 0,
      "approvalSteps.signature": 0,
    });
  });

  test("detal proyeksiyasi ham `verify.token` va imzo izlarini bermaydi", async () => {
    const chain = { populate: () => chain, lean: () => chain, exec: async () => null };
    ContingentReport.findOne = jest.fn().mockReturnValue(chain);
    await service.findReportById("c1", { faculty: OWN });
    const [filter, projection] = ContingentReport.findOne.mock.calls[0];
    expect(filter).toEqual({ _id: "c1", active: true, faculty: OWN });
    expect(projection).toMatchObject({
      "verify.token": 0,
      "approvalSteps.eriSignature": 0,
      "approvalSteps.signature": 0,
    });
  });
});

describe("yozuv javobi va yig'ma sanasi (Nigora QA P2)", () => {
  test("toPublicDoc — `verify.token` va imzo izlari olib tashlanadi, qolgani qoladi", () => {
    const doc = {
      toObject: () => ({
        _id: "c1",
        status: "approved",
        verify: { token: "a".repeat(32), issuedAt: "x", snapshot: [{ step: "dean" }] },
        approvalSteps: [
          { step: "dean", status: "approved", signature: "sig", eriSignature: "pkcs7", eriSerial: "S1", comment: null },
        ],
      }),
    };
    const out = service.toPublicDoc(doc);
    expect(out.verify).toEqual({ issuedAt: "x", snapshot: [{ step: "dean" }] });
    expect(out.approvalSteps[0]).toEqual({ step: "dean", status: "approved", eriSerial: "S1", comment: null });
    expect(out._id).toBe("c1");
  });

  test("toPublicDoc — `verify`/`approvalSteps` bo'lmasa ham yiqilmaydi", () => {
    expect(service.toPublicDoc({ _id: "c1" })).toEqual({ _id: "c1" });
  });

  test("summaryAsOfDate — eng kech `asOfDate`; hisobot yo'q bo'lsa bugun", () => {
    const d = service.summaryAsOfDate([
      { asOfDate: "2026-09-01T00:00:00.000Z" },
      { asOfDate: "2026-09-22T00:00:00.000Z" },
      { asOfDate: null },
    ]);
    expect(d.toISOString()).toBe("2026-09-22T00:00:00.000Z");
    expect(service.summaryAsOfDate([]).getTime()).toBeGreaterThan(Date.now() - 5000);
  });
});
