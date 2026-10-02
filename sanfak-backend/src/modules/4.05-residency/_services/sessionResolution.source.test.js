"use strict";

jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("./expulsionCheck", () => ({ runExpulsionCheck: jest.fn() }));

const { RECOUNT_SOURCE } = require("./sessionResolution");
const { HISTORY_SOURCES } = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");

describe("qayta hisob manbai (I3)", () => {
  test("`sams` — va buyruq tarixi enum'ida bor", () => {
    expect(RECOUNT_SOURCE).toBe("sams");
    expect(HISTORY_SOURCES).toContain(RECOUNT_SOURCE);
  });

  test("tungi ushlash manbai qayta hisob manbai bilan bir xil", () => {
    expect(require("./warningNightHold").WARNING_HOLD_SOURCE).toBe(RECOUNT_SOURCE);
  });
});
