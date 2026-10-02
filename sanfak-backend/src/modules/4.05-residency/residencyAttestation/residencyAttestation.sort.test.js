"use strict";

const mockFind = jest.fn();

jest.mock("./residencyAttestationResult.model", () => ({
  find: (...a) => mockFind(...a),
}));
jest.mock("./residencyAttestation.model", () => ({ find: jest.fn() }));
jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

const C = require("./residencyAttestation.controller");

const resFor = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};
const req = { params: { id: "att1" } };

const givenResults = (docs) => {
  const chain = { populate: jest.fn().mockResolvedValue(docs) };
  mockFind.mockReturnValue(chain);
  return chain;
};

const namesFrom = (res) =>
  res.json.mock.calls[0][0].map((d) => d.resident?.fullName || d.residentName);

beforeEach(() => jest.clearAllMocks());

describe("listResults — saralash manbai", () => {
  it("DB darajasida `residentName` bo'yicha SARALAMAYDI", async () => {
    const chain = givenResults([]);
    await C.listResults(req, resFor(), jest.fn());
    expect(chain.sort).toBeUndefined();
  });

  it("ismi tuzatilgan talaba YANGI harf ostida turadi", async () => {
    givenResults([
      { residentName: "Yoqubov Aziz", resident: { fullName: "Yoqubov Aziz" } },
      { residentName: "Zokirov Bobur", resident: { fullName: "Aliyev Bobur" } },
    ]);
    const res = resFor();
    await C.listResults(req, res, jest.fn());
    expect(namesFrom(res)).toEqual(["Aliyev Bobur", "Yoqubov Aziz"]);
  });

  it("rezident yozuvi yo'q bo'lsa — snapshot zaxira sifatida ishlaydi", async () => {
    givenResults([
      { residentName: "Zokirov Bobur", resident: null },
      { residentName: "Aliyev Sardor", resident: { fullName: "Aliyev Sardor" } },
    ]);
    const res = resFor();
    await C.listResults(req, res, jest.fn());
    expect(namesFrom(res)).toEqual(["Aliyev Sardor", "Zokirov Bobur"]);
  });

  it("ikkala ism ham bo'lmasa yiqilmaydi (bo'sh satr oxirida emas, boshida)", async () => {
    givenResults([
      { residentName: null, resident: null },
      { residentName: "Aliyev Sardor", resident: null },
    ]);
    const res = resFor();
    await C.listResults(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toHaveLength(2);
  });
});
