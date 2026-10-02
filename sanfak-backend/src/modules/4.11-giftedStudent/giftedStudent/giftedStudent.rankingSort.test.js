"use strict";

jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(message);
      this.detail = detail;
    }
  },
}));
jest.mock("../_services/freshTitles", () => ({ applyFreshTitles: async (d) => d }));
jest.mock("../_services/studentPii", () => ({ stripStudentPii: (d) => d }));
jest.mock("../_services/studentAccess", () => ({ denyStudentAccess: jest.fn(async () => false) }));

const ROWS = [
  { fullName: "Aliyev Sardor", totalScore: 392.5, scoresByYear: { "2026/2027": 312.5 } },
  { fullName: "Iqtidorov Sanjar", totalScore: 999, scoresByYear: { "2025/2026": 999 } },
];

const captured = { sorts: [], paginateOptions: null, filters: [] };

const chain = () => {
  const c = {
    populate: () => c,
    sort: (s) => {
      captured.sorts.push(s);
      return c;
    },
    limit: () => c,
    select: () => c,
    lean: async () => ROWS,
  };
  return c;
};

jest.mock("./giftedStudent.model", () => ({
  find: (f) => {
    captured.filters.push(f);
    return chain();
  },
  paginate: async (_f, options) => {
    captured.paginateOptions = options;
    return { docs: ROWS };
  },
}));

const wsSpy = { columns: null, rows: [] };
jest.mock("exceljs", () => ({
  Workbook: class {
    addWorksheet() {
      return {
        set columns(v) {
          wsSpy.columns = v;
        },
        get columns() {
          return wsSpy.columns;
        },
        getRow: () => ({}),
        addRow: (r) => wsSpy.rows.push(r),
      };
    }

    get xlsx() {
      return { write: async () => {} };
    }
  },
}));

const Controller = require("./giftedStudent.controller");
const { currentAcademicYear } = require("../_services/academicYearWindow");
const { rankingSort } = require("../_services/yearScore");

const YIL = currentAcademicYear();
const BALL_YOLI = `scoresByYear.${YIL}`;

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  setHeader: jest.fn(),
});

beforeEach(() => {
  captured.sorts.length = 0;
  captured.filters.length = 0;
  captured.paginateOptions = null;
  wsSpy.columns = null;
  wsSpy.rows.length = 0;
});

describe("BESH saralash joyi ham yil baliga o'tdi", () => {
  test("findAllStudents", async () => {
    await Controller.findAllStudents({ query: {}, user: {} }, mockRes(), jest.fn());
    expect(captured.sorts[0]).toEqual(rankingSort(YIL));
  });

  test("findMyAdvisees", async () => {
    await Controller.findMyAdvisees({ user: { _id: "u1" } }, mockRes(), jest.fn());
    expect(captured.sorts[0]).toEqual(rankingSort(YIL));
  });

  test("getRanking (endpoint nomi AYNAN «ranking»)", async () => {
    await Controller.getRanking({ user: {}, scope: {} }, mockRes(), jest.fn());
    expect(captured.sorts[0]).toEqual(rankingSort(YIL));
  });

  test("paginateStudents", async () => {
    await Controller.paginateStudents(
      { query: { page: "1", limit: "10" }, user: {} },
      mockRes(),
      jest.fn(),
    );
    expect(captured.paginateOptions.sort).toEqual(rankingSort(YIL));
  });

  test("exportRanking", async () => {
    await Controller.exportRanking({ query: {}, user: {} }, mockRes(), jest.fn());
    expect(captured.sorts[0]).toEqual(rankingSort(YIL));
  });

  test("🔴 birortasida ham yalang'och `{ totalScore: -1 }` QOLMAGAN", async () => {
    await Controller.findAllStudents({ query: {}, user: {} }, mockRes(), jest.fn());
    await Controller.getRanking({ user: {}, scope: {} }, mockRes(), jest.fn());
    await Controller.findMyAdvisees({ user: { _id: "u1" } }, mockRes(), jest.fn());
    for (const s of captured.sorts) {
      expect(Object.keys(s)[0]).toBe(BALL_YOLI);
    }
  });
});

