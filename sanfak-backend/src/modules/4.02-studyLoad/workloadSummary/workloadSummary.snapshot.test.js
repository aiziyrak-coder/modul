jest.mock("./workloadSummary.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.service", () => ({
  loadSummaryWorkloads: jest.fn(),
}));
jest.mock("#references/department/department.model", () => ({
  find: jest.fn(),
}));

const workloadService = require("#modules/4.02-studyLoad/workload/workload.service");
const DepartmentModel = require("#references/department/department.model");
const service = require("./workloadSummary.service");

const DEP_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DEP_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const AY = "6a8bdb6c5b767d415c184735";

const wl = ({ id, dep, title, hours, updatedAt }) => ({
  _id: id,
  updatedAt,
  department: { _id: dep, title, head: null },
  directions: [{ blocks: [{ totalHour: hours }] }],
  staffPositions: { items: [], totalPositions: 0, hourly: hours },
  approvalSteps: [],
});

const mockDepartments = (list) => {
  DepartmentModel.find.mockReturnValue({
    lean: () => ({ exec: async () => list }),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDepartments([
    { _id: DEP_A, title: "Mikrobiologiya kafedrasi" },
    { _id: DEP_B, title: "Gistologiya kafedrasi" },
  ]);
});

describe("buildSnapshot", () => {
  test("qatorlar va jami quriladi; status filtri TAKRORLANMAYDI", async () => {
    workloadService.loadSummaryWorkloads.mockResolvedValue([
      wl({ id: "w1", dep: DEP_A, title: "Mikrobiologiya kafedrasi", hours: 234, updatedAt: new Date("2026-09-15") }),
    ]);

    const out = await service.buildSnapshot(AY);

    expect(workloadService.loadSummaryWorkloads).toHaveBeenCalledWith({
      academicYear: AY,
    });
    const filter = workloadService.loadSummaryWorkloads.mock.calls[0][0];
    expect(filter.status).toBeUndefined();

    expect(out.workloadCount).toBe(1);
    expect(out.snapshot.rowCount).toBe(1);
    expect(out.snapshot.totals.total).toBe(234);
  });

  test("surat O'ZI-YETARLI — kafedra nomi matn sifatida saqlanadi", async () => {
    workloadService.loadSummaryWorkloads.mockResolvedValue([
      wl({ id: "w1", dep: DEP_A, title: "Mikrobiologiya kafedrasi", hours: 234, updatedAt: new Date() }),
    ]);
    const out = await service.buildSnapshot(AY);
    const row = out.snapshot.rows[0];

    expect(typeof row.department).toBe("string");
    expect(row.department).toBe("Mikrobiologiya kafedrasi");
    expect(typeof row.head).toBe("string");
  });

  test("tasdiqlangan yuklamasi yo'q kafedra `missingDepartments` ga tushadi", async () => {
    workloadService.loadSummaryWorkloads.mockResolvedValue([
      wl({ id: "w1", dep: DEP_A, title: "Mikrobiologiya kafedrasi", hours: 234, updatedAt: new Date() }),
    ]);
    const out = await service.buildSnapshot(AY);

    expect(out.snapshot.missingDepartments).toEqual(["Gistologiya kafedrasi"]);
  });

  test("`includedWorkloads` id + updatedAt bilan yoziladi", async () => {
    const t = new Date("2026-09-15T10:00:00Z");
    workloadService.loadSummaryWorkloads.mockResolvedValue([
      wl({ id: "w1", dep: DEP_A, title: "Mikrobiologiya kafedrasi", hours: 234, updatedAt: t }),
    ]);
    const out = await service.buildSnapshot(AY);

    expect(out.includedWorkloads).toEqual([{ workload: "w1", updatedAt: t }]);
  });
});

describe("createSummary — yaratish darvozasi", () => {
  test("tasdiqlangan yuklama 0 → 409, hujjat yaratilmaydi", async () => {
    workloadService.loadSummaryWorkloads.mockResolvedValue([]);

    await expect(
      service.createSummary({
        academicYearId: AY,
        academicYearTitle: "2029/2030",
        userId: "u1",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("tasdiqlangan yuklama topilmadi"),
    });
  });

  test("409 xabarida o'quv yili nomi ko'rinadi", async () => {
    workloadService.loadSummaryWorkloads.mockResolvedValue([]);
    await expect(
      service.createSummary({ academicYearId: AY, academicYearTitle: "2029/2030" }),
    ).rejects.toMatchObject({ message: expect.stringContaining("2029/2030") });
  });
});

describe("computeStaleness — QATOR emas, YUKLAMA soni bo'yicha", () => {
  const doc = (included) => ({ academicYear: AY, includedWorkloads: included });

  test("o'zgarish yo'q → isStale false", async () => {
    const t = new Date("2026-09-15");
    workloadService.loadSummaryWorkloads.mockResolvedValue([
      wl({ id: "w1", dep: DEP_A, title: "A", hours: 100, updatedAt: t }),
    ]);
    const out = await service.computeStaleness(doc([{ workload: "w1", updatedAt: t }]));
    expect(out).toMatchObject({ isStale: false, added: 0, changed: 0, removed: 0 });
  });

  test("SHU kafedraga yangi yuklama qo'shilsa — qator soni o'zgarmaydi, lekin STALE", async () => {
    const t = new Date("2026-09-15");
    workloadService.loadSummaryWorkloads.mockResolvedValue([
      wl({ id: "w1", dep: DEP_A, title: "A", hours: 100, updatedAt: t }),
      wl({ id: "w2", dep: DEP_A, title: "A", hours: 120, updatedAt: t }),
    ]);
    const out = await service.computeStaleness(doc([{ workload: "w1", updatedAt: t }]));

    expect(out.added).toBe(1);
    expect(out.isStale).toBe(true);
  });

  test("mavjud yuklama yangilansa → changed", async () => {
    workloadService.loadSummaryWorkloads.mockResolvedValue([
      wl({ id: "w1", dep: DEP_A, title: "A", hours: 100, updatedAt: new Date("2026-09-17") }),
    ]);
    const out = await service.computeStaleness(
      doc([{ workload: "w1", updatedAt: new Date("2026-09-15") }]),
    );
    expect(out).toMatchObject({ changed: 1, isStale: true });
  });

  test("yuklama rad etilib chiqib ketsa → removed", async () => {
    workloadService.loadSummaryWorkloads.mockResolvedValue([]);
    const out = await service.computeStaleness(
      doc([{ workload: "w1", updatedAt: new Date("2026-09-15") }]),
    );
    expect(out).toMatchObject({ removed: 1, isStale: true });
  });
});
