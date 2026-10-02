"use strict";

jest.mock("./scienceProgram.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.02-studyLoad/_verify/documentVerify.service");

const ScienceProgramModel = require("./scienceProgram.model");
ScienceProgramModel.CHAINS = jest.requireActual("./scienceProgram.model").CHAINS;
ScienceProgramModel.buildChainSteps = jest.requireActual("./scienceProgram.model").buildChainSteps;
const Controller = require("./scienceProgram.controller");
const { ROLES } = require("#config/constants");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeDoc = (pendingStep) => {
  const order = ["teacher", "kafedra", "arm", "methodical", "dean"];
  const idx = order.indexOf(pendingStep);
  return {
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    formVersion: "v259",
    status: "in_review",
    user: null,
    approvalSteps: order.map((step, i) => ({
      step,
      status: i < idx ? "approved" : "pending",
    })),
    save: jest.fn().mockResolvedValue(undefined),
  };
};

describe("approve — D-2 bayonnoma faqat yig'ilish bosqichlarida", () => {
  test.each([
    ["arm", ROLES.ARM, undefined],
    ["methodical", ROLES.OQUV_USLUBIY_BOSHQARMA, undefined],
    ["kafedra", ROLES.KAFEDRA_MUDIRI, "77"],
    ["dean", ROLES.DEKAN, "77"],
  ])("%s bosqichi (%s) — saqlangan raqam: %s", async (step, role, expected) => {
    const doc = makeDoc(step);
    ScienceProgramModel.findOne = jest.fn().mockResolvedValue(doc);
    const next = jest.fn();

    await Controller.approve(
      { params: { id: doc._id }, body: { protocol: "77" }, query: {}, scope: {}, user: { _id: "u1", role: { title: role } } },
      createRes(),
      next,
    );

    expect(next).not.toHaveBeenCalled();
    const saved = doc.approvalSteps.find((s) => s.step === step);
    expect(saved.status).toBe("approved");
    expect(saved.protocol).toBe(expected);
  });
});
