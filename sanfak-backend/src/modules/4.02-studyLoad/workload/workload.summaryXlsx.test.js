const fs = require("fs");
const path = require("path");

jest.mock("./workload.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.02-studyLoad/_services/staffPositionsCalculator", () => ({
  buildStaffPositions: jest
    .fn()
    .mockResolvedValue({ items: [], totalPositions: 0, hourly: 0 }),
}));
jest.mock("./workload.service", () => ({
  ...jest.requireActual("./workload.service"),
  loadSummaryWorkloads: jest.fn(),
}));
jest.mock("#references/_services/academicYearResolver", () => ({
  ...jest.requireActual("#references/_services/academicYearResolver"),
  getAcademicYearTitle: jest.fn().mockResolvedValue("2026/2027"),
}));

const WorkloadModel = require("./workload.model");
WorkloadModel.calculateBlockTotal =
  jest.requireActual("./workload.model").calculateBlockTotal;
const workloadService = require("./workload.service");
const Controller = require("./workload.controller");
const { ROLES } = require("#config/constants");

const AY_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DEPARTMENT_ID = "dddddddddddddddddddddddd";

const createRes = () => {
  const res = {
    headers: {},
    chunks: [],
    setHeader: jest.fn((k, v) => {
      res.headers[k] = v;
    }),
    write: jest.fn((chunk) => {
      res.chunks.push(chunk);
      return true;
    }),
    end: jest.fn(),
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };
  return res;
};

const makeReq = ({ role, scope, query }) => ({
  user: { _id: "u1", role: { title: role } },
  scope,
  query,
});

beforeEach(() => {
  workloadService.loadSummaryWorkloads.mockReset();
  workloadService.loadSummaryWorkloads.mockResolvedValue([
    {
      department: { _id: DEPARTMENT_ID, title: "Normal anatomiya" },
      directions: [{ blocks: [{ totalHour: 100 }] }],
      staffPositions: { totalPositions: 0, hourly: 100, items: [] },
    },
  ]);
});

describe("route gate — workload.routes.js manbasi", () => {
  const src = fs.readFileSync(path.join(__dirname, "workload.routes.js"), "utf8");

  test("`/summary.xlsx` literal route `/:id` dan OLDIN e'lon qilingan", () => {
    const summaryIdx = src.indexOf('.route("/summary.xlsx")');
    const idIdx = src.indexOf('.route("/:id")');
    expect(summaryIdx).toBeGreaterThan(-1);
    expect(idIdx).toBeGreaterThan(-1);
    expect(summaryIdx).toBeLessThan(idIdx);
  });

  test("route `permit(MODULES.WORKLOAD, [ACTIONS.EXPORT])` + `scope` bilan yopilgan", () => {
    const block = src.slice(src.indexOf('.route("/summary.xlsx")'), src.indexOf("Controller.exportSummaryXlsx"));
    expect(block).toContain("permit(MODULES.WORKLOAD, [ACTIONS.EXPORT])");
    expect(block).toMatch(/\bscope,/);
    expect(block).toContain("validator.query(summaryXlsxQuery)");
  });
});

