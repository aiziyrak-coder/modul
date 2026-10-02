"use strict";

jest.mock("./contingentReport.model");
jest.mock("./contingentReport.prefill", () => ({
  PREFILL_CELLS: ["total", "groupCount", "streamCount"],
  buildPrefillRows: jest.fn(),
  mergePrefill: jest.fn(),
  rowKey: (r) => `${r.direction}|${r.course}`,
}));
jest.mock("#references/direction/direction.model", () => ({ find: jest.fn() }));
jest.mock("#references/faculty/faculty.model", () => ({ find: jest.fn() }));

const DirectionModel = require("#references/direction/direction.model");
const service = require("./contingentReport.service");

const D1 = "6f0000000000000000000001";
const D2 = "6f0000000000000000000002";
const FAC = "6f00000000000000000000f1";

const wireDirections = (docs) => {
  DirectionModel.find.mockReturnValue({
    select: () => ({ lean: async () => docs }),
  });
};

const makeDoc = (rows = []) => ({ faculty: FAC, status: "draft", rows, foreignByCountry: [] });

beforeEach(() => jest.clearAllMocks());

describe("resolveSource — mijoz `source` yubormaydi, servis solishtiradi", () => {
  test("groups katak qiymati o'zgarmagan → groups; o'zgargan → manual; yangi qator → manual", () => {
    const old = { total: 61, groupCount: 3, streamCount: 2, source: { total: "groups", groupCount: "groups", streamCount: "manual" } };
    expect(service.resolveSource(old, { total: 61, groupCount: 4, streamCount: 2 })).toEqual({
      total: "groups",
      groupCount: "manual",
      streamCount: "manual",
    });
    expect(service.resolveSource(undefined, { total: 61, groupCount: 3, streamCount: 2 })).toEqual({
      total: "manual",
      groupCount: "manual",
      streamCount: "manual",
    });
  });
});

describe("applyContent", () => {
  test("yo'nalish boshqa fakultetniki → 400", async () => {
    wireDirections([{ _id: D1, title: "Pediatriya ishi", faculty: "6f00000000000000000000f2" }]);
    await expect(
      service.applyContent(makeDoc(), { rows: [{ direction: D1, course: 1, total: 0 }], foreignByCountry: [] }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("yo'nalish topilmadi → 400", async () => {
    wireDirections([]);
    await expect(
      service.applyContent(makeDoc(), { rows: [{ direction: D1, course: 1 }], foreignByCountry: [] }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("surat matnlari MA'LUMOTNOMADAN qayta yoziladi, mijoz `source`i e'tiborga olinmaydi", async () => {
    wireDirections([{ _id: D1, title: "Davolash ishi", directionCode: "60910200", faculty: FAC }]);
    const doc = makeDoc([
      { direction: D1, course: 1, category: "milliy", total: 61, groupCount: 3, streamCount: 2, source: { total: "groups", groupCount: "groups", streamCount: "groups" } },
    ]);
    await service.applyContent(doc, {
      asOfDate: new Date("2026-09-22"),
      rows: [
        {
          direction: D1,
          directionTitle: "SOXTA NOM",
          directionCode: "000",
          category: "milliy",
          course: 1,
          total: 61,
          boys: 30,
          girls: 31,
          groupCount: 3,
          streamCount: 3,
          source: { total: "manual", groupCount: "manual", streamCount: "groups" },
        },
        { direction: D1, category: "mdh", course: 1, total: 5, boys: 5, girls: 0 },
      ],
      foreignByCountry: [{ country: " Hindiston ", total: 5, boys: 3, girls: 2 }],
    });
    expect(doc.rows[0]).toMatchObject({ directionTitle: "Davolash ishi", directionCode: "60910200", boys: 30 });
    expect(doc.rows[0].source).toEqual({ total: "groups", groupCount: "groups", streamCount: "manual" });
    expect(doc.rows[1].source).toEqual({ total: "manual", groupCount: "manual", streamCount: "manual" });
    expect(doc.foreignByCountry[0].country).toBe("Hindiston");
    expect(doc.asOfDate).toEqual(new Date("2026-09-22"));
    expect(DirectionModel.find).toHaveBeenCalledTimes(1);
    expect(DirectionModel.find.mock.calls[0][0]._id.$in).toEqual([D1]);
  });
});

describe("applyContent — chekka holatlar", () => {
  test("qatorlar bo'sh — yo'nalish so'rovi YO'Q, jadval bo'shatiladi", async () => {
    const doc = makeDoc([{ direction: D2, course: 1, total: 1 }]);
    await service.applyContent(doc, { rows: [], foreignByCountry: [] });
    expect(DirectionModel.find).not.toHaveBeenCalled();
    expect(doc.rows).toEqual([]);
  });

  test("in_review hujjat → 409, ma'lumotnoma so'ralmaydi", async () => {
    const doc = { ...makeDoc(), status: "in_review" };
    await expect(service.applyContent(doc, { rows: [], foreignByCountry: [] })).rejects.toMatchObject({ statusCode: 409 });
    expect(DirectionModel.find).not.toHaveBeenCalled();
  });
});
