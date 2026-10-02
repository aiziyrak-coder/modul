"use strict";

jest.mock("./workload.model");

const WorkloadModel = require("./workload.model");
const {
  OPEN_STATUSES,
  planNextVersion,
  prepareNewVersion,
  higherVersionError,
  supersedePreviousWorkloads,
  duplicateVersionError,
} = require("./workload.versioning");

const DEPT = "bbbbbbbbbbbbbbbbbbbbbbbb";
const AY = "aaaaaaaaaaaaaaaaaaaaaaaa";

beforeEach(() => jest.clearAllMocks());

describe("planNextVersion — sof reja", () => {
  test("hujjat yo'q → 1-versiya, previousVersion null", () => {
    expect(planNextVersion([])).toEqual({ open: null, version: 1, previousVersion: null });
  });

  test("approved v1 → v2, previousVersion = o'sha approved", () => {
    const plan = planNextVersion([{ _id: "v1", status: "approved", version: 1 }]);
    expect(plan).toEqual({ open: null, version: 2, previousVersion: "v1" });
  });

  test("versiya maydoni YO'Q eski hujjat = 1; max + 1 superseded'ni ham hisobga oladi", () => {
    const plan = planNextVersion([
      { _id: "old", status: "superseded" },
      { _id: "v2", status: "approved", version: 2 },
    ]);
    expect(plan.version).toBe(3);
    expect(plan.previousVersion).toBe("v2");
  });

  test.each(OPEN_STATUSES)("ochiq holat «%s» → open qaytadi", (status) => {
    const plan = planNextVersion([{ _id: "x", status, version: 2 }]);
    expect(plan.open).toMatchObject({ _id: "x", status });
  });

  test("faqat superseded (joriy approved yo'q) → previousVersion null", () => {
    const plan = planNextVersion([{ _id: "s", status: "superseded", version: 1 }]);
    expect(plan).toEqual({ open: null, version: 2, previousVersion: null });
  });
});

describe("prepareNewVersion — ochiq versiya darvozasi", () => {
  test("ochiq (draft) bor → 409, reason open_version_exists", async () => {
    WorkloadModel.find = jest.fn().mockResolvedValue([{ _id: "d1", status: "draft", version: 2 }]);
    const r = await prepareNewVersion({ department: DEPT, academicYear: AY });
    expect(r.error.statusCode).toBe(409);
    expect(r.error.message).toMatch(/bitta ochiq versiya/);
    expect(r.error.meta).toMatchObject({ reason: "open_version_exists", openWorkloadId: "d1" });
  });

  test("so'rov FAQAT shu kafedra+yil bo'yicha", async () => {
    WorkloadModel.find = jest.fn().mockResolvedValue([]);
    await prepareNewVersion({ department: DEPT, academicYear: AY });
    expect(WorkloadModel.find.mock.calls[0][0]).toEqual({
      department: DEPT,
      academicYear: AY,
      active: { $ne: false },
    });
  });

  test("ochiq yo'q, approved v1 → version 2, previousVersion v1", async () => {
    WorkloadModel.find = jest.fn().mockResolvedValue([
      { _id: "v1", status: "approved", version: 1 },
    ]);
    const r = await prepareNewVersion({ department: DEPT, academicYear: AY });
    expect(r).toEqual({ version: 2, previousVersion: "v1" });
  });
});

describe("higherVersionError — kattaroq versiya himoyasi", () => {
  test("kattaroq versiyali approved bor → 409 newer_version_approved", async () => {
    WorkloadModel.exists = jest.fn().mockResolvedValue({ _id: "v3" });
    const err = await higherVersionError({ _id: "v1", department: DEPT, academicYear: AY, version: 1 });
    expect(err.statusCode).toBe(409);
    expect(err.meta).toEqual({ reason: "newer_version_approved" });
    expect(WorkloadModel.exists).toHaveBeenCalledWith({
      _id: { $ne: "v1" },
      department: DEPT,
      academicYear: AY,
      status: "approved",
      version: { $gt: 1 },
    });
  });

  test("yo'q → null (versiyasiz eski hujjat = 1)", async () => {
    WorkloadModel.exists = jest.fn().mockResolvedValue(null);
    expect(await higherVersionError({ _id: "v1", department: DEPT, academicYear: AY })).toBeNull();
    expect(WorkloadModel.exists.mock.calls[0][0].version).toEqual({ $gt: 1 });
  });
});

describe("supersedePreviousWorkloads — faqat shu kafedra+yil", () => {
  test("filtr: boshqa id, shu kafedra+yil, faqat approved; $set superseded + supersededBy/At", async () => {
    WorkloadModel.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });
    const n = await supersedePreviousWorkloads({ _id: "v2", department: DEPT, academicYear: AY, version: 2 });
    expect(n).toBe(2);
    const [filter, update] = WorkloadModel.updateMany.mock.calls[0];
    expect(filter).toEqual({
      _id: { $ne: "v2" },
      department: DEPT,
      academicYear: AY,
      status: "approved",
      $or: [{ version: { $lt: 2 } }, { version: { $exists: false } }],
    });
    expect(update.$set).toMatchObject({ status: "superseded", supersededBy: "v2" });
    expect(update.$set.supersededAt).toBeInstanceOf(Date);
  });

  test("idempotent — ikkinchi chaqiruvda 0 (filtr `approved`)", async () => {
    WorkloadModel.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });
    expect(await supersedePreviousWorkloads({ _id: "v2", department: DEPT, academicYear: AY })).toBe(0);
  });
});

describe("duplicateVersionError — yaratish poygasi (review)", () => {
  test("E11000 + version kaliti → 409 open_version_exists", () => {
    const err = duplicateVersionError({ code: 11000, keyPattern: { department: 1, academicYear: 1, version: 1 } });
    expect(err.statusCode).toBe(409);
    expect(err.meta).toEqual({ reason: "open_version_exists" });
  });
  test("boshqa unique indeks (verify.token) yoki boshqa xato → null", () => {
    expect(duplicateVersionError({ code: 11000, keyPattern: { "verify.token": 1 } })).toBeNull();
    expect(duplicateVersionError(new Error("boom"))).toBeNull();
    expect(duplicateVersionError(undefined)).toBeNull();
  });
});

describe("uniq_version_per_department_year indeksi (review)", () => {
  const { schema } = jest.requireActual("./workload.model");
  const idx = schema.indexes().find(([, o]) => o.name === "uniq_version_per_department_year");

  test("kafedra+yil+version unique; faqat version ≥ 2 va active: true", () => {
    expect(idx).toBeDefined();
    expect(idx[0]).toEqual({ department: 1, academicYear: 1, version: 1 });
    expect(idx[1]).toMatchObject({ unique: true, partialFilterExpression: { version: { $gte: 2 }, active: true } });
  });

  test("versiyasiz eski hujjat Mongoose default 1 bilan saqlanadi — indeksga TUSHMAYDI", () => {
    expect(idx[1].partialFilterExpression.version.$gte).toBeGreaterThan(schema.path("version").defaultValue);
  });
});
