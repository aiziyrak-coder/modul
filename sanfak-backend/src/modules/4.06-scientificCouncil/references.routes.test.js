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

const router = require("./references.routes");

function stackFor(method, path) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method],
  );
  if (!layer) throw new Error(`Route topilmadi: ${method.toUpperCase()} ${path}`);
  return layer.route.stack.map((s) => s.handle);
}

function permitOf(handlers) {
  const mw = handlers.find((h) => h._module);
  if (!mw) throw new Error("permit() middleware topilmadi");
  return mw;
}

describe("references.routes — /staff ruxsati (PII, ikki rol)", () => {
  test("GET /staff — manageMembers VA submitWork (OR), boshqa amal YO'Q", () => {
    const permitMw = permitOf(stackFor("get", "/staff"));

    expect(permitMw._module).toBe(MODULES.SCIENCE_COUNCIL);
    expect(permitMw._actions).toEqual(
      expect.arrayContaining([ACTIONS.MANAGE_MEMBERS, ACTIONS.SUBMIT_WORK]),
    );
    expect(permitMw._actions).toHaveLength(2);
  });
});

describe("references.routes — lug'at endpointlari (fakultet/kafedra/bo'lim) — read", () => {
  test.each([
    ["get", "/faculties"],
    ["get", "/departments"],
    ["get", "/divisions"],
  ])("%s %s — faqat scienceCouncil:read", (m, p) => {
    const permitMw = permitOf(stackFor(m, p));

    expect(permitMw._module).toBe(MODULES.SCIENCE_COUNCIL);
    expect(permitMw._actions).toEqual([ACTIONS.READ]);
  });
});
