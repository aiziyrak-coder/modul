jest.mock("./personalReport.model");

const { ROLES } = require("#config/constants");
const {
  REPORT_CHAIN_ROLES,
  buildReportVisibilityFilter,
  withReportVisibility,
} = require("./personalReport.visibility");
const PersonalReportModel = require("./personalReport.model");
const service = require("./personalReport.service");
const Controller = require("./personalReport.controller");

const TEACHER_ID = "cccccccccccccccccccccccc";
const OTHER_ID = "dddddddddddddddddddddddd";
const DEKAN_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const REPORT_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const userWithRole = (title, id = OTHER_ID) => ({ _id: id, role: { title } });

const matchValue = (cond, value) => {
  if (cond && typeof cond === "object" && !Array.isArray(cond)) {
    return Object.entries(cond).every(([op, arg]) => {
      switch (op) {
        case "$ne":
          return String(value) !== String(arg);
        case "$nin":
          return !arg.some((a) => String(a) === String(value));
        case "$in":
          return arg.some((a) => String(a) === String(value));
        default:
          throw new Error(`matches(): qo'llanmagan operator "${op}"`);
      }
    });
  }
  return String(cond) === String(value);
};

const matches = (filter, doc) =>
  Object.entries(filter).every(([key, cond]) => {
    if (key === "$and") return cond.every((f) => matches(f, doc));
    if (key === "$or") return cond.some((f) => matches(f, doc));
    if (key === "$expr") {
      const [a, b] = cond.$eq;
      return a === b;
    }
    return matchValue(cond, doc[key]);
  });

const report = (overrides = {}) => ({
  _id: REPORT_ID,
  active: true,
  teacher: TEACHER_ID,
  status: "submitted",
  ...overrides,
});

const OWN_DRAFT = report({ teacher: TEACHER_ID, status: "draft" });
const OWN_SUBMITTED = report({ teacher: TEACHER_ID, status: "submitted" });
const FOREIGN_DRAFT = report({ teacher: OTHER_ID, status: "draft" });
const FOREIGN_SUBMITTED = report({ teacher: OTHER_ID, status: "submitted" });
const FOREIGN_APPROVED = report({ teacher: OTHER_ID, status: "approved" });
const FOREIGN_REJECTED = report({ teacher: OTHER_ID, status: "rejected" });

