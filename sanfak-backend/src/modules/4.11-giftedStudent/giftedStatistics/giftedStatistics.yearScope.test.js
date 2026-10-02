"use strict";

jest.mock("#shared/error", () => ({ ErrorHandler: class ErrorHandler extends Error {} }));
jest.mock("../_services/studentAccess", () => ({
  resolveOwnedGiftedStudentIds: jest.fn(async () => null),
}));

const TOP_ROWS = [
  {
    fullName: "Aliyev Sardor",
    faculty: "Farmatsiya fakulteti",
    course: 1,
    totalScore: 392.5,
    scoresByYear: { "2026/2027": 312.5 },
  },
  {
    fullName: "Iqtidorov Sanjar",
    faculty: "Farmatsiya fakulteti",
    course: 3,
    totalScore: 999,
    scoresByYear: { "2025/2026": 999 },
  },
];

const captured = { pipeline: null, topSort: null, topSelect: null };

jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  aggregate: (p) => {
    captured.pipeline = p;
    return Promise.resolve([{ total: [{ n: 2 }], avgScore: [], byFaculty: [], byCourse: [] }]);
  },
  find: () => ({
    sort: (s) => {
      captured.topSort = s;
      return {
        limit: () => ({
          select: (sel) => {
            captured.topSelect = sel;
            return { lean: async () => TOP_ROWS };
          },
        }),
      };
    },
  }),
}));
jest.mock("#modules/4.11-giftedStudent/studentAchievement/studentAchievement.model", () => ({
  aggregate: async () => [],
  findOne: () => ({ sort: () => ({ select: () => ({ lean: async () => null }) }) }),
}));
jest.mock("#modules/4.11-giftedStudent/scholarshipApplication/scholarshipApplication.model", () => ({
  aggregate: async () => [],
  find: () => ({ select: () => ({ lean: async () => [] }) }),
}));
jest.mock("#modules/4.11-giftedStudent/scholarship/scholarship.model", () => ({
  find: () => ({ select: () => ({ lean: async () => [] }) }),
}));

const Controller = require("./giftedStatistics.controller");
const { currentAcademicYear } = require("../_services/academicYearWindow");
const { rankingSort } = require("../_services/yearScore");

const YIL = currentAcademicYear();
const YOL = `$scoresByYear.${YIL}`;

const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

const run = async () => {
  const res = mockRes();
  await Controller.overview({ user: { role: {} } }, res, jest.fn());
  return res.json.mock.calls[0][0];
};

const facet = () => captured.pipeline.find((s) => s.$facet).$facet;

beforeEach(() => {
  captured.pipeline = null;
  captured.topSort = null;
  captured.topSelect = null;
});

describe("o'rtacha ball — mahraj BARCHA talaba", () => {
  test("🔴 `avgScore` `$ifNull` bilan o'raladi", async () => {
    await run();
    expect(facet().avgScore[0].$group.v).toEqual({ $avg: { $ifNull: [YOL, 0] } });
  });

  test("🔴 fakultet kesimi ham `$ifNull` bilan", async () => {
    await run();
    const group = facet().byFaculty.find((s) => s.$group).$group;
    expect(group.avgScore).toEqual({ $avg: { $ifNull: [YOL, 0] } });
  });

  test("yalang'och `$totalScore` HECH QAYERDA qolmagan", async () => {
    await run();
    expect(JSON.stringify(captured.pipeline)).not.toContain('"$avg":"$totalScore"');
  });

  test("yo'l JORIY yilni ko'rsatadi", async () => {
    await run();
    expect(JSON.stringify(captured.pipeline)).toContain(`scoresByYear.${YIL}`);
  });
});

describe("TOP ro'yxati", () => {
  test("tartib — yil bali (zaxira kalitlar bilan)", async () => {
    await run();
    expect(captured.topSort).toEqual(rankingSort(YIL));
  });

  test("🔴 `scoresByYear` select'ga QO'SHILGAN", async () => {
    await run();
    expect(captured.topSelect).toContain("scoresByYear");
  });

  test("javobda IKKALA son ham bor va ular FARQ qiladi", async () => {
    const out = await run();
    expect(out.students.top[0]).toMatchObject({
      fullName: "Aliyev Sardor",
      yearScore: 312.5,
      totalScore: 392.5,
    });
  });

  test("🔴 o'tgan yilgi ball joriy yilga SIZMAYDI", async () => {
    const out = await run();
    expect(out.students.top[1]).toMatchObject({ yearScore: 0, totalScore: 999 });
  });
});
