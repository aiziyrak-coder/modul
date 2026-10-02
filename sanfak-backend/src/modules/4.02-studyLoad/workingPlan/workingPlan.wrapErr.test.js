jest.mock("./workingPlan.service");

const service = require("./workingPlan.service");
const controller = require("./workingPlan.controller");

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

beforeEach(() => {
  jest.resetAllMocks();
});

describe("workingPlan.controller — wrapErr (ICHKI xato maskalash)", () => {
  test("xom TypeError → next() ErrorHandler(500) bilan chaqiriladi, `err.message` javobda YO'Q", async () => {
    service.getElectiveRowUsage = jest
      .fn()
      .mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'x')"));

    const req = { params: { id: "plan-1" }, query: {}, scope: {} };
    const res = makeRes();
    const next = jest.fn();

    await controller.getElectiveUsage(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Fan bog'liqliklarini sanashda xatolik");
    expect(err.message).not.toContain("Cannot read properties");
    expect(err.detail).toBeFalsy();
  });

  test("servisning o'z xatosi (statusCode bor) — TEGILMAYDI, bor holicha o'tadi", async () => {
    const serviceErr = Object.assign(new Error("Ishchi reja topilmadi"), {
      statusCode: 404,
    });
    service.getElectiveRowUsage = jest.fn().mockRejectedValue(serviceErr);

    const req = { params: { id: "plan-1" }, query: {}, scope: {} };
    const res = makeRes();
    const next = jest.fn();

    await controller.getElectiveUsage(req, res, next);

    expect(next).toHaveBeenCalledWith(serviceErr);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(404);
  });
});
