const capturedOptions = [];

jest.mock("express-rate-limit", () => {
  const fn = jest.fn((opts) => {
    capturedOptions.push(opts);
    return jest.fn();
  });
  fn.ipKeyGenerator = jest.fn((ip) => `ip:${ip}`);
  return fn;
});

jest.mock("jsonwebtoken");

const jwt = require("jsonwebtoken");

require("#shared/rateLimiter");

const AUTH_REFRESH_INDEX = 2;
const VALID_ID = "507f1f77bcf86cd799439011";

const getRefreshKeyGenerator = () => {
  const opts = capturedOptions[AUTH_REFRESH_INDEX];
  expect(opts).toBeDefined();
  expect(typeof opts.keyGenerator).toBe("function");
  return opts.keyGenerator;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("authRefreshLimiter — keyGenerator (R-AUTH-05: jwt.verify, jwt.decode EMAS)", () => {
  test("soxta imzoli token (jwt.verify rad etadi) → IP kaliti, qurbon _id ishlatilmaydi", () => {
    jwt.verify.mockImplementation(() => {
      const err = new Error("invalid signature");
      err.name = "JsonWebTokenError";
      throw err;
    });
    const keyGenerator = getRefreshKeyGenerator();

    const key = keyGenerator({
      body: { refreshToken: "soxta.imzo.qurbon-id-bilan" },
      ip: "10.0.0.5",
    });

    expect(key).toBe("ip:10.0.0.5");
  });

  test("haqiqiy (imzosi to'g'ri) token, muddati o'tgan bo'lsa ham → `u:<id>`", () => {
    jwt.verify.mockReturnValue({ _id: VALID_ID });
    const keyGenerator = getRefreshKeyGenerator();

    const key = keyGenerator({ body: { refreshToken: "a.b.c" }, ip: "10.0.0.5" });

    expect(key).toBe(`u:${VALID_ID}`);
    expect(jwt.verify).toHaveBeenCalledWith(
      "a.b.c",
      process.env.REFRESH_TOKEN_SECRET,
      { ignoreExpiration: true },
    );
  });

  test("jwt.decode ENDI ishlatilmaydi — faqat jwt.verify", () => {
    jwt.verify.mockReturnValue({ _id: VALID_ID });
    const keyGenerator = getRefreshKeyGenerator();

    keyGenerator({ body: { refreshToken: "a.b.c" }, ip: "10.0.0.5" });

    expect(jwt.decode).not.toHaveBeenCalled();
  });

  test("buzuq `_id` (ObjectId shakliga mos emas) → IP zaxirasi (kalit-o'smasi oldini olish)", () => {
    jwt.verify.mockReturnValue({ _id: "juda-uzun-yoki-begubor-qiymat-".repeat(10) });
    const keyGenerator = getRefreshKeyGenerator();

    const key = keyGenerator({ body: { refreshToken: "a.b.c" }, ip: "10.0.0.9" });

    expect(key).toBe("ip:10.0.0.9");
  });

  test("`_id` topilmasa (bo'sh payload) → IP zaxirasi", () => {
    jwt.verify.mockReturnValue({});
    const keyGenerator = getRefreshKeyGenerator();

    const key = keyGenerator({ body: { refreshToken: "a.b.c" }, ip: "10.0.0.9" });

    expect(key).toBe("ip:10.0.0.9");
  });

  test("body.refreshToken umuman yo'q → IP zaxirasi, jwt.verify chaqirilmaydi", () => {
    const keyGenerator = getRefreshKeyGenerator();

    const key = keyGenerator({ body: {}, ip: "10.0.0.9" });

    expect(key).toBe("ip:10.0.0.9");
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  test("jwt.verify muddati tugagan xato tashlasa (ignoreExpiration ishlamagan taqdirda ham) → IP zaxirasi, yiqilmaydi", () => {
    jwt.verify.mockImplementation(() => {
      const err = new Error("jwt expired");
      err.name = "TokenExpiredError";
      throw err;
    });
    const keyGenerator = getRefreshKeyGenerator();

    const key = keyGenerator({ body: { refreshToken: "x" }, ip: "10.0.0.9" });

    expect(key).toBe("ip:10.0.0.9");
  });
});
