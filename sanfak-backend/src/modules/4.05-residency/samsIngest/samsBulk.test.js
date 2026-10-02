"use strict";

const { upsertNewer, makeEnsureIndexes, toOp, CHUNK_SIZE } = require("./samsBulk");

const T = new Date("2026-09-27T05:00:00Z");
const row = (i) => ({ resident: `r${i}`, day: "2026-09-27", measured: true, packetAt: T });
const KEY = ["resident", "day"];

function bulkError(entries, extra = {}) {
  const err = new Error("bulk");
  Object.defineProperty(err, "name", { value: "MongoBulkWriteError" });
  err.writeErrors = entries.map(([index, code]) => ({
    err: { index, code },
    get index() { return this.err.index; },
    get code() { return this.err.code; },
  }));
  return Object.assign(err, extra);
}
const fakeModel = (...outcomes) => ({
  bulkWrite: jest.fn(async () => {
    const next = outcomes.shift();
    if (next instanceof Error) throw next;
    return {};
  }),
});
const sentFilters = (M, call) => M.bulkWrite.mock.calls[call][0].map((op) => op.updateOne.filter.resident);

describe("amal shakli", () => {
  it("filtr — kalit + packetAt $lte, $set kalitsiz, upsert", () => {
    expect(toOp(row(1), KEY)).toEqual({
      updateOne: {
        filter: { resident: "r1", day: "2026-09-27", packetAt: { $lte: T } },
        update: { $set: { measured: true, packetAt: T } },
        upsert: true,
      },
    });
  });

  it("bulkWrite — ordered:false, throwOnValidationError:true; bo'sh ro'yxat — chaqiruvsiz", async () => {
    const M = fakeModel(undefined);
    expect(await upsertNewer(M, [row(1)], KEY)).toEqual({ rows: 1, stale: 0 });
    expect(M.bulkWrite.mock.calls[0][1]).toEqual({ ordered: false, throwOnValidationError: true });
    const empty = fakeModel();
    expect(await upsertNewer(empty, [], KEY)).toEqual({ rows: 0, stale: 0 });
    expect(empty.bulkWrite).not.toHaveBeenCalled();
  });
});

describe("E11000 — bitta qayta urinish", () => {
  it("1-raund E11000, 2-raund muvaffaqiyat → stale 0, faqat o'sha amal qayta yuboriladi", async () => {
    const M = fakeModel(bulkError([[1, 11000]]), undefined);
    const res = await upsertNewer(M, [row(0), row(1), row(2)], KEY);
    expect(res).toEqual({ rows: 3, stale: 0 });
    expect(sentFilters(M, 1)).toEqual(["r1"]);
  });

  it("ikkala raundda E11000 → stale 1 (uchinchi urinish yo'q)", async () => {
    const M = fakeModel(bulkError([[1, 11000]]), bulkError([[0, 11000]]));
    expect(await upsertNewer(M, [row(0), row(1)], KEY)).toEqual({ rows: 2, stale: 1 });
    expect(M.bulkWrite).toHaveBeenCalledTimes(2);
  });

  it("writeErrors massiv emas, bitta obyekt bo'lsa ham ishlaydi", async () => {
    const err = bulkError([[0, 11000]]);
    err.writeErrors = err.writeErrors[0];
    const M = fakeModel(err, err);
    expect(await upsertNewer(M, [row(0)], KEY)).toEqual({ rows: 1, stale: 1 });
  });
});

describe("boshqa xatolar QAYTA TASHLANADI (jimgina «eskirgan» emas)", () => {
  it.each([
    ["kod 121 (validatsiya)", bulkError([[0, 121]])],
    ["aralash 11000 + 121", bulkError([[0, 11000], [1, 121]])],
    ["mongoose cast xatosi bilan", bulkError([[0, 11000]], { mongoose: { validationErrors: [new Error("cast")] } })],
    ["indekssiz yozuv", bulkError([[undefined, 11000]])],
    ["tarmoq xatosi", new Error("ECONNRESET")],
  ])("%s", async (_l, err) => {
    const M = fakeModel(err);
    await expect(upsertNewer(M, [row(0), row(1)], KEY)).rejects.toBe(err);
  });
});

describe("bo'laklar", () => {
  it(`${CHUNK_SIZE} + 1 qator: ikki bo'lak, indekslar to'g'ri amalga bog'lanadi`, async () => {
    const rows = Array.from({ length: CHUNK_SIZE + 1 }, (_v, i) => row(i));
    const M = fakeModel(undefined, bulkError([[0, 11000]]), undefined);
    expect(await upsertNewer(M, rows, KEY)).toEqual({ rows: CHUNK_SIZE + 1, stale: 0 });
    expect(M.bulkWrite.mock.calls[0][0]).toHaveLength(CHUNK_SIZE);
    expect(sentFilters(M, 1)).toEqual([`r${CHUNK_SIZE}`]);
    expect(sentFilters(M, 2)).toEqual([`r${CHUNK_SIZE}`]);
  });
});

describe("makeEnsureIndexes", () => {
  it("muvaffaqiyat eslab qolinadi", async () => {
    const A = { createIndexes: jest.fn(async () => {}) };
    const B = { createIndexes: jest.fn(async () => {}) };
    const ensure = makeEnsureIndexes([A, B]);
    await ensure();
    await ensure();
    expect(A.createIndexes).toHaveBeenCalledTimes(1);
    expect(B.createIndexes).toHaveBeenCalledTimes(1);
  });

  it("rad etish eslab QOLINMAYDI — keyingi chaqiruv qayta uradi", async () => {
    const A = { createIndexes: jest.fn().mockRejectedValueOnce(new Error("dup")).mockResolvedValue() };
    const ensure = makeEnsureIndexes([A]);
    await expect(ensure()).rejects.toThrow("dup");
    await expect(ensure()).resolves.toBeDefined();
    expect(A.createIndexes).toHaveBeenCalledTimes(2);
  });
});
