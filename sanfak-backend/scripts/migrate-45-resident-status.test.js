"use strict";

const mockCollection = {
  countDocuments: jest.fn(),
  find: jest.fn(),
  updateMany: jest.fn(),
};

jest.mock("mongoose", () => ({
  connection: { db: { collection: jest.fn(() => mockCollection) } },
  Types: { ObjectId: jest.fn((id) => ({ _id: id, toString: () => id })) },
  connect: jest.fn(),
  disconnect: jest.fn(),
}));

const fs = require("fs");
const mongoose = require("mongoose");
const {
  survey,
  backfill,
  revert,
  TARGET_STATUS,
  COLLECTION,
} = require("./migrate-45-resident-status");

const armFind = (ids) => {
  mockCollection.find.mockReturnValue({
    toArray: jest.fn().mockResolvedValue(ids.map((id) => ({ _id: id }))),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCollection.countDocuments.mockResolvedValue(0);
  mockCollection.updateMany.mockResolvedValue({ modifiedCount: 0 });
  armFind([]);
});

describe("konstantalar", () => {
  test("kolleksiya va maqsad qiymati", () => {
    expect(COLLECTION).toBe("residents");
    expect(TARGET_STATUS).toBe("oquvda");
  });
});

describe("survey — holat surati", () => {
  test("native kolleksiyadan o'qiydi (plaginlar chetlab o'tiladi)", async () => {
    await survey();
    expect(mongoose.connection.db.collection).toHaveBeenCalledWith("residents");
  });

  test("soft-delete qilinganlarni ham SANAYDI", async () => {
    await survey();
    const filters = mockCollection.countDocuments.mock.calls.map((c) => c[0]);
    expect(filters).toEqual(
      expect.arrayContaining([
        { deletedAt: { $ne: null } },
        { deletedAt: { $ne: null }, status: { $exists: false } },
      ]),
    );
  });

  test("meros `active:false` yozuvlarni ikki savatga ajratadi", async () => {
    await survey();
    const filters = mockCollection.countDocuments.mock.calls.map((c) => c[0]);
    expect(filters).toEqual(
      expect.arrayContaining([
        { active: false, expulsionOrderCreated: true },
        { active: false, expulsionOrderCreated: { $ne: true } },
      ]),
    );
  });
});

describe("backfill — dry-run (DEFAULT)", () => {
  test("HECH NARSA yozmaydi", async () => {
    armFind(["a", "b"]);
    const r = await backfill({});
    expect(mockCollection.updateMany).not.toHaveBeenCalled();
    expect(r.modified).toBe(0);
    expect(r.backup).toBeNull();
    expect(r.ids).toEqual(["a", "b"]);
  });
});

describe("backfill — --apply", () => {
  test("FAQAT `status` maydoni YO'Q hujjatlarga yozadi (idempotent)", async () => {
    armFind(["a"]);
    jest.spyOn(fs, "mkdirSync").mockImplementation(() => {});
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    mockCollection.updateMany.mockResolvedValue({ modifiedCount: 1 });

    const r = await backfill({ apply: true, dbName: "demo" });

    expect(mockCollection.updateMany).toHaveBeenCalledWith(
      { status: { $exists: false } },
      { $set: { status: "oquvda" } },
    );
    expect(r.modified).toBe(1);
  });

  test("`active` ga va mavjud `status` ga TEGMAYDI", async () => {
    armFind(["a"]);
    jest.spyOn(fs, "mkdirSync").mockImplementation(() => {});
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    await backfill({ apply: true });

    const [filter, update] = mockCollection.updateMany.mock.calls[0];
    expect(Object.keys(update)).toEqual(["$set"]);
    expect(Object.keys(update.$set)).toEqual(["status"]);
    expect(filter).toEqual({ status: { $exists: false } });
    expect(JSON.stringify({ filter, update })).not.toContain("active");
  });

  test("zaxira yoziladi va tegilgan id'lar saqlanadi", async () => {
    armFind(["id1", "id2"]);
    jest.spyOn(fs, "mkdirSync").mockImplementation(() => {});
    const write = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    const r = await backfill({ apply: true, dbName: "demo" });

    expect(r.backup).toContain("resident-status-demo-");
    const payload = JSON.parse(write.mock.calls[0][1]);
    expect(payload).toEqual({
      collection: "residents",
      field: "status",
      ids: ["id1", "id2"],
    });
  });

  test("to'ldiriladigan hujjat yo'q — zaxira ham yozilmaydi", async () => {
    armFind([]);
    const write = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    const r = await backfill({ apply: true });
    expect(r.backup).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });
});

describe("revert — qaytarish", () => {
  test("zaxiradagi id'larda `status` ni O'CHIRADI", async () => {
    jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue(JSON.stringify({ ids: ["id1", "id2"] }));
    mockCollection.updateMany.mockResolvedValue({ modifiedCount: 2 });

    const r = await revert({ file: "zaxira.json" });

    expect(mockCollection.updateMany).toHaveBeenCalledWith(
      { _id: { $in: expect.any(Array) } },
      { $unset: { status: "" } },
    );
    expect(r).toEqual({ ids: 2, changed: 2 });
  });

  test("bo'sh zaxira — so'rov qilinmaydi", async () => {
    jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({ ids: [] }));
    const r = await revert({ file: "zaxira.json" });
    expect(mockCollection.updateMany).not.toHaveBeenCalled();
    expect(r).toEqual({ ids: 0, changed: 0 });
  });
});