describe("buildReportVisibilityFilter — tasdiqlangan matritsa (pure)", () => {
  test("oqituvchi — o'z hisobotini (draft ham) ko'radi, BEGONAni ko'rmaydi", () => {
    const filter = buildReportVisibilityFilter(
      userWithRole(ROLES.OQITUVCHI, TEACHER_ID),
    );
    expect(filter).toEqual({ teacher: TEACHER_ID });
    expect(matches(filter, OWN_DRAFT)).toBe(true);
    expect(matches(filter, OWN_SUBMITTED)).toBe(true);
    expect(matches(filter, FOREIGN_SUBMITTED)).toBe(false);
    expect(matches(filter, FOREIGN_DRAFT)).toBe(false);
  });

  test("oqituvchi — filtr `req.scope`dan MUSTAQIL (scopeLevel `department` drifti)", () => {
    const scope = { teacher: { $in: [TEACHER_ID, OTHER_ID] } };
    const merged = withReportVisibility(
      { active: true, ...scope },
      userWithRole(ROLES.OQITUVCHI, TEACHER_ID),
    );
    expect(matches(merged, OWN_DRAFT)).toBe(true);
    expect(matches(merged, FOREIGN_SUBMITTED)).toBe(false);
    expect(matches(merged, FOREIGN_DRAFT)).toBe(false);
  });

  test("`user._id` yo'q oqituvchi — FAIL-CLOSED (0 natija, crash emas)", () => {
    const user = { role: { title: ROLES.OQITUVCHI } };
    expect(() => buildReportVisibilityFilter(user)).not.toThrow();
    const filter = buildReportVisibilityFilter(user);
    expect(matches(filter, OWN_DRAFT)).toBe(false);
    expect(matches(filter, FOREIGN_SUBMITTED)).toBe(false);
  });

  test("`user` umuman yo'q — FAIL-CLOSED (crash emas)", () => {
    expect(() => buildReportVisibilityFilter(undefined)).not.toThrow();
    expect(
      matches(buildReportVisibilityFilter(undefined), FOREIGN_SUBMITTED),
    ).toBe(false);
  });

  test("failClosed() — har chaqiruvda YANGI obyekt (singleton mutatsiya qilinmaydi)", () => {
    const a = buildReportVisibilityFilter(userWithRole(ROLES.ILMIY_BOLIM));
    const b = buildReportVisibilityFilter(userWithRole(ROLES.ILMIY_BOLIM));
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    a.active = "MUTATSIYA";
    expect(
      buildReportVisibilityFilter(userWithRole(ROLES.ILMIY_BOLIM)).active,
    ).toBeUndefined();
  });

  test("dekan — begona submitted/approved/rejected KO'RADI, draft KO'RMAYDI", () => {
    const filter = buildReportVisibilityFilter(userWithRole(ROLES.DEKAN, DEKAN_ID));
    expect(filter).toEqual({ status: { $nin: ["draft"] } });
    expect(matches(filter, FOREIGN_SUBMITTED)).toBe(true);
    expect(matches(filter, FOREIGN_APPROVED)).toBe(true);
    expect(matches(filter, FOREIGN_REJECTED)).toBe(true);
    expect(matches(filter, FOREIGN_DRAFT)).toBe(false);
    expect(matches(filter, OWN_DRAFT)).toBe(false);
  });

  test("fakultet_kengash_kotibi — dekan bilan AYNAN bir xil filtr", () => {
    expect(
      buildReportVisibilityFilter(userWithRole(ROLES.FAKULTET_KENGASH_KOTIBI)),
    ).toEqual({ status: { $nin: ["draft"] } });
  });

  test("REGRESSIYA QULFI — dekan O'Z BOSQICHINI imzolagandan KEYIN ham ko'radi (kotib navbatda)", () => {
    const halfSigned = report({
      teacher: OTHER_ID,
      status: "submitted",
      approvals: [
        { step: "dekan", status: "approved" },
        { step: "kotib", status: "pending" },
      ],
    });
    const filter = buildReportVisibilityFilter(userWithRole(ROLES.DEKAN, DEKAN_ID));
    expect(matches(filter, halfSigned)).toBe(true);
    expect(JSON.stringify(filter)).not.toMatch(/approvals/);
  });

  test("zanjirda YO'Q rollar — 0 natija (fail-closed)", () => {
    [
      ROLES.ILMIY_BOLIM,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.KAFEDRA_MUDIRI,
      ROLES.ICHKI_NAZORAT,
      ROLES.KAFEDRA_USLUBIY_MASUL,
      ROLES.KAFEDRA_ILMIY_MASUL,
      ROLES.KAFEDRA_USTOZ_SHOGIRD_MASUL,
      ROLES.REKTOR,
      ROLES.PROREKTOR,
    ].forEach((role) => {
      const filter = buildReportVisibilityFilter(userWithRole(role));
      expect(matches(filter, FOREIGN_SUBMITTED)).toBe(false);
      expect(matches(filter, FOREIGN_APPROVED)).toBe(false);
      expect(matches(filter, OWN_DRAFT)).toBe(false);
    });
  });

  test("legacy `admin` roli — 0 natija (bypass EMAS, `moderator`dan farqli)", () => {
    const filter = buildReportVisibilityFilter(userWithRole(ROLES.ADMIN));
    expect(matches(filter, FOREIGN_SUBMITTED)).toBe(false);
  });

  test("noma'lum / wildcard kompozit rol — 0 natija", () => {
    ["*", "custom_role", "admin_wildcard"].forEach((title) => {
      const filter = buildReportVisibilityFilter({ _id: OTHER_ID, role: { title } });
      expect(matches(filter, FOREIGN_SUBMITTED)).toBe(false);
    });
  });

  test("super_admin / moderator — cheklovsiz ({} bypass)", () => {
    [ROLES.SUPER_ADMIN, ROLES.MODERATOR].forEach((role) => {
      const filter = buildReportVisibilityFilter(userWithRole(role));
      expect(filter).toEqual({});
      expect(matches(filter, FOREIGN_DRAFT)).toBe(true);
      expect(matches(filter, OWN_DRAFT)).toBe(true);
    });
  });

  test("REPORT_CHAIN_ROLES — service'dagi VERIFIER_ROLES bilan AYNAN bitta manba", () => {
    expect(REPORT_CHAIN_ROLES).toEqual([
      ROLES.DEKAN,
      ROLES.FAKULTET_KENGASH_KOTIBI,
    ]);
    expect(service.VERIFIER_ROLES).toBe(REPORT_CHAIN_ROLES);
  });
});

