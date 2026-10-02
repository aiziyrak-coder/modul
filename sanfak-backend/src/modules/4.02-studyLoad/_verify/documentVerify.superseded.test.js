"use strict";

jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.model");
jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#modules/4.02-studyLoad/workloadSummary/workloadSummary.model");
jest.mock("#modules/4.02-studyLoad/contingentReport/contingentReport.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#references/_services/academicYearResolver", () => ({
  getAcademicYearTitle: jest.fn().mockResolvedValue("2026/2027"),
}));
jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const { REGISTRY, lookup } = require("./documentVerify.service");
const { renderSuperseded, verifyDocument } = require("./documentVerify.controller");

const TOKEN = "e".repeat(32);
const q = (doc) => ({ populate: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(doc) });
const only = (kind, doc) => {
  for (const e of REGISTRY) e.Model.findOne = jest.fn().mockReturnValue(q(e.kind === kind ? doc : null));
};
const supersededDoc = (over = {}) => ({
  status: "superseded",
  department: { title: "Anatomiya kafedrasi" },
  academicYear: "ay",
  supersededAt: new Date(2026, 8, 20),
  verify: { token: TOKEN, issuedAt: new Date(2026, 5, 1), revokedAt: null, snapshot: [{ label: "Rektor", shortName: "A.Karimov", date: new Date(2026, 5, 1) }] },
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe("lookup — superseded", () => {
  test.each(["workload", "workloadDistribution"])("%s → state superseded + supersededAt", async (kind) => {
    only(kind, supersededDoc());
    const r = await lookup(TOKEN);
    expect(r).toMatchObject({ kind, state: "superseded", supersededAt: new Date(2026, 8, 20) });
    expect(r.snapshot).toHaveLength(1);
    expect(Object.keys(r).sort()).toEqual(
      ["approvedAt", "editedAfterApproval", "kind", "snapshot", "state", "supersededAt", "title"],
    );
  });

  test("bekor qilingan token → null", async () => {
    only("workload", supersededDoc({ verify: { token: TOKEN, revokedAt: new Date() } }));
    expect(await lookup(TOKEN)).toBeNull();
  });

  test("workloadSummary superseded — o'zgarmagan (null)", async () => {
    only("workloadSummary", supersededDoc({ academicYearTitle: "2026/2027" }));
    expect(await lookup(TOKEN)).toBeNull();
  });
});

describe("controller — superseded sahifa", () => {
  const RESULT = {
    kind: "workload",
    title: "Anatomiya kafedrasi — 2026/2027 o'quv yili yuklamasi",
    state: "superseded",
    approvedAt: new Date(2026, 5, 1),
    supersededAt: new Date(2026, 8, 20),
    snapshot: [{ label: "Rektor", shortName: "A.Karimov", date: new Date(2026, 5, 1) }],
  };

  test("200, «O'z kuchini yo'qotgan», sana; «tasdiqlangan» YO'Q", async () => {
    only("workload", supersededDoc());
    const res = { set: jest.fn(), status: jest.fn(), type: jest.fn(), send: jest.fn() };
    res.set.mockReturnValue(res);
    res.status.mockReturnValue(res);
    res.type.mockReturnValue(res);
    await verifyDocument({ params: { token: TOKEN } }, res);
    const html = res.send.mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(200);
    expect(html).toContain("O'z kuchini yo'qotgan");
    expect(html).toContain("20.09.2026");
    expect(html).not.toMatch(/tasdiqlangan/i);
  });

  test("escaping saqlanadi", () => {
    const html = renderSuperseded({ ...RESULT, title: "<script>x</script>" }, TOKEN);
    expect(html).not.toContain("<script>x</script>");
    expect(html).not.toMatch(/tasdiqlangan/i);
  });
});
