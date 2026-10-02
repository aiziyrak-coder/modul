jest.mock("#shared/rateLimiter", () => ({
  uploadLimiter: jest.fn(),
  authLoginIpLimiter: jest.fn(),
  authLoginPinLimiter: jest.fn(),
  authRefreshLimiter: jest.fn(),
}));

const rateLimiter = require("#shared/rateLimiter");
const loginLockGuard = require("../_loginLock/loginLock.guard");
const router = require("./auth.routes");

const loginChain = () => {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === "/" && l.route.methods.post,
  );
  return layer.route.stack.map((s) => s.handle);
};

describe("auth.routes — POST / (login) zanjiri", () => {
  test("mavjud ikki xotira-limiteri HALI HAM ulangan (D-016 regressiya qulfi)", () => {
    const chain = loginChain();

    expect(chain).toContain(rateLimiter.authLoginIpLimiter);
    expect(chain).toContain(rateLimiter.authLoginPinLimiter);
  });

  test("DOIMIY qulf guard'i zanjirda bor va Controller'dan OLDIN turadi", () => {
    const chain = loginChain();

    expect(chain).toContain(loginLockGuard);
    expect(chain.indexOf(loginLockGuard)).toBeLessThan(chain.length - 1);
  });

  test("tartib: IP limiter → PIN limiter → ... → qulf guard → Controller", () => {
    const chain = loginChain();

    const ip = chain.indexOf(rateLimiter.authLoginIpLimiter);
    const pin = chain.indexOf(rateLimiter.authLoginPinLimiter);
    const lock = chain.indexOf(loginLockGuard);

    expect(ip).toBeLessThan(pin);
    expect(pin).toBeLessThan(lock);
  });
});
