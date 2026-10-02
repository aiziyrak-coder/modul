"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");

const TMP_ROOT = path.join(os.tmpdir(), `wpc-p1-4.08-${Date.now()}`);

const fileOf = (name) => ({ originalname: name, buffer: Buffer.from("x"), size: 1 });

const mockReq = (host, files) => ({
  protocol: "https",
  get: (h) => (h.toLowerCase() === "host" ? host : undefined),
  files,
  body: {},
});

describe("4.08 public.upload — persistApplicationDocs Host allowlist", () => {
  const ORIG_ENV = { ...process.env };

  beforeEach(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
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
    const { persistApplicationDocs } = require("./public.upload");
    const req = mockReq("api.institut.uz", {
      documentPassport: [fileOf("pasport.jpg")],
    });
    let nextErr;
    persistApplicationDocs(req, {}, (err) => {
      nextErr = err;
    });
    expect(nextErr).toBeUndefined();
    expect(req.body.documents.passport.fileUrl).toMatch(
      /^https:\/\/api\.institut\.uz\/files\/images\/public\//,
    );
  });

  it("begona Host — 400 'Host ruxsat etilmagan', disk'ga hech narsa yozilmaydi", () => {
    jest.resetModules();
    const { persistApplicationDocs } = require("./public.upload");
    const req = mockReq("evil.example", {
      documentPassport: [fileOf("pasport.jpg")],
    });
    let nextErr;
    persistApplicationDocs(req, {}, (err) => {
      nextErr = err;
    });
    expect(nextErr).toBeDefined();
    expect(nextErr.statusCode).toBe(400);
    expect(nextErr.message).toBe("Host ruxsat etilmagan");
    expect(req.body.documents).toBeUndefined();
    const dir = path.join(TMP_ROOT, "uploads", "images", "public");
    expect(fs.existsSync(dir) ? fs.readdirSync(dir) : []).toHaveLength(0);
  });
});
