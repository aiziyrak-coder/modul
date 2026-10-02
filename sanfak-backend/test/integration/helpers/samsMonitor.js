"use strict";

const Resident = require("#modules/4.05-residency/resident/resident.model");
const SamsOrgDay = require("#modules/4.05-residency/samsIngest/samsOrgDay.model");
const SamsPresence = require("#modules/4.05-residency/samsIngest/samsPresence.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const { addDays } = require("#modules/4.05-residency/samsIngest/samsContract");

const NOW = new Date("2026-09-27T05:00:00Z");
const TODAY = "2026-09-27";
const D = (n) => addDays(TODAY, n);
const MIN = 60_000;
const ago = (minutes, from = NOW) => new Date(from.getTime() - minutes * MIN);
const finalAt = (day) => new Date(`${addDays(day, 1)}T01:30:00+05:00`);
const partialAt = (day) => new Date(`${day}T09:00:00+05:00`);

const orgDay = (dbname, day, stamp, over = {}) =>
  SamsOrgDay.create({
    dbname, day, orgTitle: `Klinika ${dbname}`, orgId: `o-${dbname}`, horizon: "2026-01-01",
    measured: true, unmeasuredReason: null, rosterScanCount: 8, expectedResidents: 10, scannedResidents: 8,
    ...stamp, ...over,
  });

const presence = (resident, dbname, day, stamp, over = {}) =>
  SamsPresence.create({
    resident: resident._id ?? resident, day, dbname, samsUserId: "u1", measured: true, unmeasuredReason: null,
    hasShift: true, samsUserActive: true, records: [], recordCount: 0, ...stamp, ...over,
  });

const rec = (attendId) => ({ attendId, accessTime: "08:00", exitTime: "14:00", deviceType: [{ device: 1, type: 1 }] });
const withRecords = (n = 1) => {
  const records = Array.from({ length: n }, (_v, i) => rec(`a${i}`));
  return { records, recordCount: records.length };
};

let seq = 0;
const mkResident = (over = {}) => {
  seq += 1;
  return Resident.create({
    program: "ordinatura", fullName: `Rezident ${String(seq).padStart(3, "0")}`,
    jshshir: `3010199${String(seq).padStart(7, "0")}`, status: "oquvda", active: true, ...over,
  });
};

async function mkOffice(n = 2) {
  const role = await RoleModel.create({ title: "magistratura_bolim", scopeLevel: "global", active: true });
  return Promise.all(Array.from({ length: n }, (_v, i) => UserModel.create({ firstName: `B${i}`, lastName: "Bolim", role: role._id, active: true })));
}

function gate(Model, method) {
  const original = Model[method].bind(Model);
  let release;
  let entered;
  const opened = new Promise((resolve) => { release = resolve; });
  const reached = new Promise((resolve) => { entered = resolve; });
  const spy = jest.spyOn(Model, method).mockImplementationOnce(async (...args) => {
    entered();
    await opened;
    return original(...args);
  });
  return { spy, reached, release: () => release() };
}

module.exports = {
  NOW, TODAY, D, MIN, ago, finalAt, partialAt,
  orgDay, presence, withRecords, mkResident, mkOffice, gate,
};
