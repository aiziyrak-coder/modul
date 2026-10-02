jest.mock("./votingSession.service");
jest.mock("#modules/4.09-instituteCouncil/_shared/councilNotify");

const service = require("./votingSession.service");
const {
  dispatchManyInBackground,
  getKotibUserIds,
  getMemberUserIds,
} = require("#modules/4.09-instituteCouncil/_shared/councilNotify");
const Controller = require("./votingSession.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("votingSession.controller.finalize — N-07 ikkita havola", () => {
  test("kotibga /kengash/hisobotlar, oddiy a'zolarga /kengash/ovoz-berish; dublikat yo'q", async () => {
    service.finalize = jest.fn().mockResolvedValue({
      _id: "session1",
      title: "Dissertatsiya himoyasi",
      status: "approved",
    });
    getKotibUserIds.mockResolvedValue(["kotib1"]);
    getMemberUserIds.mockResolvedValue(["kotib1", "azo1", "azo2"]);

    const res = createRes();
    const next = jest.fn();
    await Controller.finalize({ params: { id: "session1" } }, res, next);

    expect(dispatchManyInBackground).toHaveBeenCalledTimes(2);
    const calls = dispatchManyInBackground.mock.calls.map((c) => c[0]);

    const kotibCall = calls.find((c) => c.link === "/kengash/hisobotlar");
    expect(kotibCall.userIds).toEqual(["kotib1"]);
    expect(kotibCall.eventType).toBe("council_voting_finished");

    const memberCall = calls.find((c) => c.link === "/kengash/ovoz-berish");
    expect(memberCall.userIds).toEqual(["azo1", "azo2"]);
    expect(memberCall.userIds).not.toContain("kotib1");

    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  test("topilmasa — 404, bildirishnoma yuborilmaydi", async () => {
    service.finalize = jest.fn().mockResolvedValue(null);
    const res = createRes();
    await Controller.finalize({ params: { id: "x" } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(dispatchManyInBackground).not.toHaveBeenCalled();
  });
});
