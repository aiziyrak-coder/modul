const Indicator = require("./indicator.model");
const IndicatorSubmission = require("#modules/4.12-qualityAssurance/indicatorSubmission/indicatorSubmission.model");
const Controller = require("./indicator.controller");

const INDICATOR_ID = "dddddddddddddddddddddddd";

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const makeReq = () => ({ params: { id: INDICATOR_ID }, query: {}, body: {} });

afterEach(() => jest.restoreAllMocks());

describe("deleteIndicator — bog'liq yuborilmalar himoyasi", () => {
  test("yuborilma BOR → 409, indikator O'CHIRILMAYDI", async () => {
    jest.spyOn(IndicatorSubmission, "countDocuments").mockResolvedValue(12);
    const del = jest.spyOn(Indicator, "findByIdAndDelete");
    const next = jest.fn();

    await Controller.deleteIndicator(makeReq(), makeRes(), next);

    expect(del).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(409);
  });

  test("409 javobida `reason` va `submissionCount` bor (frontend toast shundan quriladi)", async () => {
    jest.spyOn(IndicatorSubmission, "countDocuments").mockResolvedValue(12);
    jest.spyOn(Indicator, "findByIdAndDelete");
    const next = jest.fn();

    await Controller.deleteIndicator(makeReq(), makeRes(), next);

    expect(next.mock.calls[0][0].meta).toEqual({
      reason: "has_submissions",
      submissionCount: 12,
    });
  });

  test("tekshiruv AYNAN shu indikator bo'yicha sanaydi", async () => {
    const count = jest
      .spyOn(IndicatorSubmission, "countDocuments")
      .mockResolvedValue(1);
    jest.spyOn(Indicator, "findByIdAndDelete");

    await Controller.deleteIndicator(makeReq(), makeRes(), jest.fn());

    expect(count).toHaveBeenCalledWith({ indicator: INDICATOR_ID });
  });

  test("yuborilma YO'Q → avvalgidek o'chadi (200)", async () => {
    jest.spyOn(IndicatorSubmission, "countDocuments").mockResolvedValue(0);
    const del = jest
      .spyOn(Indicator, "findByIdAndDelete")
      .mockResolvedValue({ _id: INDICATOR_ID });
    const res = makeRes();
    const next = jest.fn();

    await Controller.deleteIndicator(makeReq(), res, next);

    expect(del).toHaveBeenCalledWith(INDICATOR_ID);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  test("indikator topilmasa 404 (yuborilmasi yo'q holatda)", async () => {
    jest.spyOn(IndicatorSubmission, "countDocuments").mockResolvedValue(0);
    jest.spyOn(Indicator, "findByIdAndDelete").mockResolvedValue(null);
    const res = makeRes();

    await Controller.deleteIndicator(makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("sanash o'chirishdan OLDIN bajariladi", async () => {
    const order = [];
    jest.spyOn(IndicatorSubmission, "countDocuments").mockImplementation(() => {
      order.push("count");
      return Promise.resolve(0);
    });
    jest.spyOn(Indicator, "findByIdAndDelete").mockImplementation(() => {
      order.push("delete");
      return Promise.resolve({ _id: INDICATOR_ID });
    });

    await Controller.deleteIndicator(makeReq(), makeRes(), jest.fn());

    expect(order).toEqual(["count", "delete"]);
  });
});
