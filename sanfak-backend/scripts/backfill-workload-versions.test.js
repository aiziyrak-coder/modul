"use strict";

jest.mock("#modules/4.02-studyLoad/workload/workload.model", () => ({ find: jest.fn(), updateMany: jest.fn() }));
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model", () => ({ find: jest.fn(), updateMany: jest.fn() }));

const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const Distribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const { planSupersede, planRevert, approvalTime, backfill } = require("./backfill-workload-versions");

const wl = (id, dept, ay, finalDate, status = "approved") => ({
  _id: id,
  title: `Yuklama ${id}`,
  department: dept,
  academicYear: ay,
  status,
  approvalSteps: [{ date: "2026-01-01" }, { date: finalDate }],
});

const chain = (docs) => ({ select: () => ({ lean: () => Promise.resolve(docs) }) });

beforeEach(() => jest.clearAllMocks());

describe("planSupersede — sof reja", () => {
  test("bitta approved — guruh yo'q", () => {
    expect(planSupersede({ workloads: [wl("a", "d1", "y1", "2026-02-01")] }).groups).toEqual([]);
  });

  test("eng kech yakuniy tasdiq QOLADI; boshqa kafedra/yil aralashmaydi", () => {
    const plan = planSupersede({
      workloads: [
        wl("old", "d1", "y1", "2026-02-01"),
        wl("new", "d1", "y1", "2026-05-01"),
        wl("other-dept", "d2", "y1", "2026-03-01"),
        wl("other-year", "d1", "y2", "2026-03-01"),
        wl("draft", "d1", "y1", "2026-06-01", "draft"),
      ],
    });
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0]).toMatchObject({ department: "d1", academicYear: "y1", keep: { id: "new" } });
    expect(plan.groups[0].supersede.map((s) => s.id)).toEqual(["old"]);
    expect(plan.workloadCount).toBe(1);
  });

  test("qolganning approved taqsimoti bor → eski taqsimot superseded", () => {
    const plan = planSupersede({
      workloads: [wl("old", "d1", "y1", "2026-02-01"), wl("new", "d1", "y1", "2026-05-01")],
      distributions: [
        { _id: "ds-old", workload: "old", status: "approved" },
        { _id: "ds-new", workload: "new", status: "approved" },
      ],
    });
    expect(plan.groups[0].distributions).toEqual({
      supersededBy: "ds-new",
      supersede: [{ id: "ds-old", workload: "old", status: "approved" }],
      waiting: [],
    });
    expect(plan.distributionCount).toBe(1);
  });

  test("yangi taqsimot hali approved emas → eski taqsimot KUTADI (tegilmaydi)", () => {
    const plan = planSupersede({
      workloads: [wl("old", "d1", "y1", "2026-02-01"), wl("new", "d1", "y1", "2026-05-01")],
      distributions: [
        { _id: "ds-old", workload: "old", status: "approved" },
        { _id: "ds-new", workload: "new", status: "in_review" },
      ],
    });
    expect(plan.groups[0].distributions.supersede).toEqual([]);
    expect(plan.groups[0].distributions.waiting.map((d) => d.id)).toEqual(["ds-old"]);
  });

  test("approvalTime: bosqich sanasi yo'q → verify.issuedAt → updatedAt", () => {
    expect(approvalTime({ verify: { issuedAt: "2026-03-01" } })).toBe(new Date("2026-03-01").getTime());
    expect(approvalTime({ updatedAt: "2026-04-01" })).toBe(new Date("2026-04-01").getTime());
    expect(approvalTime({})).toBe(0);
  });
});

describe("backfill — default DRY-RUN hech narsa yozmaydi", () => {
  test("dry-run: updateMany chaqirilmaydi, reja qaytadi", async () => {
    Workload.find.mockReturnValue(chain([wl("old", "d1", "y1", "2026-02-01"), wl("new", "d1", "y1", "2026-05-01")]));
    Distribution.find.mockReturnValue(chain([]));
    const r = await backfill({});
    expect(r.workloadCount).toBe(1);
    expect(r.applied).toBeNull();
    expect(Workload.updateMany).not.toHaveBeenCalled();
    expect(Distribution.updateMany).not.toHaveBeenCalled();
  });
});

describe("planRevert — sof reja (review: faqat o'zgarmagan hujjat tiklanadi)", () => {
  const W = "64b000000000000000000001";
  const D = "64b000000000000000000002";
  const appliedAt = "2026-09-24T10:00:00.000Z";

  test("filtr: _id + status superseded + aynan appliedAt; set = zaxiradagi eski maydonlar", () => {
    const { ops, invalid } = planRevert({
      appliedAt,
      appliedStatus: "superseded",
      workloads: [{ _id: W, status: "approved", supersededBy: null, supersededAt: null }],
      distributions: [{ _id: D, status: "approved", active: true, supersededBy: null, supersededAt: null }],
    });
    expect(invalid).toBe(0);
    expect(ops).toEqual([
      {
        kind: "workloads",
        _id: W,
        filter: { _id: W, status: "superseded", supersededAt: new Date(appliedAt) },
        set: { status: "approved", supersededBy: null, supersededAt: null },
      },
      {
        kind: "distributions",
        _id: D,
        filter: { _id: D, status: "superseded", supersededAt: new Date(appliedAt) },
        set: { status: "approved", active: true, supersededBy: null, supersededAt: null },
      },
    ]);
  });

  test("appliedAt siz (eski format) zaxira — rad etiladi, hech narsa rejalanmaydi", () => {
    expect(() => planRevert({ workloads: [{ _id: W, status: "approved" }] })).toThrow(/appliedAt/);
  });

  test("yaroqsiz _id sanaladi, op yaratilmaydi", () => {
    const { ops, invalid } = planRevert({ appliedAt, workloads: [{ _id: "x", status: "approved" }] });
    expect(ops).toEqual([]);
    expect(invalid).toBe(1);
  });
});
