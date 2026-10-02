"use strict";

const fs = require("fs");
const path = require("path");
const Joi = require("joi");
const validator = require("#shared/validator");
const { handleError } = require("#shared/error");

jest.mock("#shared/winston.logger", () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const schema = Joi.object({
  semester: Joi.number().valid(1, 2).required(),
  title: Joi.string().required(),
});

const run = (middleware, req) =>
  new Promise((resolve) => middleware(req, {}, (err) => resolve(err)));

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("#shared/validator — Joi xatosi loyiha shakliga aylantiriladi", () => {
  test("to'g'ri body — xatosiz o'tadi", async () => {
    const err = await run(validator.body(schema), {
      body: { semester: 1, title: "Test" },
    });

    expect(err).toBeUndefined();
  });

  test("buzilgan body — ErrorHandler(400) qaytadi, matn EMAS", async () => {
    const err = await run(validator.body(schema), {
      body: { semester: 3, title: "Test" },
    });

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    expect(typeof err.message).toBe("string");
    expect(err.message.length).toBeGreaterThan(0);
    expect(err.message).toContain("semester");
  });

  test("bir nechta maydon buzilsa — hammasi `detail` da", async () => {
    const err = await run(validator.body(schema.options({ abortEarly: false })), {
      body: { semester: 9 },
    });

    expect(err.statusCode).toBe(400);
    expect(typeof err.detail).toBe("string");
  });

  test("query va params ham bir xil ishlaydi", async () => {
    const qErr = await run(validator.query(schema), { query: { semester: 7, title: "x" } });
    const pErr = await run(validator.params(schema), { params: { semester: 7, title: "x" } });

    expect(qErr.statusCode).toBe(400);
    expect(pErr.statusCode).toBe(400);
  });

  test("REGRESSION-GUARD: xato `handleError` uchun 500 ga aylanmasin", async () => {
    const err = await run(validator.body(schema), { body: {} });

    expect(err.statusCode).toBe(400);
    expect(err.statusCode).not.toBe(500);
    expect(err.isJoi).toBeUndefined();
  });

  test("handleError orqali o'tsa standart xato shaklidagi JSON chiqadi", async () => {
    const err = await run(validator.body(schema), { body: { semester: 3, title: "x" } });
    const res = mockRes();

    handleError(err, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        statusCode: 400,
        message: expect.stringContaining("semester"),
      }),
    );
  });
});

describe("REGRESSION-GUARD — xom `createValidator(...)` route faylida qolmasin", () => {
  const SRC = path.join(__dirname, "../../src");

  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (e.name.endsWith(".routes.js")) out.push(p);
    }
    return out;
  };

  const routeFiles = walk(SRC);

  test("kamida 100 ta route fayli topildi (sanity)", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(100);
  });

  test("hech bir route fayli xom `createValidator(` ga qaytmasin", () => {
    const offenders = routeFiles
      .filter((f) => fs.readFileSync(f, "utf8").includes("createValidator("))
      .map((f) => path.relative(SRC, f).replace(/\\/g, "/"));

    expect(offenders).toEqual([]);
  });

  test("hech bir route fayli `express-joi-validation` ni to'g'ridan-to'g'ri require qilmasin", () => {
    const offenders = routeFiles
      .filter((f) => fs.readFileSync(f, "utf8").includes('require("express-joi-validation")'))
      .map((f) => path.relative(SRC, f).replace(/\\/g, "/"));

    expect(offenders).toEqual([]);
  });
});