describe("withReportVisibility — xavfsiz merge (mutatsiya yo'q)", () => {
  test("bypass — filtr o'zgarmasdan, YANGI obyekt sifatida qaytadi", () => {
    const base = { active: true, teacher: { $in: [TEACHER_ID] } };
    const result = withReportVisibility(base, userWithRole(ROLES.SUPER_ADMIN));
    expect(result).toEqual(base);
    expect(result).not.toBe(base);
  });

  test("mavjud filtr MUTATSIYA qilinmaydi", () => {
    const base = { active: true };
    withReportVisibility(base, userWithRole(ROLES.DEKAN, DEKAN_ID));
    expect(base).toEqual({ active: true });
  });
});

describe("buildFilter — `?status=` kalit to'qnashuvi cheklovni YUVMAYDI", () => {
  test("dekan `?status=submitted` — cheklov ham, so'rov ham qo'llanadi", () => {
    const filter = service.buildFilter(
      { teacher: { $in: [TEACHER_ID, OTHER_ID] } },
      { status: "submitted" },
      userWithRole(ROLES.DEKAN, DEKAN_ID),
    );
    expect(matches(filter, FOREIGN_SUBMITTED)).toBe(true);
    expect(matches(filter, FOREIGN_APPROVED)).toBe(false);
    expect(matches(filter, FOREIGN_DRAFT)).toBe(false);
  });

  test("dekan `?status=draft` bilan CHETLAB O'TISHGA urinish — 0 natija", () => {
    const filter = service.buildFilter(
      { teacher: { $in: [TEACHER_ID, OTHER_ID] } },
      { status: "draft" },
      userWithRole(ROLES.DEKAN, DEKAN_ID),
    );
    expect(matches(filter, FOREIGN_DRAFT)).toBe(false);
    expect(matches(filter, OWN_DRAFT)).toBe(false);
    expect(matches(filter, FOREIGN_SUBMITTED)).toBe(false);
  });

  test("fail-closed rol `?status=submitted` — to'qnashuv yo'q, hamon 0 natija", () => {
    const filter = service.buildFilter(
      {},
      { status: "submitted" },
      userWithRole(ROLES.ILMIY_BOLIM),
    );
    expect(matches(filter, FOREIGN_SUBMITTED)).toBe(false);
  });

  test("oqituvchi `?status=draft` — o'z qoralamasini ko'raveradi", () => {
    const filter = service.buildFilter(
      { teacher: TEACHER_ID },
      { status: "draft" },
      userWithRole(ROLES.OQITUVCHI, TEACHER_ID),
    );
    expect(matches(filter, OWN_DRAFT)).toBe(true);
    expect(matches(filter, FOREIGN_DRAFT)).toBe(false);
  });

  test("boshqa query filtrlari hamon qo'llanadi (regressiya)", () => {
    const filter = service.buildFilter(
      { teacher: TEACHER_ID },
      { status: "approved", semester: "2", academicYear: "y1", plan: "p1" },
      userWithRole(ROLES.OQITUVCHI, TEACHER_ID),
    );
    const flat = JSON.stringify(filter);
    expect(flat).toMatch(/"semester":2/);
    expect(flat).toMatch(/"academicYear":"y1"/);
    expect(flat).toMatch(/"plan":"p1"/);
    expect(flat).toMatch(/"active":true/);
  });
});

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createChain = (resolved = []) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolved);
  return chain;
};

