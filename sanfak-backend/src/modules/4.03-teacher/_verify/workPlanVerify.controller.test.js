jest.mock("./workPlanVerify.service", () => ({ lookup: jest.fn() }));

const express = require("express");
const request = require("supertest");
const { lookup } = require("./workPlanVerify.service");
const Controller = require("./workPlanVerify.controller");
const routes = require("./workPlanVerify.routes");

const TOKEN = "e".repeat(32);
const app = express().use("/verify/plan", routes);
const snapshot = [{ label: "Kafedra assistenti", shortName: "A.A.Anatomov", date: new Date("2026-09-20") }];

beforeEach(() => jest.clearAllMocks());

describe("GET /verify/plan/:token", () => {
  test("topilmadi — 404, «Topilmadi», token sahifada YO'Q, 4 xavfsizlik header'i", async () => {
    lookup.mockResolvedValue(null);
    const res = await request(app).get(`/verify/plan/${TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.text).toContain("Topilmadi");
    expect(res.text).not.toContain(TOKEN);
    expect(res.headers).toMatchObject({
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, noarchive",
      "x-content-type-options": "nosniff",
    });
  });

  test("tasdiqlangan — «Tasdiqlangan», nom va imzolovchi, HTML escape", async () => {
    lookup.mockResolvedValue({ kind: "personalWorkPlan", state: "approved", title: "Shaxsiy ish reja — <b>X</b>", snapshot, approvedAt: new Date("2026-09-25") });
    const res = await request(app).get(`/verify/plan/${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Tasdiqlangan");
    expect(res.text).toContain("A.A.Anatomov");
    expect(res.text).toContain("&lt;b&gt;X&lt;/b&gt;");
    expect(res.text).toContain("O&#39;qituvchining shaxsiy ish rejasi");
  });

  test("jarayonda — «Jarayonda» + «kutilmoqda», «tasdiqlangan» so'zi HECH QAYERDA yo'q", async () => {
    lookup.mockResolvedValue({ kind: "personalWorkPlan", state: "in_progress", title: "Shaxsiy ish reja", snapshot, pending: [{ step: "dekan", label: "Fakultet dekani" }] });
    const res = await request(app).get(`/verify/plan/${TOKEN}`);
    expect(res.text).toContain("Jarayonda");
    expect(res.text).toContain("kutilmoqda");
    expect(res.text.toLowerCase()).not.toContain("tasdiqlangan");
  });

  test("servis xatosi — bir xil 404", async () => {
    lookup.mockRejectedValue(new Error("x"));
    const res = await request(app).get(`/verify/plan/${TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.text).toBe(Controller.renderInvalid());
  });

  test("boshqa metod/segment — 405", async () => {
    expect((await request(app).post(`/verify/plan/${TOKEN}`)).status).toBe(405);
    expect((await request(app).get(`/verify/plan/${TOKEN}/x`)).status).toBe(405);
  });
});
