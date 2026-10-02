const { DEV_ENVS, isDevEnv } = require("#shared/env");
const requireEri = require("#shared/requireEri");
const { createMockNext } = require("../helpers/mockResponse");

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe("shared/env — isDevEnv", () => {
  test.each(DEV_ENVS)("'%s' — dev muhit (true)", (value) => {
    expect(isDevEnv(value)).toBe(true);
  });

  test("katta-kichik harf farq qilmaydi ('DEV', 'Development')", () => {
    expect(isDevEnv("DEV")).toBe(true);
    expect(isDevEnv("Development")).toBe(true);
  });

  test.each([
    ["production", "prod muhit"],
    ["", "bo'sh qiymat"],
    [null, "null"],
    ["Production", "katta harf bilan"],
    ["PRODUCTION", "hammasi katta harf"],
    ["prod", "qisqartma"],
    ["prod-1", "noma'lum qiymat"],
    ["staging", "boshqa muhit"],
  ])("'%s' (%s) — dev EMAS (false)", (value) => {
    expect(isDevEnv(value)).toBe(false);
  });

  test("argumentsiz chaqiruv process.env.NODE_ENV ni JORIY holatda o'qiydi", () => {
    process.env.NODE_ENV = "qa";
    expect(isDevEnv()).toBe(true);
    process.env.NODE_ENV = "prod";
    expect(isDevEnv()).toBe(false);
  });

  test("NODE_ENV umuman o'chirilgan bo'lsa ham false (fail-closed)", () => {
    delete process.env.NODE_ENV;
    expect(isDevEnv()).toBe(false);
  });

  test("aniq `undefined` berilsa default parametr → process.env o'qiladi", () => {
    process.env.NODE_ENV = "production";
    expect(isDevEnv(undefined)).toBe(false);
    delete process.env.NODE_ENV;
    expect(isDevEnv(undefined)).toBe(false);
  });
});

describe("requireEri({ optional: isDevEnv() }) — imzosiz so'rov", () => {
  const run = async (middleware, req) => {
    const next = createMockNext();
    await middleware(req, {}, next);
    return next.mock.calls[0]?.[0];
  };

  test("noma'lum NODE_ENV — ERI MAJBURIY (400)", async () => {
    process.env.NODE_ENV = "Production";
    const err = await run(requireEri({ optional: isDevEnv() }), { body: {} });
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });

  test("bo'sh NODE_ENV — ERI MAJBURIY (400)", async () => {
    process.env.NODE_ENV = "";
    const err = await run(requireEri({ optional: isDevEnv() }), { body: {} });
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });

  test("production — ERI MAJBURIY (400)", async () => {
    process.env.NODE_ENV = "production";
    const err = await run(requireEri({ optional: isDevEnv() }), { body: {} });
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });

  test("development — mavjud qulaylik saqlanadi (imzosiz o'tadi)", async () => {
    process.env.NODE_ENV = "development";
    const err = await run(requireEri({ optional: isDevEnv() }), { body: {} });
    expect(err).toBeUndefined();
  });
});
