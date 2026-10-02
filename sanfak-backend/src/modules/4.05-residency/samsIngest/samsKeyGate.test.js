"use strict";

const KEY = "k".repeat(40);
process.env.SAMS_SERVICE_KEY = KEY;

const winston = require("#shared/winston.logger");
const { samsKeyGate, configuredKey } = require("./samsKeyGate");

const req = (headerValue) => ({
  get: (name) => (name.toLowerCase() === "x-sams-service-key" ? headerValue : undefined),
  ip: "10.0.0.7",
  originalUrl: "/api/residency-sams/roster?x=1",
});
const run = (headerValue) => {
  const next = jest.fn();
  samsKeyGate(req(headerValue), {}, next);
  return next;
};
const expect401 = (next) => {
  expect(next).toHaveBeenCalledTimes(1);
  const err = next.mock.calls[0][0];
  expect(err.statusCode).toBe(401);
  expect(err.meta).toEqual({ reason: "sams_key_invalid" });
};

let warn;
beforeEach(() => {
  process.env.SAMS_SERVICE_KEY = KEY;
  process.env.SERVICE_KEY = "listener-key-listener-key-listener-key";
  warn = jest.spyOn(winston, "warn").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.SAMS_SERVICE_KEY;
  delete process.env.SERVICE_KEY;
  jest.restoreAllMocks();
});

describe("401 sams_key_invalid — beshta holat", () => {
  it.each([
    ["kalit sozlanmagan", () => delete process.env.SAMS_SERVICE_KEY, KEY],
    ["kalit 31 belgi", () => (process.env.SAMS_SERVICE_KEY = "k".repeat(31)), "k".repeat(31)],
    ["kalit SERVICE_KEY bilan bir xil", () => (process.env.SERVICE_KEY = KEY), KEY],
    ["sarlavha yo'q", () => {}, undefined],
    ["noto'g'ri kalit", () => {}, "x".repeat(40)],
  ])("%s", (_label, arrange, header) => {
    arrange();
    const next = run(header);
    expect401(next);
    const logged = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("ip=10.0.0.7 path=/api/residency-sams/roster");
    expect(logged).not.toContain(KEY);
    expect(logged).not.toContain("x=1");
    if (header) expect(logged).not.toContain(header);
  });
});

describe("to'g'ri kalit va chekka holatlar", () => {
  it("to'g'ri kalit → next() argumentsiz, log yo'q", () => {
    const next = run(KEY);
    expect(next).toHaveBeenCalledWith();
    expect(warn).not.toHaveBeenCalled();
  });

  it("1 belgili sarlavha tashlamaydi (hazm solishtiriladi, uzunlik emas)", () => {
    expect(() => run("a")).not.toThrow();
    expect401(run("a"));
  });

  it("configuredKey — faqat ≥32 belgi va SERVICE_KEY dan farqli", () => {
    expect(configuredKey()).toBe(KEY);
    process.env.SAMS_SERVICE_KEY = "k".repeat(32);
    expect(configuredKey()).toBe("k".repeat(32));
    process.env.SERVICE_KEY = "k".repeat(32);
    expect(configuredKey()).toBeNull();
  });

  it("yuklanishda kalit yo'q bo'lsa BIR marta ogohlantiradi va tashlamaydi", () => {
    delete process.env.SAMS_SERVICE_KEY;
    let isolatedWarn;
    jest.isolateModules(() => {
      isolatedWarn = jest.spyOn(require("#shared/winston.logger"), "warn").mockImplementation(() => {});
      expect(() => require("./samsKeyGate")).not.toThrow();
    });
    expect(isolatedWarn).toHaveBeenCalledTimes(1);
    expect(isolatedWarn.mock.calls[0][0]).toContain("SAMS_SERVICE_KEY sozlanmagan");
  });
});
