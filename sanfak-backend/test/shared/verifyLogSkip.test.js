const express = require("express");
const morgan = require("morgan");
const request = require("supertest");
const { isVerifyTokenPath } = require("#shared/verifyLogSkip");

const TOKEN = "ab".repeat(16);

const appWith = (skip) => {
  const lines = [];
  const app = express();
  app.use(morgan(":method :url", { stream: { write: (l) => lines.push(l) }, skip }));
  const r = express.Router().get("/:token", (req, res) => res.status(404).send("x"));
  app.use("/verify/doc", r);
  app.use("/verify/plan", r);
  app.get("/api/ping", (req, res) => res.send("ok"));
  return { app, lines };
};

describe("isVerifyTokenPath — morgan skip", () => {
  test("/verify/plan va /verify/doc token so'rovlari log'ga TUSHMAYDI; boshqa yo'l tushadi", async () => {
    const { app, lines } = appWith(isVerifyTokenPath);
    await request(app).get(`/verify/plan/${TOKEN}`);
    await request(app).get(`/verify/doc/${TOKEN}`);
    await request(app).get("/api/ping");
    expect(lines.join("")).not.toContain(TOKEN);
    expect(lines.join("")).toContain("/api/ping");
  });

  test("nazorat: eski `req.path` predikati mount'dan keyin ishlamaydi (token log'ga tushardi)", async () => {
    const { app, lines } = appWith((req) => req.path.startsWith("/verify/doc"));
    await request(app).get(`/verify/doc/${TOKEN}`);
    expect(lines.join("")).toContain(TOKEN);
  });

  test("4.04 `/verify/:code` (qisqa kod) va noto'g'ri prefiks — skip qilinmaydi", () => {
    expect(isVerifyTokenPath({ originalUrl: "/verify/ABC123" })).toBe(false);
    expect(isVerifyTokenPath({ originalUrl: "/verify/documents" })).toBe(false);
    expect(isVerifyTokenPath({ originalUrl: "/verify/plan?t=1" })).toBe(true);
    expect(isVerifyTokenPath(undefined)).toBe(false);
  });
});
