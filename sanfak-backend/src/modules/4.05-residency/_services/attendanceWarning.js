"use strict";

const winston = require("#shared/winston.logger");
const Notification = require("#system/notification/notification.model");

const EVENT_TYPE = "residency_attendance_warning";

const WARNING_HOURS = 6;
const EXPULSION_HOURS = 72;

async function revokeWarning(userId) {
  if (!userId) return 0;
  const res = await Notification.updateMany(
    { user: userId, eventType: EVENT_TYPE, active: true },
    { active: false },
  );
  return res.modifiedCount ?? 0;
}

function revokeWarningInBackground(userId) {
  setImmediate(() => {
    revokeWarning(userId).catch((err) =>
      winston.error(
        `[attendanceWarning] bekor qilish yiqildi (${userId}): ${err.message}`,
      ),
    );
  });
}

function clearWarningIfBelowThreshold(resident, hours, update) {
  if (hours >= WARNING_HOURS) return false;
  if (!resident?.warningIssued) return false;
  update.warningIssued = false;
  update.warningIssuedAt = null;
  return true;
}

module.exports = {
  EVENT_TYPE,
  WARNING_HOURS,
  EXPULSION_HOURS,
  revokeWarning,
  revokeWarningInBackground,
  clearWarningIfBelowThreshold,
};