beforeEach(() => jest.clearAllMocks());

describe("WIRING — findAll / paginate / exportRows / findOne", () => {
  test("findAll — fail-closed rol uchun filtr DB'ga uzatiladi", async () => {
    PersonalReportModel.find = jest.fn().mockReturnValue(createChain());

    await service.findAll({}, {}, userWithRole(ROLES.OQUV_USLUBIY_BOSHQARMA));

    const filter = PersonalReportModel.find.mock.calls[0][0];
    expect(matches(filter, FOREIGN_SUBMITTED)).toBe(false);
  });

  test("exportRows — xuddi shu filtr (eksport teshik qoldirmasin)", async () => {
    PersonalReportModel.find = jest.fn().mockReturnValue(createChain());

    await service.exportRows({}, {}, userWithRole(ROLES.ICHKI_NAZORAT));

    const filter = PersonalReportModel.find.mock.calls[0][0];
    expect(matches(filter, FOREIGN_SUBMITTED)).toBe(false);
  });

  test("paginate — filtr paginate'ga ham uzatiladi", async () => {
    PersonalReportModel.paginate = jest
      .fn()
      .mockResolvedValue({ docs: [], totalDocs: 0 });

    await service.paginate(
      { teacher: { $in: [TEACHER_ID, OTHER_ID] } },
      {},
      userWithRole(ROLES.DEKAN, DEKAN_ID),
    );

    const filter = PersonalReportModel.paginate.mock.calls[0][0];
    expect(matches(filter, FOREIGN_SUBMITTED)).toBe(true);
    expect(matches(filter, FOREIGN_DRAFT)).toBe(false);
  });

  test("findOne — detal yo'lida ham filtr bor (`/:id` bilan chetlab o'tilmaydi)", async () => {
    PersonalReportModel.findOne = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({ exec: () => Promise.resolve(null) }),
    });

    await service.findOne(REPORT_ID, {}, userWithRole(ROLES.ILMIY_BOLIM));

    const filter = PersonalReportModel.findOne.mock.calls[0][0];
    expect(filter._id).toBe(REPORT_ID);
    expect(matches(filter, FOREIGN_SUBMITTED)).toBe(false);
  });

  test("controller findAllReports — `req.user`ni service'ga uzatadi (aloqa uzilmasin)", async () => {
    PersonalReportModel.find = jest.fn().mockReturnValue(createChain());

    await Controller.findAllReports(
      {
        query: {},
        params: {},
        body: {},
        scope: { teacher: { $in: [TEACHER_ID, OTHER_ID] } },
        user: userWithRole(ROLES.DEKAN, DEKAN_ID),
      },
      createRes(),
      jest.fn(),
    );

    const filter = PersonalReportModel.find.mock.calls[0][0];
    expect(matches(filter, FOREIGN_SUBMITTED)).toBe(true);
    expect(matches(filter, FOREIGN_DRAFT)).toBe(false);
  });

  test("controller findOneReport — ko'rinmaydigan hujjat 404 (sabab oshkor etilmaydi)", async () => {
    PersonalReportModel.findOne = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({ exec: () => Promise.resolve(null) }),
    });
    const res = createRes();

    await Controller.findOneReport(
      {
        query: {},
        params: { id: REPORT_ID },
        body: {},
        scope: { teacher: { $in: [TEACHER_ID, OTHER_ID] } },
        user: userWithRole(ROLES.ILMIY_BOLIM),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Topilmadi" });
  });
});
