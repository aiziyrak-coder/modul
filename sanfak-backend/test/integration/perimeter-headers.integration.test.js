"use strict";

const request = require("supertest");
const { buildPerimeterApp } = require("./helpers/perimeterApp");

describe("Perimetr headerlari", () => {
  const ORIG_ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS;
  const ORIG_NODE_ENV = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.ALLOWED_ORIGINS = "https://frontend.test.uz";
  });
  afterAll(() => {
    if (ORIG_ALLOWED_ORIGINS === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = ORIG_ALLOWED_ORIGINS;
    process.env.NODE_ENV = ORIG_NODE_ENV;
  });

  const app = buildPerimeterApp({ allowedOrigins: ["https://frontend.test.uz"] });

  test("X-Powered-By yo'q", async () => {
    const res = await request(app).get("/api/_probe");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  test("X-Content-Type-Options: nosniff", async () => {
    const res = await request(app).get("/api/_probe");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  test("Referrer-Policy bor", async () => {
    const res = await request(app).get("/api/_probe");
    expect(res.headers["referrer-policy"]).toBeTruthy();
  });

  test("Content-Security-Policy bor va asosiy direktivalar saqlangan", async () => {
    const res = await request(app).get("/api/_probe");
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/frame-ancestors 'self'/);
    expect(csp).toMatch(/object-src 'none'/);
  });

  test("/files/... javobida Cross-Origin-Resource-Policy: cross-origin", async () => {
    const res = await request(app).get("/files/_probe/does-not-exist.png");
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  test("ruxsat etilgan Origin — CORS o'tadi (ACAO qaytadi)", async () => {
    const res = await request(app)
      .get("/api/_probe")
      .set("Origin", "https://frontend.test.uz");
    expect(res.headers["access-control-allow-origin"]).toBe(
      "https://frontend.test.uz",
    );
  });

  test("ruxsatsiz Origin — CORS rad etadi (ACAO yo'q)", async () => {
    const res = await request(app)
      .get("/api/_probe")
      .set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("🔴 regressiya: CORS-rad javobida (403) ham xavfsizlik header'lari bor", async () => {
    const res = await request(app)
      .get("/api/_probe")
      .set("Origin", "https://evil.example");
    expect(res.status).toBe(403);
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  test("🔴 P2: CORS-rad javob tanasida hujumchi origin'i OSHKOR QILINMAYDI", async () => {
    const res = await request(app)
      .get("/api/_probe")
      .set("Origin", "https://evil.example");
    expect(res.status).toBe(403);
    expect(res.text || JSON.stringify(res.body)).not.toMatch(/evil\.example/);
  });
});

describe("CORS — dev muhitda ham allowlist ishlaydi (regressiya)", () => {
  const ORIG_ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS;
  const ORIG_NODE_ENV = process.env.NODE_ENV;

  afterEach(() => {
    if (ORIG_ALLOWED_ORIGINS === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = ORIG_ALLOWED_ORIGINS;
    process.env.NODE_ENV = ORIG_NODE_ENV;
  });

  test("dev + ALLOWED_ORIGINS bo'sh + begona Origin -> RAD (eski xulq: RUXSAT edi)", async () => {
    delete process.env.ALLOWED_ORIGINS;
    process.env.NODE_ENV = "dev";
    const { buildPerimeterApp: build } = require("./helpers/perimeterApp");
    const devApp = build();
    const res = await request(devApp)
      .get("/api/_probe")
      .set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("dev + ALLOWED_ORIGINS bo'sh + Vite dev-server Origin -> RUXSAT (dev default)", async () => {
    delete process.env.ALLOWED_ORIGINS;
    process.env.NODE_ENV = "dev";
    const { buildPerimeterApp: build } = require("./helpers/perimeterApp");
    const devApp = build();
    const res = await request(devApp)
      .get("/api/_probe")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  test("production + ALLOWED_ORIGINS bo'sh + istalgan Origin -> RAD (fail-closed)", async () => {
    delete process.env.ALLOWED_ORIGINS;
    process.env.NODE_ENV = "production";
    const { buildPerimeterApp: build } = require("./helpers/perimeterApp");
    const prodApp = build();
    const res = await request(prodApp)
      .get("/api/_probe")
      .set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("CORS — same-origin so'rov allowlist'siz ham RUXSAT (hotfix, jonli defekt)", () => {
  const http = require("http");
  let server;
  let origin;

  beforeAll((done) => {
    const app = buildPerimeterApp({ allowedOrigins: ["https://frontend.test.uz"] });
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      origin = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  test("Origin == so'rovning o'z hosti (allowlist'da yo'q) -> 200 + ACAO", async () => {
    const res = await request(server).get("/api/_probe").set("Origin", origin);
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
  });

  test("begona Origin hali ham 403 (fail-closed buzilmagan)", async () => {
    const res = await request(server)
      .get("/api/_probe")
      .set("Origin", "https://evil.example");
    expect(res.status).toBe(403);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("morgan URL maskalash — `sanitizeUrl` (auditLogger bilan BIR XIL manba)", () => {
  const { sanitizeUrl } = require("#system/_shared/auditLogger");

  test("`?token=` qiymati maskalanadi", () => {
    const masked = sanitizeUrl("/files/x.pdf?t=abc123&e=999");
    expect(masked).not.toMatch(/abc123/);
    expect(masked).toMatch(/t=\*\*\*/);
  });

  test("`access_token`/`refreshToken`/`signature` ham maskalanadi", () => {
    const masked = sanitizeUrl(
      "/api/x?access_token=SECRET&refreshToken=SECRET2&signature=SECRET3",
    );
    expect(masked).not.toMatch(/SECRET/);
  });

  test("maxfiy bo'lmagan query TEGILMAYDI", () => {
    expect(sanitizeUrl("/api/users?page=1&limit=20")).toBe(
      "/api/users?page=1&limit=20",
    );
  });

  test("P2: `?password=` `SENSITIVE_KEY_PATTERN` orqali maskalanadi, `?code=` OCHIQ qoladi", () => {
    const masked = sanitizeUrl("/api/x?password=x&code=1&t=y");
    expect(masked).toBe("/api/x?password=***&code=1&t=***");
  });
});
