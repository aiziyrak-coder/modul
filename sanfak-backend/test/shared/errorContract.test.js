"use strict";

const fs = require("fs");
const path = require("path");
const { ErrorHandler, handleError } = require("#shared/error");

jest.mock("#shared/winston.logger", () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("shared/error — handleError status kontrakti", () => {
  test("ErrorHandler(404) → HTTP 404", () => {
    const res = mockRes();
    handleError(new ErrorHandler(404, "Topilmadi"), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: "Topilmadi" }),
    );
  });

  test("ErrorHandler(400, msg, detail) → detail ham qaytadi", () => {
    const res = mockRes();
    handleError(new ErrorHandler(400, "PDF xatolik", "stack izi"), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, detail: "stack izi" }),
    );
  });

  test("plain { status: 404 } obyekti → 500 (shuning uchun ishlatilmaydi)", () => {
    const res = mockRes();
    handleError({ status: 404, message: "Topilmadi" }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.status).not.toHaveBeenCalledWith(404);
  });

  test("statusCode yo'q bo'lsa 500 ga tushadi (fallback saqlanadi)", () => {
    const res = mockRes();
    handleError(new Error("kutilmagan"), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("REGRESSION-GUARD — next({ status: ... }) anti-pattern qaytmasin", () => {
  const SRC = path.join(__dirname, "../../src");

  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (e.name.endsWith(".js") && !e.name.endsWith(".test.js")) out.push(p);
    }
    return out;
  };

  const RE = /next\(\{\s*status:\s*\d+/;

  test("src/ da hech bir joyda next({ status: ... }) yo'q", () => {
    const buzganlar = [];
    for (const file of walk(SRC)) {
      const src = fs.readFileSync(file, "utf8");
      if (RE.test(src)) {
        buzganlar.push(path.relative(SRC, file).replace(/\\/g, "/"));
      }
    }
    expect(buzganlar).toEqual([]);
  });

  test("skaner haqiqatan ishlaydi (o'z-o'zini tekshirish)", () => {
    expect(RE.test('if (!doc) return next({ status: 404, message: "x" });')).toBe(true);
    expect(RE.test("return next({\n  status: 400,\n  message: 'x',\n})")).toBe(true);
    expect(RE.test('return next(new ErrorHandler(404, "x"))')).toBe(false);
  });
});
