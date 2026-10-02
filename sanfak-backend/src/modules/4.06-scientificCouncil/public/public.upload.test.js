"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");

const TMP_ROOT = path.join(os.tmpdir(), `wpc-p1-4.06-${Date.now()}`);

const mockReq = (host, overrides = {}) => ({
  protocol: "https",
  get: (h) => (h.toLowerCase() === "host" ? host : undefined),
  file: { originalname: "ariza.pdf", buffer: Buffer.from("x") },
  body: {},
  ...overrides,
});

describe("4.06 public.upload — persistApplicationFile Host allowlist", () => {
  const ORIG_ENV = { ...process.env };

  beforeEach(() => {
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    process.env.FILEPATH = `${TMP_ROOT.replace(/\\/g, "/")}/`;
    delete process.env.PUBLIC_BASE_URL;
    process.env.ALLOWED_ORIGINS = "https://api.institut.uz";
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env = { ...ORIG_ENV };
    jest.resetModules();
  });

  afterAll(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  it("allowlist'dagi Host — URL to'g'ri quriladi", () => {
    jest.resetModules();
    const { persistApplicationFile } = require("./public.upload");
    const req = mockReq("api.institut.uz");
    let nextErr;
    persistApplicationFile(req, {}, (err) => {
      nextErr = err;
    });
    expect(nextErr).toBeUndefined();
    expect(req.body.workFile.filePath).toMatch(
      /^https:\/\/api\.institut\.uz\/files\/file\/science-council-public\//,
    );
  });

  it("begona Host — 400 'Host ruxsat etilmagan', yozuv bekor", () => {
    jest.resetModules();
    const { persistApplicationFile } = require("./public.upload");
    const req = mockReq("evil.example");
    let nextErr;
    persistApplicationFile(req, {}, (err) => {
      nextErr = err;
    });
    expect(nextErr).toBeDefined();
    expect(nextErr.statusCode).toBe(400);
    expect(nextErr.message).toBe("Host ruxsat etilmagan");
    expect(req.body.workFile).toBeUndefined();
  });
});
