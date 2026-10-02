const path = require("path");

const { MODULES, ACTIONS } = require("../src/config/constants");
const { MANAGER_ROLE } = require("./malaka-manager.seed");
const { TEACHER_PERMISSIONS } = require("./malaka-teacher.seed");
const { TINGLOVCHI_PERMISSIONS } = require("./malaka-tinglovchi.seed");

function loadRoutes(relPath) {
  return require(path.join("..", "src", "modules", "4.04-qualification", relPath));
}

function firstHandler(router, routePath, method) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === routePath && l.route.methods[method],
  );
  if (!layer) throw new Error(`Route topilmadi: ${method.toUpperCase()} ${routePath}`);
  const stackEntry = layer.route.stack.find((s) => s.method === method);
  return stackEntry.handle;
}

function runPermit(handler, permissions) {
  const req = {
    user: { role: { title: "test-role", active: true, permissions } },
    method: "POST",
    originalUrl: "/test",
  };
  let result;
  handler(req, {}, (err) => {
    result = err ? err.statusCode : "NEXT-OK";
  });
  return result;
}

describe("D-031: savol-banki route'lari — permit() ENDI eski natija sectionini qabul qilmaydi", () => {
  test.each([
    ["qualAccessTest/qualAccessTest.routes", "/", "post", MODULES.QUAL_ACCESS_TEST_RESULT, MODULES.QUAL_ACCESS_TEST],
    ["qualExitTest/qualExitTest.routes", "/", "post", MODULES.QUAL_EXIT_TEST_RESULT, MODULES.QUAL_EXIT_TEST],
    ["qualTestConfig/qualTestConfig.routes", "/", "put", MODULES.QUAL_ACCESS_TEST_RESULT, MODULES.QUAL_TEST_CONFIG],
  ])(
    "%s [%s %s]: eski *_RESULT granti bilan 403, yangi dedicated section bilan o'tadi",
    (modulePath, routePath, method, oldSection, newSection) => {
      const router = loadRoutes(modulePath);
      const handler = firstHandler(router, routePath, method);
      const action = method === "post" ? ACTIONS.CREATE : ACTIONS.UPDATE;

      const oldGrantResult = runPermit(handler, [
        { section: oldSection, actionKeys: [action] },
      ]);
      expect(oldGrantResult).toBe(403);

      const newGrantResult = runPermit(handler, [
        { section: newSection, actionKeys: [action] },
      ]);
      expect(newGrantResult).toBe("NEXT-OK");
    },
  );
});

const sectionsOf = (permissions) => permissions.map((p) => p.section);
const actionsFor = (permissions, section) =>
  permissions.find((p) => p.section === section)?.actionKeys || [];

describe("D-031: malaka_tinglovchi savol-bankiga TEGMAYDI (asosiy maqsad)", () => {
  test.each([MODULES.QUAL_ACCESS_TEST, MODULES.QUAL_EXIT_TEST, MODULES.QUAL_TEST_CONFIG])(
    "malaka_tinglovchi permissionlarida %s section YO'Q",
    (section) => {
      expect(sectionsOf(TINGLOVCHI_PERMISSIONS)).not.toContain(section);
    },
  );

  test("REGRESSIYA: tinglovchi o'z natijasini hali ham yoza oladi (create+update natija sectionida)", () => {
    expect(actionsFor(TINGLOVCHI_PERMISSIONS, MODULES.QUAL_ACCESS_TEST_RESULT)).toEqual(
      expect.arrayContaining([ACTIONS.CREATE, ACTIONS.UPDATE]),
    );
    expect(actionsFor(TINGLOVCHI_PERMISSIONS, MODULES.QUAL_EXIT_TEST_RESULT)).toEqual(
      expect.arrayContaining([ACTIONS.CREATE, ACTIONS.UPDATE]),
    );
  });
});

describe("D-031: malaka_menejer va malaka_oqituvchi savol-banki CRUD oladi", () => {
  test.each([
    ["malaka_menejer", MANAGER_ROLE.permissions],
    ["malaka_oqituvchi", TEACHER_PERMISSIONS],
  ])("%s — QUAL_ACCESS_TEST va QUAL_EXIT_TEST'da to'liq CRUD", (_title, permissions) => {
    for (const section of [MODULES.QUAL_ACCESS_TEST, MODULES.QUAL_EXIT_TEST]) {
      expect(actionsFor(permissions, section)).toEqual(
        expect.arrayContaining([
          ACTIONS.CREATE,
          ACTIONS.READ_ALL,
          ACTIONS.UPDATE,
          ACTIONS.DELETE,
        ]),
      );
    }
  });

  test.each([
    ["malaka_menejer", MANAGER_ROLE.permissions],
    ["malaka_oqituvchi", TEACHER_PERMISSIONS],
  ])("%s — QUAL_TEST_CONFIG'da READ+UPDATE (singleton, create/delete yo'q)", (_title, permissions) => {
    expect(actionsFor(permissions, MODULES.QUAL_TEST_CONFIG)).toEqual(
      expect.arrayContaining([ACTIONS.READ, ACTIONS.UPDATE]),
    );
  });
});
