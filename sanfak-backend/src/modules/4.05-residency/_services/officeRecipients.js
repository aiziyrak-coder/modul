"use strict";

const mongoose = require("mongoose");
const winston = require("#shared/winston.logger");
const { ROLES } = require("#config/constants");

async function officeUserIds() {
  const role = await mongoose
    .model("role")
    .findOne({ title: ROLES.MAGISTRATURA_BOLIM })
    .select("_id")
    .lean();

  if (!role) {
    winston.warn(
      `[4.5] officeRecipients: "${ROLES.MAGISTRATURA_BOLIM}" roli topilmadi — bildirishnoma yuborilmaydi`,
    );
    return [];
  }

  const users = await mongoose
    .model("user")
    .find({ role: role._id, active: { $ne: false } })
    .select("_id")
    .lean();

  if (users.length === 0) {
    winston.warn(
      "[4.5] officeRecipients: bo'lim xodimi topilmadi — bildirishnoma yuborilmaydi",
    );
  }
  return users.map((u) => u._id);
}

module.exports = { officeUserIds };
