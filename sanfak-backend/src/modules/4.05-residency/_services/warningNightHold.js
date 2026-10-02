"use strict";

const winston = require("#shared/winston.logger");
const { UZ_OFFSET_MINUTES } = require("./uzDay");

const WARNING_HOLD_SOURCE = "sams";
const HOLD_FROM_UZ_HOUR = 22;
const HOLD_UNTIL_UZ_HOUR = 8;
const WARNING_EFFECT_KINDS = new Set(["telegram", "inApp", "log", "supervisor"]);
const DRAFT_EFFECT_KIND = "openDraft";

const uzHourOf = (d) =>
  new Date(new Date(d).getTime() + UZ_OFFSET_MINUTES * 60_000).getUTCHours();

function holdsNightWarning(source, now) {
  if (source !== WARNING_HOLD_SOURCE) return false;
  const hour = uzHourOf(now);
  return hour >= HOLD_FROM_UZ_HOUR || hour < HOLD_UNTIL_UZ_HOUR;
}

function holdNightWarning(evaluated, { source, now, residentId }) {
  const { update, effects } = evaluated;
  if (update.warningIssued !== true || !holdsNightWarning(source, now)) return evaluated;

  const { warningIssued, warningIssuedAt, ...rest } = update;
  winston.info(
    `[4.5 expulsionCheck] 6 soat ogohlantirishi 08:00 sweep'gacha ushlab turildi resident=${residentId} soat=${update.totalUnexcusedHours}`,
  );
  return {
    ...evaluated,
    update: rest,
    effects: effects.filter((e) => !WARNING_EFFECT_KINDS.has(e.kind)),
  };
}

function holdNightDraft(evaluated, { source, now, resident }) {
  const draft = evaluated.effects.find((e) => e.kind === DRAFT_EFFECT_KIND);
  if (!draft || !holdsNightWarning(source, now)) return evaluated;

  if (resident?.expulsionOrderCreated !== true) {
    winston.info(
      `[4.5 expulsionCheck] 72 soat loyihasi 08:00 sweep'gacha ushlab turildi resident=${resident?._id} soat=${draft.hours}`,
    );
  }
  return { ...evaluated, effects: evaluated.effects.filter((e) => e.kind !== DRAFT_EFFECT_KIND) };
}

function holdNightTransitions(evaluated, { source, now, resident }) {
  return holdNightDraft(
    holdNightWarning(evaluated, { source, now, residentId: resident?._id }),
    { source, now, resident },
  );
}

module.exports = {
  holdNightWarning,
  holdNightDraft,
  holdNightTransitions,
  holdsNightWarning,
  WARNING_HOLD_SOURCE,
  WARNING_EFFECT_KINDS,
  DRAFT_EFFECT_KIND,
  HOLD_FROM_UZ_HOUR,
  HOLD_UNTIL_UZ_HOUR,
};