describe("tartib BARQAROR — zaxira kalitlar", () => {
  test("uchta kalit, ball birinchi", async () => {
    await Controller.getRanking({ user: {}, scope: {} }, mockRes(), jest.fn());
    expect(Object.keys(captured.sorts[0])).toEqual([BALL_YOLI, "totalScore", "fullName"]);
  });
});

describe("Excel eksporti — IKKI ustun, yorliqlari HAR XIL", () => {
  test("«Yil bali» ustuni QO'SHILDI va sarlavhasida YIL bor", async () => {
    await Controller.exportRanking({ query: {}, user: {} }, mockRes(), jest.fn());
    const yil = wsSpy.columns.find((c) => c.key === "yearScore");
    expect(yil).toBeDefined();
    expect(yil.header).toBe(`Yil bali (${YIL})`);
  });

  test("«Jami ball» ustuni QOLDI — ma'nosi o'zgarmadi", async () => {
    await Controller.exportRanking({ query: {}, user: {} }, mockRes(), jest.fn());
    const jami = wsSpy.columns.find((c) => c.key === "totalScore");
    expect(jami.header).toBe("Jami ball");
    expect(wsSpy.rows[0].totalScore).toBe(392.5);
  });

  test("🔴 yil katagi XARITADAN o'qiladi, `totalScore` dan emas", async () => {
    await Controller.exportRanking({ query: {}, user: {} }, mockRes(), jest.fn());
    expect(wsSpy.rows[0].yearScore).toBe(312.5);
    expect(wsSpy.rows[1].yearScore).toBe(0);
  });

  test("`#` ustuni tartibdan hosil bo'ladi (1 dan boshlanadi)", async () => {
    await Controller.exportRanking({ query: {}, user: {} }, mockRes(), jest.fn());
    expect(wsSpy.rows.map((r) => r.rank)).toEqual([1, 2]);
  });
});

describe("exportRanking — `?scoreYear=`", () => {
  const exportWith = async (query) => {
    await Controller.exportRanking({ query, user: {} }, mockRes(), jest.fn());
  };

  test("🔴 o'tgan yil tanlansa — USTUN, QIYMAT va TARTIB o'sha yilga o'tadi", async () => {
    await exportWith({ scoreYear: "2025/2026" });
    expect(captured.sorts[0]).toEqual(rankingSort("2025/2026"));
    expect(wsSpy.columns.find((c) => c.key === "yearScore").header).toBe(
      "Yil bali (2025/2026)",
    );
    expect(wsSpy.rows.map((r) => r.yearScore)).toEqual([0, 999]);
  });

  test("berilmasa — JORIY yil (eski mijoz uchun xulq o'zgarmaydi)", async () => {
    await exportWith({});
    expect(captured.sorts[0]).toEqual(rankingSort(YIL));
    expect(wsSpy.rows.map((r) => r.yearScore)).toEqual([312.5, 0]);
  });

  test("tire imlosi ham qabul qilinadi", async () => {
    await exportWith({ scoreYear: "2025-2026" });
    expect(wsSpy.columns.find((c) => c.key === "yearScore").header).toBe(
      "Yil bali (2025/2026)",
    );
  });

  test("🔴 `?academicYear=` ball yiliga TA'SIR QILMAYDI — u FILTR bo'lib qoladi", async () => {
    await exportWith({ academicYear: "2025/2026" });
    expect(captured.sorts[0]).toEqual(rankingSort(YIL));
    expect(captured.filters[0]).toHaveProperty("academicYear");
  });

  test("ikkalasi BIRGA yuborilsa — har biri o'z ishini qiladi", async () => {
    await exportWith({ academicYear: "2025/2026", scoreYear: "2025/2026" });
    expect(captured.filters[0]).toHaveProperty("academicYear");
    expect(captured.sorts[0]).toEqual(rankingSort("2025/2026"));
  });

  test("yaroqsiz qiymat jimgina 0 ball bermaydi — joriy yilga tushadi", async () => {
    await exportWith({ scoreYear: "69df7a8f94bda50c83a1d3f1" });
    expect(wsSpy.rows.map((r) => r.yearScore)).toEqual([312.5, 0]);
  });
});
