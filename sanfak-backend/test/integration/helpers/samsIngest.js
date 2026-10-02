"use strict";

const KEY = "i".repeat(40);
process.env.SAMS_SERVICE_KEY = KEY;
process.env.SERVICE_KEY = `listener-${"l".repeat(40)}`;

const zlib = require("zlib");
const express = require("express");
const bodyParser = require("body-parser");
const request = require("supertest");
const { handleError } = require("#shared/error");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const SamsPresence = require("#modules/4.05-residency/samsIngest/samsPresence.model");
const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");
const { addDays, enumerateDays } = require("#modules/4.05-residency/samsIngest/samsContract");

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));
app.use("/api/residency-sams", require("#modules/4.05-residency/samsIngest/samsIngest.routes"));
app.use((err, req, res, next) => handleError(err, res));

const today = uzDayKey(new Date());
const D = (n) => addDays(today, n);
const WINDOW = { from: D(-6), to: D(0) };
const PIN = {
  r1: "30101990000011", r2: "30101990000022", r3: "30101990000033",
  legacy: "30101990000044", magis: "30101990000055", tatil: "30101990000066",
  deleted: "30101990000077", short: "301019900000", x: "30101990000099",
  inactive: "30101990000088",
};

const dayEntry = (day) => ({
  day, rosterScanCount: 1, expectedResidents: 2, scannedResidents: 1,
  deviceMix: { hikvision: 1, mobile: 0, server: 0, in: 1, out: 0 },
});
const tenant = (dbname, horizon, people, window = WINDOW) => ({
  orgId: `o-${dbname}`, dbname, orgTitle: `Klinika ${dbname}`, horizon,
  days: enumerateDays(window.from, window.to).map(dayEntry), people,
});
const rec = (attendId, date, accessTime = "08:00") => ({
  attendId, date, accessTime, exitTime: "14:00", deviceType: [{ device: 1, type: 1 }], lated: 0, earlyLeft: 0,
});
const person = (jshshir, since, records = []) => ({
  jshshir, userId: `u${jshshir.slice(-4)}`, hasShift: true, since, lastActive: "", active: true, records,
});
const packet = ({
  window = WINDOW, emittedAt = new Date(Date.now() - 60_000), tenants = [], unresolved = [], ambiguous = [],
  failedTenants, trigger = "reconcile",
} = {}) => ({
  schemaVersion: 1, packetId: "p-1", trigger, serverUtcOffsetMinutes: 300,
  emittedAt: emittedAt.toISOString(), window,
  scan: { tenantsScanned: tenants.length, tenantsWithResidents: tenants.length, failedTenants },
  tenants, unresolved, ambiguous,
});

const withKey = (req) => req.set("X-Sams-Service-Key", KEY);
const gzipPost = (buffer) =>
  withKey(request(app).post("/api/residency-sams/ingest"))
    .set("Content-Encoding", "gzip")
    .type("json")
    .serialize((d) => d)
    .send(buffer);
const ingest = (body) => gzipPost(zlib.gzipSync(JSON.stringify(body)));
const roster = () => withKey(request(app).get("/api/residency-sams/roster"));

const mkResident = (jshshir, over = {}) =>
  Resident.create({ program: "ordinatura", fullName: `R ${jshshir.slice(-2)}`, jshshir, status: "oquvda", active: true, ...over });
const rowsOf = (resident) => SamsPresence.find({ resident: resident._id }).sort({ day: 1 }).lean();

module.exports = {
  KEY, app, today, D, WINDOW, PIN,
  tenant, rec, person, packet,
  gzipPost, ingest, roster, mkResident, rowsOf,
};
