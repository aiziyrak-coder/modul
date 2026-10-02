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

jest.mock("./workReview.access", () => {
  const mw = (req, _res, next) => next();
  mw._guard = "reviewWrite";
  const docMw = (req, _res, next) => next();
  docMw._guard = "docAssignment";
  return { requireReviewWriteAccess: mw, requireDocAssignment: docMw };
});

jest.mock("./workReview.controller", () => ({
  addReview: jest.fn(),
  findReviewsByWork: jest.fn(),
  updateReview: jest.fn(),
  deleteReview: jest.fn(),
}));

const {
  requireWorkReadAccess,
  requireWorkReadAccessFromBody,
} = require("#modules/4.06-scientificCouncil/_services/workAccess");
const router = require("./workReview.routes");

function stackFor(method, path) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method],
  );
  if (!layer) throw new Error(`route topilmadi: ${method.toUpperCase()} ${path}`);
  return layer.route.stack
    .filter((s) => !s.method || s.method === method)
    .map((s) => s.handle);
}

describe("workReview.routes — GET /work/:workId scope o'rniga ish-kirish tekshiruvi", () => {
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

    expect(permitMw._module).toBe(MODULES.WORK_REVIEW);
    expect(permitMw._actions).toEqual([ACTIONS.READ_ALL]);
  });
});

describe("workReview.routes — POST / (ish id'si BODY'dan) IDOR guardi", () => {
  test("requireWorkReadAccessFromBody('work') bilan himoyalangan", () => {
    const handlers = stackFor("post", "/");
    const guard = handlers.find((h) => h._bodyField);

    expect(guard).toBeDefined();
    expect(guard._bodyField).toBe("work");
    expect(requireWorkReadAccessFromBody).toHaveBeenCalledWith("work");
  });

  test("tartib: permit → validator → guard → docAssignment → controller", () => {
    const handlers = stackFor("post", "/");
    const permitIdx = handlers.findIndex((h) => h._actions);
    const guardIdx = handlers.findIndex((h) => h._bodyField);
    const docAssignmentIdx = handlers.findIndex(
      (h) => h._guard === "docAssignment",
    );

    expect(permitIdx).toBe(0);
    expect(guardIdx).toBeGreaterThan(permitIdx + 1);
    expect(docAssignmentIdx).toBe(guardIdx + 1);
    expect(docAssignmentIdx).toBe(handlers.length - 2);
  });

  test("requireDocAssignment bilan himoyalangan (D-027a)", () => {
    const handlers = stackFor("post", "/");

    expect(handlers.some((h) => h._guard === "docAssignment")).toBe(true);
  });
});

describe("workReview.routes — PUT /:id egalik guardi", () => {
  test("requireReviewWriteAccess bilan himoyalangan", () => {
    const handlers = stackFor("put", "/:id");

    expect(handlers.some((h) => h._guard === "reviewWrite")).toBe(true);
  });

  test("permitUpdate — workReview:update talab qilinadi", () => {
    const handlers = stackFor("put", "/:id");
    const permitMw = handlers.find((h) => h._actions);

    expect(permitMw._module).toBe(MODULES.WORK_REVIEW);
    expect(permitMw._actions).toEqual([ACTIONS.UPDATE]);
  });

  test("DELETE /:id ATAYLAB guardsiz — workReview:delete faqat kotibda (global)", () => {
    const handlers = stackFor("delete", "/:id");
    const permitMw = handlers.find((h) => h._actions);

    expect(handlers.some((h) => h._guard === "reviewWrite")).toBe(false);
    expect(permitMw._actions).toEqual([ACTIONS.DELETE]);
  });
});
