"use strict";

const mockBuildScope = jest.fn();

jest.mock("#modules/4.05-residency/_services/residentScope", () => ({
  buildResidentScope: (...a) => mockBuildScope(...a),
}));

const mockSave = jest.fn();
const mockCreate = jest.fn();
const mockFindByIdAndUpdate = jest.fn();
const mockFindById = jest.fn();

function MockAssessment(doc) {
  Object.assign(this, doc);
  this.save = mockSave;
}
MockAssessment.create = (...a) => mockCreate(...a);
MockAssessment.findByIdAndUpdate = (...a) => mockFindByIdAndUpdate(...a);
MockAssessment.findById = (...a) => mockFindById(...a);
MockAssessment.find = jest.fn();
MockAssessment.paginate = jest.fn();

jest.mock("#modules/4.05-residency/assessment/assessment.model", () => MockAssessment);
jest.mock("#modules/4.05-residency/_services/attestationCheck", () => ({
  checkAttestationEligibility: jest.fn(),
}));

const C = require("./assessment.controller");

const MINE = "6a5a0acbd34b3c21a575d5fb";
const NOT_MINE = "6a5a0acbd34b3c21a575d5fe";

const resFor = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};
const req = (body = {}, params = {}, query = {}) => ({
  body,
  params,
  query,
  user: { _id: "u1" },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockBuildScope.mockImplementation(async (_u, wanted) => ({
    denied: String(wanted) === NOT_MINE,
    filter: {},
  }));
  mockSave.mockResolvedValue({ _id: "a1" });
  mockCreate.mockResolvedValue({ _id: "a1" });
  mockFindByIdAndUpdate.mockResolvedValue({ _id: "a1" });
});

describe("gradeAssessment", () => {
  it("O'Z rezidentiga ball qo'yadi", async () => {
    const res = resFor();
    await C.gradeAssessment(req({ resident: MINE, type: "oraliq", score: 90 }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("BEGONA rezidentga ball qo'ya OLMAYDI (403, yozilmaydi)", async () => {
    const res = resFor();
    await C.gradeAssessment(
      req({ resident: NOT_MINE, type: "oraliq", score: 90 }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rezidentsiz so'rov 400 (doira so'ralmaydi)", async () => {
    const res = resFor();
    await C.gradeAssessment(req({ type: "oraliq", score: 90 }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockBuildScope).not.toHaveBeenCalled();
  });
});

describe("addAssessment", () => {
  it("begona rezidentga yozib bo'lmaydi", async () => {
    const res = resFor();
    await C.addAssessment(req({ resident: NOT_MINE, type: "amaliy", score: 50 }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe("updateAssessment", () => {
  const lean = (v) => ({ select: () => ({ lean: () => Promise.resolve(v) }) });

  it("egalik MAVJUD yozuvning rezidenti bo'yicha tekshiriladi", async () => {
    mockFindById.mockReturnValue(lean({ _id: "a1", resident: NOT_MINE }));
    const res = resFor();

    await C.updateAssessment(req({ score: 100 }, { id: "a1" }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("begona bahoni O'Z rezidentiga ko'chirib bo'lmaydi", async () => {
    mockFindById.mockReturnValue(lean({ _id: "a1", resident: NOT_MINE }));
    const res = resFor();

    await C.updateAssessment(req({ resident: MINE }, { id: "a1" }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("o'z bahosini BEGONA rezidentga ko'chirib bo'lmaydi", async () => {
    mockFindById.mockReturnValue(lean({ _id: "a1", resident: MINE }));
    const res = resFor();

    await C.updateAssessment(req({ resident: NOT_MINE }, { id: "a1" }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("o'z bahosini tahrirlaydi", async () => {
    mockFindById.mockReturnValue(lean({ _id: "a1", resident: MINE }));
    const res = resFor();

    await C.updateAssessment(req({ score: 95 }, { id: "a1" }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("yozuv yo'q -> 404, doira so'ralmaydi", async () => {
    mockFindById.mockReturnValue(lean(null));
    const res = resFor();

    await C.updateAssessment(req({ score: 95 }, { id: "yo'q" }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockBuildScope).not.toHaveBeenCalled();
  });
});

describe("attestationEligibility", () => {
  const { checkAttestationEligibility: mockEligibility } = jest.requireMock(
    "#modules/4.05-residency/_services/attestationCheck",
  );
  const FROM = new Date("2026-09-01T00:00:00Z");
  const TO = new Date("2026-12-31T00:00:00Z");

  it("servisni aynan {science, fromDate, toDate} bilan chaqiradi (`now` yo'q)", async () => {
    mockEligibility.mockResolvedValue({ eligible: true });
    const res = resFor();
    const query = { science: "s1", fromDate: FROM, toDate: TO, now: "2020-01-01" };

    await C.attestationEligibility(req({}, { residentId: MINE }, query), res, jest.fn());

    expect(mockEligibility).toHaveBeenCalledTimes(1);
    const [id, opts] = mockEligibility.mock.calls[0];
    expect(id).toBe(MINE);
    expect(Object.keys(opts).sort()).toEqual(["fromDate", "science", "toDate"]);
    expect(opts).toEqual({ science: "s1", fromDate: FROM, toDate: TO });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("begona rezident -> 403, servis chaqirilmaydi", async () => {
    const res = resFor();
    const next = jest.fn();

    await C.attestationEligibility(req({}, { residentId: NOT_MINE }), res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(mockEligibility).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("deleteAssessment", () => {
  it("begona bahoni o'chirib bo'lmaydi", async () => {
    const softDelete = jest.fn();
    mockFindById.mockResolvedValue({ _id: "a1", resident: NOT_MINE, softDelete });
    const res = resFor();

    await C.deleteAssessment(req({}, { id: "a1" }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(softDelete).not.toHaveBeenCalled();
  });
});
