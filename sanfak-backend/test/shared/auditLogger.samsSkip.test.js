"use strict";

const EventEmitter = require("events");

jest.mock("#modules/4.01-auth/auditLog/auditLog.model", () => ({
  create: jest.fn(() => Promise.resolve()),
}));

process.env.AUDIT_LOG_READS = "records";

const AuditLog = require("#modules/4.01-auth/auditLog/auditLog.model");
const auditLogger = require("#system/_shared/auditLogger");

function drive(method, originalUrl, statusCode) {
  const req = { method, originalUrl, headers: {}, body: { schemaVersion: 1 }, query: {} };
  const res = new EventEmitter();
  res.statusCode = statusCode;
  const next = jest.fn();
  auditLogger(req, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  res.emit("finish");
}

beforeEach(() => AuditLog.create.mockClear());

describe("SAMS ingest — audit jurnaliga tushmaydi", () => {
  it.each([
    ["/api/residency-sams/ingest", 200],
    ["/api/residency-sams/ingest", 400],
    ["/api/residency-sams/ingest?packetId=1", 401],
  ])("POST %s (%i) → yozuv yo'q", (url, status) => {
    drive("POST", url, status);
    expect(AuditLog.create).not.toHaveBeenCalled();
  });
});

describe("qolgan yo'llar — siyosat o'zgarmagan", () => {
  it("POST /api/residency-sams-outages → bitta yozuv", () => {
    drive("POST", "/api/residency-sams-outages", 201);
    expect(AuditLog.create).toHaveBeenCalledTimes(1);
    expect(AuditLog.create.mock.calls[0][0]).toMatchObject({ path: "/api/residency-sams-outages", statusCode: 201 });
  });

  it("401 bilan tugagan GET /api/residency-sams/roster → bitta yozuv", () => {
    drive("GET", "/api/residency-sams/roster", 401);
    expect(AuditLog.create).toHaveBeenCalledTimes(1);
  });

  it("200 roster GET — `records` rejimida o'tkazib yuboriladi (aniq yozuv emas)", () => {
    drive("GET", "/api/residency-sams/roster", 200);
    expect(AuditLog.create).not.toHaveBeenCalled();
  });
});