describe("exportSummaryXlsx — filtr (data scoping) va javob", () => {
  test("dekan: `req.scope` (fakultet kafedralari) + academicYear servis filtriga tushadi", async () => {
    const scope = { department: { $in: [DEPARTMENT_ID] } };
    const req = makeReq({ role: ROLES.DEKAN, scope, query: { academicYear: AY_ID } });
    const res = createRes();
    const next = jest.fn();

    await Controller.exportSummaryXlsx(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(workloadService.loadSummaryWorkloads).toHaveBeenCalledTimes(1);
    const filter = workloadService.loadSummaryWorkloads.mock.calls[0][0];
    expect(filter.department).toEqual(scope.department);
    expect(String(filter.academicYear)).toBe(AY_ID);
  });

  test("O'UB (global): scope'siz filtr — faqat o'quv yili", async () => {
    const req = makeReq({
      role: ROLES.OQUV_USLUBIY_BOSHQARMA,
      scope: {},
      query: { academicYear: AY_ID },
    });
    const res = createRes();
    await Controller.exportSummaryXlsx(req, res, jest.fn());

    const filter = workloadService.loadSummaryWorkloads.mock.calls[0][0];
    expect(filter.department).toBeUndefined();
    expect(String(filter.academicYear)).toBe(AY_ID);
  });

  test("kontroller `status`ni filtrga QO'YMAYDI — qoida servisda", async () => {
    const req = makeReq({
      role: ROLES.OQUV_USLUBIY_BOSHQARMA,
      scope: {},
      query: { academicYear: AY_ID, status: "draft" },
    });
    await Controller.exportSummaryXlsx(req, createRes(), jest.fn());

    const filter = workloadService.loadSummaryWorkloads.mock.calls[0][0];
    expect(filter.status).toBeUndefined();
  });

  test("tanlangan yilda tasdiqlangan yuklama yo'q → 409, fayl YOZILMAYDI", async () => {
    workloadService.loadSummaryWorkloads.mockResolvedValue([]);
    const res = createRes();
    const next = jest.fn();

    await Controller.exportSummaryXlsx(
      makeReq({ role: ROLES.OQUV_USLUBIY_BOSHQARMA, scope: {}, query: { academicYear: AY_ID } }),
      res,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(409);
    expect(err.message).toContain("tasdiqlangan yuklama topilmadi");
    expect(err.message).toContain("2026/2027");
    expect(res.write).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
    expect(res.headers["Content-Disposition"]).toBeUndefined();
  });

  test("reja_moliya: zanjir ko'rinishi filtri qo'shiladi (hujjat unga yetib kelgan bo'lsa)", async () => {
    const req = makeReq({ role: ROLES.REJA_MOLIYA, scope: {}, query: { academicYear: AY_ID } });
    await Controller.exportSummaryXlsx(req, createRes(), jest.fn());
    const filter = workloadService.loadSummaryWorkloads.mock.calls[0][0];
    expect(JSON.stringify(filter)).toContain("approvalSteps");
  });

  test("academicYear yaroqsiz (title) → 400, servis chaqirilmaydi", async () => {
    const req = makeReq({ role: ROLES.OQUV_USLUBIY_BOSHQARMA, scope: {}, query: { academicYear: "2026/2027" } });
    const next = jest.fn();
    await Controller.exportSummaryXlsx(req, createRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(workloadService.loadSummaryWorkloads).not.toHaveBeenCalled();
  });

  test("javob: xlsx Content-Type, attachment fayl nomi o'quv yili bilan, oqimga yoziladi", async () => {
    const req = makeReq({ role: ROLES.OQUV_USLUBIY_BOSHQARMA, scope: {}, query: { academicYear: AY_ID } });
    const res = createRes();
    await Controller.exportSummaryXlsx(req, res, jest.fn());

    expect(res.headers["Content-Type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.headers["Content-Disposition"]).toBe(
      'attachment; filename="kafedralar-soatlar-hisobi-2026-2027.xlsx"',
    );
    expect(res.write).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
    const bytes = Buffer.concat(res.chunks.map((c) => Buffer.from(c)));
    expect(bytes.slice(0, 2).toString("binary")).toBe("PK");
  });

  test("servis xatosi → 400 ErrorHandler (`next`)", async () => {
    workloadService.loadSummaryWorkloads.mockRejectedValue(new Error("db down"));
    const next = jest.fn();
    await Controller.exportSummaryXlsx(
      makeReq({ role: ROLES.OQUV_USLUBIY_BOSHQARMA, scope: {}, query: { academicYear: AY_ID } }),
      createRes(),
      next,
    );
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });
});

describe("loadSummaryWorkloads — faqat tasdiqlangan yuklama", () => {
  const actualService = jest.requireActual("./workload.service");

  const mockFind = () => {
    const chain = {
      select: jest.fn(() => chain),
      populate: jest.fn(() => chain),
      lean: jest.fn().mockResolvedValue([]),
    };
    WorkloadModel.find = jest.fn(() => chain);
    return chain;
  };

  test("filtrga `status: approved` majburan qo'shiladi", async () => {
    mockFind();
    await actualService.loadSummaryWorkloads({ academicYear: AY_ID });

    expect(WorkloadModel.find).toHaveBeenCalledTimes(1);
    expect(WorkloadModel.find.mock.calls[0][0]).toMatchObject({
      academicYear: AY_ID,
      status: "approved",
    });
  });

  test("chaqiruvchi boshqa status bersa ham — `approved` ustidan yozadi", async () => {
    mockFind();
    await actualService.loadSummaryWorkloads({
      academicYear: AY_ID,
      status: "draft",
    });

    expect(WorkloadModel.find.mock.calls[0][0].status).toBe("approved");
  });

  test("boshqa filtr kalitlari saqlanadi (scope buzilmaydi)", async () => {
    mockFind();
    const scope = { department: { $in: [DEPARTMENT_ID] } };
    await actualService.loadSummaryWorkloads({ ...scope, academicYear: AY_ID });

    expect(WorkloadModel.find.mock.calls[0][0].department).toEqual(scope.department);
  });

  test("`SUMMARY_STATUS` eksport qilingan (yagona manba)", () => {
    expect(actualService.SUMMARY_STATUS).toBe("approved");
  });
});

describe("summaryXlsxQuery — `status` parametri qabul qilinmaydi", () => {
  const { summaryXlsxQuery } = require("./workload.validation");

  test("academicYear bilan o'tadi", () => {
    const { error } = summaryXlsxQuery.validate({ academicYear: AY_ID });
    expect(error).toBeUndefined();
  });

  test("`status` yuborilsa rad etiladi (filtrlash illyuziyasi bo'lmasin)", () => {
    const { error } = summaryXlsxQuery.validate({
      academicYear: AY_ID,
      status: "draft",
    });
    expect(error).toBeDefined();
    expect(error.message).toContain("status");
  });
});
