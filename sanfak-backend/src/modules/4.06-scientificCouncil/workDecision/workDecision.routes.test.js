const { ACTIONS, MODULES } = require("#config/constants");

jest.mock("#shared/permission", () =>
  jest.fn((moduleName, actions) => {
    const mw = (req, _res, next) => next();
    mw._module = moduleName;
    mw._actions = actions;
    return mw;
  }),
);
jest.mock("#shared/authenticate", () => (req, _res, next) => next());

const mockScopeFilterSpy = jest.fn();
jest.mock("#shared/scopeFilter", () => (...args) => {
  mockScopeFilterSpy(...args);
  return (req, _res, next) => next();
});

jest.mock("#modules/4.06-scientificCouncil/_services/workAccess", () => ({
  requireWorkReadAccess: jest.fn((paramName) => {
    const mw = (req, _res, next) => next();
    mw._paramName = paramName;
    return mw;
  }),
  requireWorkReadAccessFromBody: jest.fn((field) => {
    const mw = (req, _res, next) => next();
    mw._bodyField = field;
    return mw;
  }),
}));

jest.mock("./workDecision.access", () => {
  const mw = (req, _res, next) => next();
  mw._guard = "decisionRead";
  return { requireDecisionReadAccess: mw };
});

jest.mock("./workDecision.controller", () => ({
  addDecision: jest.fn(),
  findDecisionsByWork: jest.fn(),
  getDalolatnomaPdf: jest.fn(),
  signDecision: jest.fn(),
}));

const {
  requireWorkReadAccess,
} = require("#modules/4.06-scientificCouncil/_services/workAccess");
const router = require("./workDecision.routes");

function stackFor(method, path) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method],
  );
  if (!layer) throw new Error(`route topilmadi: ${method.toUpperCase()} ${path}`);
  return layer.route.stack
    .filter((s) => !s.method || s.method === method)
    .map((s) => s.handle);
}

describe("workDecision.routes — GET /work/:workId scope o'rniga ish-kirish tekshiruvi", () => {
  test("requireWorkReadAccess('workId') bilan himoyalangan", () => {
    const handlers = stackFor("get", "/work/:workId");
    const guard = handlers.find((h) => h._paramName);

    expect(guard).toBeDefined();
    expect(guard._paramName).toBe("workId");
    expect(requireWorkReadAccess).toHaveBeenCalledWith("workId");
  });

  test("#shared/scopeFilter endi UMUMAN chaqirilmaydi", () => {
    stackFor("get", "/work/:workId");
    expect(mockScopeFilterSpy).not.toHaveBeenCalled();
  });

  test("permitReadAll — readAll action'ini talab qiladi", () => {
    const handlers = stackFor("get", "/work/:workId");
    const permitMw = handlers.find((h) => h._actions);

    expect(permitMw._module).toBe(MODULES.WORK_DECISION);
    expect(permitMw._actions).toEqual([ACTIONS.READ_ALL]);
  });
});

describe("workDecision.routes — GET /:id/dalolatnoma IDOR guardi", () => {
  test("requireDecisionReadAccess bilan himoyalangan", () => {
    const handlers = stackFor("get", "/:id/dalolatnoma");

    expect(handlers.some((h) => h._guard === "decisionRead")).toBe(true);
  });

  test("guard permit()dan KEYIN turadi — ruxsatsiz rol DB o'qimasdan 403 oladi", () => {
    const handlers = stackFor("get", "/:id/dalolatnoma");
    const permitIdx = handlers.findIndex((h) => h._actions);
    const guardIdx = handlers.findIndex((h) => h._guard === "decisionRead");

    expect(permitIdx).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeGreaterThan(permitIdx);
  });

  test("permitReadAll — workDecision:readAll talab qilinadi", () => {
    const handlers = stackFor("get", "/:id/dalolatnoma");
    const permitMw = handlers.find((h) => h._actions);

    expect(permitMw._module).toBe(MODULES.WORK_DECISION);
    expect(permitMw._actions).toEqual([ACTIONS.READ_ALL]);
  });
});
