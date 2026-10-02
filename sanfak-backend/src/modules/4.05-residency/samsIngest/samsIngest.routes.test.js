"use strict";

const express = require("express");
const request = require("supertest");

const KEY = "s".repeat(40);
const HEAVY = [
  "./samsIngest.service",
  "./samsPresence.model",
  "./samsOrgDay.model",
  "./samsSyncState.model",
  "./samsIngest.validation",
  "#modules/4.05-residency/resident/resident.model",
];

function loadRoutes(service) {
  jest.resetModules();
  const loaded = [];
  for (const m of HEAVY) {
    jest.doMock(m, () => {
      loaded.push(m);
      return m === "./samsIngest.service" ? service() : {};
    });
  }
  const logger = require("#shared/winston.logger");
  jest.spyOn(logger, "warn").mockImplementation(() => {});
  jest.spyOn(logger, "error").mockImplementation(() => {});
  const routes = require("./samsIngest.routes");
  return { routes, loaded, ...require("#shared/error") };
}

function appWith({ routes, handleError }) {
  const app = express();
  app.use(express.json());
  app.use("/api/residency-sams", routes);
  app.get("/api/residency-sams-outages", (_req, res) => res.status(204).end());
  app.use((err, _req, res, _next) => handleError(err, res));
  return app;
}

beforeEach(() => {
  process.env.SAMS_SERVICE_KEY = KEY;
});
afterEach(() => {
  delete process.env.SAMS_SERVICE_KEY;
  jest.restoreAllMocks();
  for (const m of HEAVY) jest.dontMock(m);
});

describe("R11 — statik require zanjiri minimal", () => {
  it("routes yuklanganda servis, modellar va Joi YUKLANMAYDI", () => {
    const { loaded } = loadRoutes(() => ({}));
    expect(loaded).toEqual([]);
  });

  it("servis FAQAT birinchi so'rovda yuklanadi va eslab qolinadi", async () => {
    const getRoster = jest.fn(async () => ({ schemaVersion: 1 }));
    const bundle = loadRoutes(() => ({ getRoster }));
    const app = appWith(bundle);
    await request(app).get("/api/residency-sams/roster").set("X-Sams-Service-Key", KEY);
    await request(app).get("/api/residency-sams/roster").set("X-Sams-Service-Key", KEY);
    expect(bundle.loaded).toEqual(["./samsIngest.service"]);
    expect(getRoster).toHaveBeenCalledTimes(2);
    expect(getRoster.mock.calls[0][0]).toBeInstanceOf(Date);
  });

  it("servis yuklanmasa — 503 sams_ingest_unavailable, no-store", async () => {
    const bundle = loadRoutes(() => {
      throw new Error("buzuq model");
    });
    const res = await request(appWith(bundle)).get("/api/residency-sams/roster").set("X-Sams-Service-Key", KEY);
    expect(res.status).toBe(503);
    expect(res.body.reason).toBe("sams_ingest_unavailable");
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("HTTP qobig'i", () => {
  it("kalitsiz — 401, no-store, servis chaqirilmaydi", async () => {
    const getRoster = jest.fn();
    const bundle = loadRoutes(() => ({ getRoster }));
    const res = await request(appWith(bundle)).get("/api/residency-sams/roster");
    expect(res.status).toBe(401);
    expect(res.body.reason).toBe("sams_key_invalid");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(getRoster).not.toHaveBeenCalled();
    expect(bundle.loaded).toEqual([]);
  });

  it("ingest — tana servisga boradi, 200 XOM JSON", async () => {
    const ingestPacket = jest.fn(async (body) => ({ accepted: true, got: body.schemaVersion }));
    const res = await request(appWith(loadRoutes(() => ({ ingestPacket }))))
      .post("/api/residency-sams/ingest")
      .set("X-Sams-Service-Key", KEY)
      .send({ schemaVersion: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accepted: true, got: 1 });
    expect(res.headers["cache-control"]).toBe("no-store");
    const [, receivedAt, clock] = ingestPacket.mock.calls[0];
    expect(receivedAt).toBeInstanceOf(Date);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(clock()).toBeInstanceOf(Date);
    expect(clock().getTime()).toBeGreaterThan(receivedAt.getTime());
  });

  it("kutilmagan xato — 500, ErrorHandler esa o'zgarishsiz", async () => {
    const ingestPacket = jest.fn();
    const bundle = loadRoutes(() => ({ ingestPacket }));
    ingestPacket
      .mockRejectedValueOnce(new Error("disk"))
      .mockRejectedValueOnce(new bundle.ErrorHandler(400, "x", "", { reason: "contract" }));
    const app = appWith(bundle);
    const post = () => request(app).post("/api/residency-sams/ingest").set("X-Sams-Service-Key", KEY).send({});
    const first = await post();
    expect(first.status).toBe(500);
    const second = await post();
    expect([second.status, second.body.reason]).toEqual([400, "contract"]);
  });

  it("`/residency-sams-outages` bu darvozaga TUSHMAYDI (prefiks boshqa)", async () => {
    const res = await request(appWith(loadRoutes(() => ({})))).get("/api/residency-sams-outages");
    expect(res.status).toBe(204);
  });
});
