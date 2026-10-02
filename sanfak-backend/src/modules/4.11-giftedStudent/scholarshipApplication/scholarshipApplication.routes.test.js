const { ACTIONS, MODULES } = require("#config/constants");

const permitCalls = [];
jest.mock("#shared/permission", () =>
  jest.fn((moduleName, actions) => {
    const mw = (req, _res, next) => next();
    mw._module = moduleName;
    mw._actions = actions;
    return mw;
  }),
);
jest.mock("#shared/authenticate", () => (req, _res, next) => next());
jest.mock("#shared/scopeFilter", () => () => (req, _res, next) => next());
jest.mock("./scholarshipApplication.controller", () => ({
  applyForScholarship: jest.fn(),
  getMyApplications: jest.fn(),
  findByStudent: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  reviewApplication: jest.fn(),
  scoreApplication: jest.fn(),
  delete: jest.fn(),
}));

const router = require("./scholarshipApplication.routes");

function permitFor(method, path) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method],
  );
  if (!layer) throw new Error(`route topilmadi: ${method.toUpperCase()} ${path}`);
  return layer.route.stack.map((s) => s.handle).find((h) => h._actions);
}

describe("scholarshipApplication.routes — review guard", () => {
  test("PUT /:id/review FAQAT `update` action'ini talab qiladi", () => {
    const mw = permitFor("put", "/:id/review");
    expect(mw._module).toBe(MODULES.SCHOLARSHIP_APPLICATION);
    expect(mw._actions).toEqual([ACTIONS.UPDATE]);
    expect(mw._actions).not.toContain(ACTIONS.READ_ALL);
  });

  test("GET / va GET /:id o'qish uchun readAll'ga ruxsat beradi", () => {
    for (const [m, p] of [
      ["get", "/"],
      ["get", "/:id"],
      ["get", "/by-student/:studentId"],
    ]) {
      const mw = permitFor(m, p);
      expect(mw._actions).toContain(ACTIONS.READ_ALL);
    }
  });

  test("PUT /:id/score faqat `score` action'ini talab qiladi (hakam)", () => {
    const mw = permitFor("put", "/:id/score");
    expect(mw._actions).toEqual([ACTIONS.SCORE]);
  });

  test("DELETE /:id faqat `delete` action'ini talab qiladi", () => {
    const mw = permitFor("delete", "/:id");
    expect(mw._actions).toEqual([ACTIONS.DELETE]);
  });

  test("POST /apply talaba action'lari bilan (create/read)", () => {
    const mw = permitFor("post", "/apply");
    expect(mw._actions).toEqual([ACTIONS.CREATE, ACTIONS.READ]);
  });
});
