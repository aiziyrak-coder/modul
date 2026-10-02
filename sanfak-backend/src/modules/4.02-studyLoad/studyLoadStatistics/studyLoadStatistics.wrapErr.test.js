jest.mock("./studyLoadStatistics.service");

const service = require("./studyLoadStatistics.service");
const controller = require("./studyLoadStatistics.controller");

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

beforeEach(() => {
  jest.resetAllMocks();
});

describe("studyLoadStatistics.controller — wrapErr (ICHKI xato maskalash)", () => {
  test("xom TypeError → next() ErrorHandler(500) bilan chaqiriladi, `err.message` javobda YO'Q", async () => {
    service.oubOverview = jest
      .fn()
      .mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'z')"));

    const req = { scope: {}, query: {}, user: { role: { scopeLevel: "global" } } };
    const res = makeRes();
    const next = jest.fn();

    await controller.oubOverview(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Statistikani olishda xatolik");
    expect(err.message).not.toContain("Cannot read properties");
    expect(err.detail).toBeFalsy();
  });

  test("servisning o'z xatosi (statusCode bor) — TEGILMAYDI, bor holicha o'tadi", async () => {
    const serviceErr = Object.assign(new Error("Begona fakultet"), {
      statusCode: 403,
    });
    service.oubOverview = jest.fn().mockRejectedValue(serviceErr);

    const req = { scope: {}, query: {}, user: { role: { scopeLevel: "faculty" } } };
    const res = makeRes();
    const next = jest.fn();

    await controller.oubOverview(req, res, next);

    expect(next).toHaveBeenCalledWith(serviceErr);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });
});
