"use strict";

jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock("#modules/4.02-studyLoad/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(null),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getDepartmentHeadUserIds: jest.fn().mockResolvedValue(["head-1"]),
}));
jest.mock("#modules/4.02-studyLoad/_shared/finalStepRevoke.dependents", () => ({
  ACTIVE_STATUSES: ["in_review", "approved"],
  findActiveDependents: jest.fn().mockResolvedValue([]),
  markInactiveDependentsStale: jest.fn().mockResolvedValue(0),
}));

const { ROLES } = require("#config/constants");
const { safeDispatchMany } = require("#modules/4.02-studyLoad/_shared/chainNotify");
const { noticeBody, runFinalRevoke } = require("./finalStepRevoke");

const REASON = "Guruhlar o'zgardi";
const flush = () => new Promise((r) => setImmediate(r));

afterEach(() => jest.clearAllMocks());

const CASES = [
  [
    "ishchi reja — generatsiya sarlavhasi",
    "workingSchedule",
    { title: "2024/2025 oʻquv yili Davolash ishi 2 bosqich" },
    "Ishchi o'quv reja «2024/2025 oʻquv yili Davolash ishi 2 bosqich». Sabab: Guruhlar o'zgardi",
  ],
  [
    "ishchi reja — sarlavhasiz: yil + kurs",
    "workingSchedule",
    { title: "", year: "2028/2029", currentCourse: 6 },
    "Ishchi o'quv reja «2028/2029, 6-kurs». Sabab: Guruhlar o'zgardi",
  ],
  [
    "yuklama — sarlavha",
    "workload",
    { title: "Normal anatomiya kafedrasining 2024/2025 o'quv yili uchun soatlar hisobi" },
    "Yuklama «Normal anatomiya kafedrasining 2024/2025 o'quv yili uchun soatlar hisobi». Sabab: Guruhlar o'zgardi",
  ],
  [
    "taqsimot — sarlavhasiz: populate qilingan kafedra + kurs",
    "workloadDistribution",
    { title: null, department: { _id: "d1", title: "Normal anatomiya kafedrasi" }, course: 2 },
    "Taqsimot «Normal anatomiya kafedrasi, 2-kurs». Sabab: Guruhlar o'zgardi",
  ],
  [
    "sillabus — fan populate qilinmagan (ObjectId): faqat semestr",
    "syllabus",
    { title: null, science: "aaaaaaaaaaaaaaaaaaaaaaaa", semester: 5 },
    "Sillabus «5-semestr». Sabab: Guruhlar o'zgardi",
  ],
  [
    "kafedralar hisobi — o'quv yili",
    "workloadSummary",
    { academicYearTitle: "2024/2025" },
    "Kafedralar soatlar hisobi «2024/2025 o'quv yili». Sabab: Guruhlar o'zgardi",
  ],
  [
    "kontingent hisoboti — fakultet + yil",
    "contingentReport",
    { facultyTitle: "Davolash fakulteti", academicYearTitle: "2023/2024" },
    "Talabalar kontingenti hisoboti «Davolash fakulteti, 2023/2024». Sabab: Guruhlar o'zgardi",
  ],
];

describe("noticeBody — hujjat nomi bildirishnomada", () => {
  test.each(CASES)("%s", (_name, entity, doc, expected) => {
    expect(noticeBody(entity, doc, REASON)).toBe(expected);
  });

  test("hech narsa ma'lum bo'lmasa — avvalgi matn (yorliq + sabab)", () => {
    expect(noticeBody("scienceProgram", { title: null, science: null }, REASON)).toBe(
      "Fan dasturi. Sabab: Guruhlar o'zgardi",
    );
  });
});

describe("runFinalRevoke — bildirishnoma hujjat nomi bilan ketadi", () => {
  test("yuklama qaytarilganda body'da sarlavha bor, havola alohida", async () => {
    const doc = {
      _id: "w1",
      title: "Normal anatomiya kafedrasining 2024/2025 o'quv yili uchun soatlar hisobi",
      department: "dep-1",
      status: "approved",
      approvalSteps: ["methodical", "kafedra", "financial", "prorektor", "rektor"].map((step) => ({
        step,
        status: "approved",
        approvedBy: "x",
      })),
      verify: { token: "f".repeat(32), revokedAt: null },
      save: jest.fn().mockResolvedValue(undefined),
    };
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    const next = jest.fn();

    await runFinalRevoke({
      entity: "workload",
      doc,
      req: { body: { comment: REASON }, user: { _id: "u-r", role: { title: ROLES.REKTOR } } },
      res,
      next,
    });
    await flush();

    expect(next).not.toHaveBeenCalled();
    expect(safeDispatchMany).toHaveBeenCalledWith(
      ["head-1"],
      expect.objectContaining({
        body: `Yuklama «${doc.title}». Sabab: ${REASON}`,
        link: "/study-load/workloads/w1",
      }),
    );
  });
});
