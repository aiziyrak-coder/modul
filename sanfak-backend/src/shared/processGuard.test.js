"use strict";

const { EventEmitter } = require("events");
const { installProcessGuard, describeError, EXIT_DELAY_MS } = require("./processGuard");

const mkLogger = () => {
  const l = new EventEmitter();
  l.error = jest.fn();
  l.warn = jest.fn();
  return l;
};

describe("shared/processGuard (L-09)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("unhandledRejection: stack bilan loglanadi, jarayon TO'XTAMAYDI", () => {
    const proc = new EventEmitter();
    const logger = mkLogger();
    const exit = jest.fn();
    installProcessGuard({ logger, proc, exit, stderrWrite: jest.fn() });

    proc.emit("unhandledRejection", new Error("unutilgan await"), Promise.resolve());
    jest.advanceTimersByTime(EXIT_DELAY_MS * 4);

    expect(logger.error).toHaveBeenCalledTimes(1);
    const msg = logger.error.mock.calls[0][0];
    expect(msg).toContain("unhandledRejection");
    expect(msg).toContain("unutilgan await");
    expect(msg).toContain("processGuard.test.js");
    expect(exit).not.toHaveBeenCalled();
  });

  test("unhandledRejection: Error bo'lmagan sabab ham o'qiladigan ko'rinishda", () => {
    const proc = new EventEmitter();
    const logger = mkLogger();
    installProcessGuard({ logger, proc, exit: jest.fn(), stderrWrite: jest.fn() });

    proc.emit("unhandledRejection", { code: "E_X", detail: 42 });
    expect(logger.error.mock.calls[0][0]).toContain('{"code":"E_X","detail":42}');
  });

  test("uncaughtException: stack bilan loglanadi, kechikish bilan exit(1)", () => {
    const proc = new EventEmitter();
    const logger = mkLogger();
    const exit = jest.fn();
    installProcessGuard({ logger, proc, exit, stderrWrite: jest.fn() });

    proc.emit("uncaughtException", new Error("sinxron portlash"), "uncaughtException");

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toContain("sinxron portlash");
    expect(exit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(EXIT_DELAY_MS);
    expect(exit).toHaveBeenCalledWith(1);
  });

  test("exit: chiqish kodi stderr'ga sinxron yoziladi", () => {
    const proc = new EventEmitter();
    const logger = mkLogger();
    const stderrWrite = jest.fn();
    installProcessGuard({ logger, proc, exit: jest.fn(), stderrWrite });

    proc.emit("exit", 1);
    expect(stderrWrite).toHaveBeenCalledTimes(1);
    expect(stderrWrite.mock.calls[0][0]).toContain("exit code=1");
  });

  test("logger 'error' hodisasi jarayonni o'ldirmaydi — stderr'ga yoziladi", () => {
    const proc = new EventEmitter();
    const logger = mkLogger();
    const stderrWrite = jest.fn();
    installProcessGuard({ logger, proc, exit: jest.fn(), stderrWrite });

    expect(() => logger.emit("error", new Error("EBUSY: combined.log"))).not.toThrow();
    expect(stderrWrite.mock.calls[0][0]).toContain("EBUSY: combined.log");
  });

  test("ikki marta o'rnatilsa tinglovchi dublikat bo'lmaydi; uninstall tozalaydi", () => {
    const proc = new EventEmitter();
    const logger = mkLogger();
    const h1 = installProcessGuard({ logger, proc, exit: jest.fn(), stderrWrite: jest.fn() });
    const h2 = installProcessGuard({ logger, proc, exit: jest.fn(), stderrWrite: jest.fn() });
    expect(h2).toBe(h1);
    expect(proc.listenerCount("unhandledRejection")).toBe(1);
    expect(proc.listenerCount("uncaughtException")).toBe(1);

    h1.uninstall();
    expect(proc.listenerCount("unhandledRejection")).toBe(0);
    expect(proc.listenerCount("uncaughtException")).toBe(0);
    expect(proc.listenerCount("exit")).toBe(0);
    expect(logger.listenerCount("error")).toBe(0);
  });

  test("logger'siz o'rnatib bo'lmaydi", () => {
    expect(() => installProcessGuard({ proc: new EventEmitter() })).toThrow(TypeError);
  });

  test("describeError: Error → stack, string → o'zi, obyekt → JSON", () => {
    expect(describeError(new Error("x"))).toContain("Error: x");
    expect(describeError("matn")).toBe("matn");
    expect(describeError({ a: 1 })).toBe('{"a":1}');
  });
});
