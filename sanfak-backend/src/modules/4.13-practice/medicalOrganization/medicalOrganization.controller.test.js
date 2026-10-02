"use strict";

jest.mock("../../../shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(statusCode, message, detail) {
      super(message);
      this.statusCode = statusCode;
      this.detail = detail;
    }
  },
}), { virtual: true });

jest.mock("./medicalOrganization.service", () => ({
  pick: (b) => b,
  create: jest.fn(),
  update: jest.fn(),
}));

const service = require("./medicalOrganization.service");
const controller = require("./medicalOrganization.controller");

const dupErr = () => Object.assign(new Error("E11000 duplicate key"), { code: 11000 });

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("medicalOrganization.controller — STIR dublikati", () => {
  beforeEach(() => jest.clearAllMocks());

  test("CREATE: dublikatda next() BIR MARTA va 409 bilan chaqiriladi", async () => {
    service.create.mockRejectedValue(dupErr());
    const next = jest.fn();
    const res = mockRes();

    await controller.addOrganization({ body: {}, user: { _id: "u1" } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(409);
    expect(res.json).not.toHaveBeenCalled();
  });

  test("UPDATE: dublikatda next() BIR MARTA va 409 bilan chaqiriladi", async () => {
    service.update.mockRejectedValue(dupErr());
    const next = jest.fn();
    const res = mockRes();

    await controller.updateOrganization({ body: {}, params: { id: "x" } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(409);
  });

  test("CREATE: dublikat BO'LMAGAN xatoda ham next() bir marta, 400 bilan", async () => {
    service.create.mockRejectedValue(new Error("boshqa xato"));
    const next = jest.fn();

    await controller.addOrganization({ body: {}, user: { _id: "u1" } }, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });
});
