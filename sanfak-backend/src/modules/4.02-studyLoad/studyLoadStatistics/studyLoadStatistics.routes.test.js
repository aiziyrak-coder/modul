const mockPermitMiddleware = jest.fn((req, res, next) => next());
const mockScopeMiddleware = jest.fn((req, res, next) => next());
const mockValidatorMiddleware = jest.fn((req, res, next) => next());

jest.mock("#shared/authenticate", () => jest.fn());
jest.mock("#shared/permission", () => jest.fn(() => mockPermitMiddleware));
jest.mock("#shared/scopeFilter", () => jest.fn(() => mockScopeMiddleware));
jest.mock("#shared/validator", () => ({ query: jest.fn(() => mockValidatorMiddleware) }));

const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const validator = require("#shared/validator");
const { MODULES, ACTIONS } = require("#config/constants");
const { oubQuery } = require("./studyLoadStatistics.validation");
const Controller = require("./studyLoadStatistics.controller");
const router = require("./studyLoadStatistics.routes");

const chainFor = (path, method = "get") => {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method],
  );
  return layer ? layer.route.stack.map((s) => s.handle) : null;
};

describe("studyLoadStatistics.routes — oub-* gate zanjiri (permit → scopeFilter → validator → Controller)", () => {
  test.each([
    ["/oub-overview", "oubOverview"],
    ["/oub-faculties", "oubFaculties"],
    ["/oub-teachers", "oubTeachers"],
  ])("%s — to'liq zanjir joyida", (path, controllerKey) => {
    const chain = chainFor(path);
    expect(chain).toEqual([
      mockPermitMiddleware,
      mockScopeMiddleware,
      mockValidatorMiddleware,
      Controller[controllerKey],
    ]);
  });

  test("permit() statistics:read bilan chaqirilgan", () => {
    expect(permit).toHaveBeenCalledWith(MODULES.STATISTICS, [ACTIONS.READ]);
  });

  test("scopeFilter() 'faculty' bilan chaqirilgan", () => {
    expect(scopeFilter).toHaveBeenCalledWith("faculty");
  });

  test("validator.query() 3 marta, har birida oubQuery sxemasi bilan chaqirilgan", () => {
    expect(validator.query).toHaveBeenCalledTimes(3);
    expect(validator.query).toHaveBeenCalledWith(oubQuery);
  });
});

describe("studyLoadStatistics.routes — /overview (mavjud, TEGILMAGAN)", () => {
  test("workload:readAll bilan qoladi — oub-* gate bilan aralashmaydi", () => {
    const chain = chainFor("/overview");
    expect(chain).toEqual([mockPermitMiddleware, Controller.overview]);
    expect(permit).toHaveBeenCalledWith(MODULES.WORKLOAD, [ACTIONS.READ_ALL]);
  });
});
