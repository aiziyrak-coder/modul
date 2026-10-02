"use strict";

const mockFindById = jest.fn();

jest.mock("./resident.model", () => ({
  findById: (...a) => mockFindById(...a),
}));
jest.mock("#modules/4.01-auth/user/user.model", () => ({}));
jest.mock("#modules/4.05-residency/_services/residentScope", () => ({
  ...jest.requireActual("#modules/4.05-residency/_services/residentScope"),
  guardResident: jest.fn(() => true),
}));
jest.mock("#modules/4.05-residency/_services/expulsionOrderLifecycle", () => ({
  closeDraftForDeletedResident: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.05-residency/_services/expulsionOrderGuards", () => ({
  changeStudyStatus: jest.fn(),
  closeBeforeResidentDelete: jest.fn().mockResolvedValue(undefined),
}));

const {
  guardResident,
} = require("#modules/4.05-residency/_services/residentScope");
const {
  closeDraftForDeletedResident,
} = require("#modules/4.05-residency/_services/expulsionOrderLifecycle");
const {
  closeBeforeResidentDelete,
} = require("#modules/4.05-residency/_services/expulsionOrderGuards");
const { ErrorHandler } = require("#shared/error");
const C = require("./resident.controller");

const resFor = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};
const user = { _id: "u-office", lastName: "Karimova", firstName: "Nodira" };
const makeDoc = () => ({
  _id: "r1",
  validate: jest.fn().mockResolvedValue(undefined),
  softDelete: jest.fn().mockResolvedValue(undefined),
});

beforeEach(() => jest.clearAllMocks());

describe("deleteResident — P6a loyihani yopish ulanishi", () => {
  test("soft-delete'dan KEYIN o'sha rezident va o'chirgan xodim bilan chaqiriladi", async () => {
    const doc = makeDoc();
    mockFindById.mockResolvedValue(doc);
    const res = resFor();
    await C.deleteResident({ params: { id: "r1" }, body: {}, user }, res, jest.fn());
    expect(closeDraftForDeletedResident).toHaveBeenCalledWith("r1", user);
    expect(doc.softDelete.mock.invocationCallOrder[0]).toBeLessThan(
      closeDraftForDeletedResident.mock.invocationCallOrder[0],
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("ruxsat yo'q (guard) — o'chirilmaydi va yopilmaydi", async () => {
    const doc = makeDoc();
    mockFindById.mockResolvedValue(doc);
    guardResident.mockReturnValueOnce(false);
    await C.deleteResident({ params: { id: "r1" }, body: {}, user }, resFor(), jest.fn());
    expect(doc.softDelete).not.toHaveBeenCalled();
    expect(closeDraftForDeletedResident).not.toHaveBeenCalled();
  });

  test("rezident topilmasa — 404, yopish chaqirilmaydi", async () => {
    mockFindById.mockResolvedValue(null);
    const res = resFor();
    await C.deleteResident({ params: { id: "x" }, body: {}, user }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(closeDraftForDeletedResident).not.toHaveBeenCalled();
  });
});

describe("deleteResident — V-3=A (imzo bilan bir mutex)", () => {
  test("tartib: validatsiya → loyihani yopish (CAS) → soft-delete → keyingi yopish", async () => {
    const doc = makeDoc();
    mockFindById.mockResolvedValue(doc);
    await C.deleteResident({ params: { id: "r1" }, body: {}, user }, resFor(), jest.fn());
    expect(closeBeforeResidentDelete).toHaveBeenCalledWith("r1", user);
    const order = [
      doc.validate.mock.invocationCallOrder[0],
      closeBeforeResidentDelete.mock.invocationCallOrder[0],
      doc.softDelete.mock.invocationCallOrder[0],
      closeDraftForDeletedResident.mock.invocationCallOrder[0],
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test("chetlatilgan / imzolangan — 409 o'zgarishsiz uzatiladi, o'chirilmaydi", async () => {
    const doc = makeDoc();
    mockFindById.mockResolvedValue(doc);
    const blocked = new ErrorHandler(409, "x", "resident_expelled", { reason: "resident_expelled" });
    closeBeforeResidentDelete.mockRejectedValueOnce(blocked);
    const next = jest.fn();
    await C.deleteResident({ params: { id: "r1" }, body: {}, user }, resFor(), next);
    expect(next).toHaveBeenCalledWith(blocked);
    expect(doc.softDelete).not.toHaveBeenCalled();
  });

  test("yaroqsiz hujjat — loyiha YOPILMAYDI, 400", async () => {
    const doc = makeDoc();
    doc.validate.mockRejectedValueOnce(new Error("studyPeriod: max 10"));
    mockFindById.mockResolvedValue(doc);
    const next = jest.fn();
    await C.deleteResident({ params: { id: "r1" }, body: {}, user }, resFor(), next);
    expect(closeBeforeResidentDelete).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
  });
});
