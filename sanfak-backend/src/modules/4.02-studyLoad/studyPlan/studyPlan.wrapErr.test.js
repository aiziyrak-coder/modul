jest.mock("./studyPlan.service");

const service = require("./studyPlan.service");
const controller = require("./studyPlan.controller");

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

beforeEach(() => {
  jest.resetAllMocks();
});

describe("studyPlan.controller — wrapErr (ICHKI xato maskalash)", () => {
  test("xom TypeError → next() ErrorHandler(500) bilan chaqiriladi, `err.message` javobda YO'Q", async () => {
    service.addElectiveRow = jest
      .fn()
      .mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'y')"));

    const req = { params: { id: "sp-1" }, body: {}, scope: {} };
    const res = makeRes();
    const next = jest.fn();

    await controller.addElectiveRow(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Tanlov fani qatorini qo'shishda xatolik");
    expect(err.message).not.toContain("Cannot read properties");
    expect(err.detail).toBeFalsy();
  });

  test("servisning o'z xatosi (statusCode bor) — TEGILMAYDI, bor holicha o'tadi", async () => {
    const serviceErr = Object.assign(new Error("O'quv reja topilmadi"), {
      statusCode: 404,
    });
    service.addElectiveRow = jest.fn().mockRejectedValue(serviceErr);

    const req = { params: { id: "sp-1" }, body: {}, scope: {} };
    const res = makeRes();
    const next = jest.fn();

    await controller.addElectiveRow(req, res, next);

    expect(next).toHaveBeenCalledWith(serviceErr);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(404);
  });
});
