"use strict";

jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("./expulsionCheck", () => ({ runExpulsionCheck: jest.fn() }));
jest.mock("./sessionProjection", () => ({ applyResult: jest.fn(), copiesFrameScore: jest.fn() }));
jest.mock("./sessionRosterSync", () => ({ syncSessionRoster: jest.fn() }));
jest.mock("./samsFactsPort", () => ({ loadSessionFacts: jest.fn(async () => ({ presence: new Map(), outages: [] })) }));
jest.mock("#modules/4.05-residency/residencySetting/residencySetting.service", () => ({
  getOrCreate: jest.fn().mockResolvedValue({ workDayFrom: "09:00", workDayTo: "14:00" }),
}));

const { runExpulsionCheck } = require("./expulsionCheck");
const { applyResult, copiesFrameScore } = require("./sessionProjection");
const Session = require("#modules/4.05-residency/residencySession/residencySession.model");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const ResidentApplication = require("#modules/4.05-residency/residentApplication/residentApplication.model");
const { resolveSession, resolveSessionDays } = require("./sessionResolution");

const DAY = "2026-10-12";
const AFTER = new Date("2026-10-13T08:00:00.000+05:00");
const SESSION = {
  _id: "s1", day: DAY, status: "announced", hours: 4, science: "sc1", lessonType: "amaliy", group: "g1",
  announcedBy: "u1", rosterScope: "group", rosterFrozenAt: null,
};
const chain = (value) => {
  const c = { select: () => c, sort: () => c, lean: jest.fn().mockResolvedValue(value) };
  return c;
};
const frame = (resident) => ({
  _id: `f-${resident}`, session: "s1", resident, outcome: "pending", outcomeReason: null, cancelledAt: null,
  resolvedRev: null, resolverVersion: null, attendance: null, score: null,
});
const FRAMES = [frame("r1")];

const DO_NOT_FAKE = [
  "nextTick", "setImmediate", "setTimeout", "setInterval", "clearTimeout",
  "clearInterval", "clearImmediate", "queueMicrotask", "hrtime", "performance",
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: AFTER, doNotFake: DO_NOT_FAKE });
  jest.spyOn(Session, "findById").mockImplementation(() => chain({ ...SESSION }));
  jest.spyOn(Session, "exists").mockResolvedValue(null);
  jest.spyOn(Session, "find").mockReturnValue(chain([{ _id: "s1" }]));
  jest.spyOn(Roster, "find").mockImplementation(() => chain(FRAMES));
  jest.spyOn(Roster, "findOneAndUpdate").mockImplementation((filter, update) =>
    chain({ ...FRAMES.find((f) => f._id === filter._id), ...update.$set }),
  );
  jest.spyOn(Roster, "updateOne").mockResolvedValue({ modifiedCount: 1 });
  jest.spyOn(Roster, "findById").mockReturnValue(chain({ resolvedRev: null }));
  jest.spyOn(Resident, "find").mockReturnValue(chain([{ _id: "r1" }]));
  jest.spyOn(Attendance, "findOne").mockReturnValue(chain(null));
  jest.spyOn(ResidentApplication, "find").mockReturnValue(chain([]));
  applyResult.mockResolvedValue({ changed: true, affectsHours: true, rowId: "a" });
  copiesFrameScore.mockReturnValue(false);
  runExpulsionCheck.mockResolvedValue(undefined);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("qayta hisob soati (N6H-Q5=A)", () => {
  test("resolveSessionDays — `now` berilmasa uzatilmaydi (jonli soat)", async () => {
    await resolveSessionDays([DAY], {});
    expect(runExpulsionCheck.mock.calls).toEqual([["r1", { source: "sams", now: undefined }]]);
  });

  test("resolveSession — `now` berilmasa uzatilmaydi (jonli soat)", async () => {
    await resolveSession("s1", {});
    expect(runExpulsionCheck.mock.calls).toEqual([["r1", { source: "sams", now: undefined }]]);
  });

  test("chaqiruvchi bergan soat aynan uzatiladi", async () => {
    await resolveSession("s1", { now: AFTER });
    expect(runExpulsionCheck.mock.calls).toEqual([["r1", { source: "sams", now: AFTER }]]);
  });
});
