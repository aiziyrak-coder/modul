"use strict";

const ResidencySetting = require("./residencySetting.model");

const EXCLUDE = { createdAt: 0, updatedAt: 0 };

const DEFAULT = {
  workDayFrom: ResidencySetting.DEFAULT_WORK_DAY_FROM,
  workDayTo: ResidencySetting.DEFAULT_WORK_DAY_TO,
  absenceStreakDays: ResidencySetting.DEFAULT_ABSENCE_STREAK_DAYS,
  absenceWindowDays: ResidencySetting.DEFAULT_ABSENCE_WINDOW_DAYS,
};

const withDefaults = (doc) =>
  doc && { ...doc, absenceWindowDays: doc.absenceWindowDays ?? DEFAULT.absenceWindowDays };

async function getOrCreate() {
  const existing = await ResidencySetting.findOne({}, EXCLUDE).lean();
  if (existing) return withDefaults(existing);

  const created = await new ResidencySetting(DEFAULT).save();
  return withDefaults(await ResidencySetting.findById(created._id, EXCLUDE).lean());
}

async function update(body, userId) {
  const payload = { ...body, updatedBy: userId ?? null };
  const existing = await ResidencySetting.findOne({});

  if (!existing) {
    const created = await new ResidencySetting({ ...DEFAULT, ...payload }).save();
    return withDefaults(await ResidencySetting.findById(created._id, EXCLUDE).lean());
  }

  return withDefaults(
    await ResidencySetting.findByIdAndUpdate(existing._id, payload, {
      new: true,
      runValidators: true,
      projection: EXCLUDE,
    }).lean(),
  );
}

module.exports = { getOrCreate, update, withDefaults, DEFAULT };
