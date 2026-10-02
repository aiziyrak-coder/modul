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

jest.mock("./scientificWork.scope", () => {
  const mw = (req, _res, next) => next();
  mw._guard = "scope";
  return mw;
});

jest.mock("./scientificWork.access", () => {
  const read = (req, _res, next) => next();
  read._guard = "read";
  const write = (req, _res, next) => next();
  write._guard = "write";
  return { requireReadAccess: read, requireWriteAccess: write };
});

jest.mock("#shared/uploadFiles", () => {
  const up = (req, _res, next) => next();
  up._guard = "upload";
  const rs = (req, _res, next) => next();
  rs._guard = "resize";
  return { uploadImages: up, resizeImages: rs };
});

jest.mock("./scientificWork.controller", () => ({
  addWork: jest.fn(),
  findAllWorks: jest.fn(),
  findMyWorks: jest.fn(),
  paginateWorks: jest.fn(),
  findOneWork: jest.fn(),
  updateWork: jest.fn(),
  deleteWork: jest.fn(),
  changeStatus: jest.fn(),
  acceptApplication: jest.fn(),
  updateSeminarResult: jest.fn(),
  updateSeminarDate: jest.fn(),
  updateDefenseDate: jest.fn(),
  updateDefenseResult: jest.fn(),
  updateMembers: jest.fn(),
  updateDocAssignments: jest.fn(),
  uploadDocumentByBody: jest.fn(),
  uploadDocument: jest.fn(),
  uploadWorkFile: jest.fn(),
  generateProtocol: jest.fn(),
  signProtocol: jest.fn(),
  makeDecision: jest.fn(),
  memberDecision: jest.fn(),
}));

const router = require("./scientificWork.routes");

function stackFor(method, path) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method],
  );
  if (!layer) throw new Error(`route topilmadi: ${method.toUpperCase()} ${path}`);
  return layer.route.stack
    .filter((s) => !s.method || s.method === method)
    .map((s) => s.handle);
}

const guards = (handlers) => handlers.filter((h) => h._guard).map((h) => h._guard);
const permitOf = (handlers) => handlers.find((h) => h._actions);

describe("scientificWork.routes — ro'yxat scope'i", () => {
  test.each([
    ['get', '/'],
    ['get', '/paginate'],
  ])("%s %s — permitReadAll + modul-lokal scope resolver", (m, p) => {
    const handlers = stackFor(m, p);

    expect(guards(handlers)).toContain('scope');
    expect(permitOf(handlers)._module).toBe(MODULES.SCIENTIFIC_WORK);
    expect(permitOf(handlers)._actions).toEqual([ACTIONS.READ_ALL]);
  });

  test("#shared/scopeFilter UMUMAN chaqirilmaydi", () => {
    expect(mockScopeFilterSpy).not.toHaveBeenCalled();
  });
});

describe("scientificWork.routes — by-ID egalik guardlari", () => {
  test("GET /:id — permitFindOne + requireReadAccess", () => {
    const handlers = stackFor('get', '/:id');

    expect(guards(handlers)).toContain('read');
    expect(permitOf(handlers)._actions).toEqual([ACTIONS.READ]);
  });

  test("PUT /:id — requireWriteAccess UPLOAD'dan OLDIN", () => {
    const g = guards(stackFor('put', '/:id'));

    expect(g).toContain('write');
    expect(g.indexOf('write')).toBeLessThan(g.indexOf('upload'));
    expect(g.indexOf('write')).toBeLessThan(g.indexOf('resize'));
  });

  test.each([
    ['post', '/:id/documents'],
    ['post', '/:id/documents/:docKey/upload'],
    ['post', '/:id/work-file'],
  ])("%s %s — guard upload'dan oldin", (m, p) => {
    const g = guards(stackFor(m, p));

    expect(g.indexOf('write')).toBeGreaterThanOrEqual(0);
    expect(g.indexOf('write')).toBeLessThan(g.indexOf('upload'));
  });
});

describe("scientificWork.routes — retsenzent tayinlash muallifda EMAS (audit F2)", () => {
  test.each([
    ['patch', '/:id/members'],
    ['put', '/:id/assignments'],
    ['patch', '/:id/assignments'],
    ['patch', '/:id/doc-assignments'],
  ])("%s %s — manageMembers talab qilinadi, update EMAS", (m, p) => {
    const permitMw = permitOf(stackFor(m, p));

    expect(permitMw._module).toBe(MODULES.SCIENCE_COUNCIL);
    expect(permitMw._actions).toEqual([ACTIONS.MANAGE_MEMBERS]);
  });
});

describe("scientificWork.routes — seminar natijasi muallifda EMAS", () => {
  test("PATCH /:id/seminar-result — permitApprove, egalik guardi YO'Q", () => {
    const handlers = stackFor('patch', '/:id/seminar-result');
    const permitMw = permitOf(handlers);

    expect(permitMw._module).toBe(MODULES.SCIENTIFIC_WORK);
    expect(permitMw._actions).toEqual([ACTIONS.APPROVE]);
    expect(guards(handlers)).not.toContain('write');
  });

  test("PATCH /:id/defense-result — permitApprove, egalik guardi YO'Q", () => {
    const handlers = stackFor('patch', '/:id/defense-result');
    const permitMw = permitOf(handlers);

    expect(permitMw._module).toBe(MODULES.SCIENTIFIC_WORK);
    expect(permitMw._actions).toEqual([ACTIONS.APPROVE]);
    expect(guards(handlers)).not.toContain('write');
  });

  test("PATCH /:id/accept — permitApprove, egalik guardi YO'Q", () => {
    const handlers = stackFor('patch', '/:id/accept');
    const permitMw = permitOf(handlers);

    expect(permitMw._module).toBe(MODULES.SCIENTIFIC_WORK);
    expect(permitMw._actions).toEqual([ACTIONS.APPROVE]);
    expect(guards(handlers)).not.toContain('write');
  });
});

describe("scientificWork.routes — route tartibi (bug pattern 12.2)", () => {
  test("/paginate literal route `/:id` dan OLDIN ro'yxatdan o'tgan", () => {
    const paths = router.stack.filter((l) => l.route).map((l) => l.route.path);

    expect(paths.indexOf('/paginate')).toBeLessThan(paths.indexOf('/:id'));
  });
});
