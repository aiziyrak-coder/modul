"use strict";

const Session = require("#modules/4.05-residency/residencySession/residencySession.model");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");
const { selectSessionRoster, fanOut, withdrawFrames } = require("./sessionRoster");
const { sessionStartInstant, sessionEndInstant } = require("./sessionResolver");

const { LIVE_FRAME } = Roster;
const UNSCORED = Object.freeze({ score: null });

async function withdrawIneligible(session, now) {
  const desired = new Set((await selectSessionRoster(session)).map(String));
  const live = await Roster.find({ session: session._id, ...LIVE_FRAME }).select("resident").lean();
  const gone = live.map((f) => f.resident).filter((id) => !desired.has(String(id)));
  return withdrawFrames(session._id, gone, now, { ...UNSCORED });
}

async function freeze(session, now) {
  const res = await Session.updateOne({ _id: session._id, rosterFrozenAt: null }, { $set: { rosterFrozenAt: now } });
  return res.modifiedCount > 0;
}

async function syncSessionRoster(session, { now = new Date(), window }) {
  if (session.rosterFrozenAt) return { frozen: true, framed: null, withdrawn: 0 };
  const startI = sessionStartInstant(session.day, window.from);
  const endI = sessionEndInstant(session.day, window.to);
  const framed = startI && now < startI ? (await fanOut(session._id)).framed : null;
  const withdrawn = await withdrawIneligible(session, now);
  const frozen = Boolean(endI) && now >= endI && (await freeze(session, now));
  return { frozen, framed, withdrawn };
}

module.exports = { syncSessionRoster };
