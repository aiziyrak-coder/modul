"use strict";

const mongoose = require("mongoose");

const USER_FIELDS = "firstName lastName middleName phone office workingHours";

const REF_FIELDS = ["academicTitle", "position", "department", "faculty", "division"];

const titleOf = (v) => v?.title ?? null;

async function buildSupervisorCard(userId) {
  if (!mongoose.isValidObjectId(userId)) return null;

  let query = mongoose.model("user").findById(userId).select(USER_FIELDS);
  for (const ref of REF_FIELDS) query = query.populate(ref, "title");

  const user = await query.lean();
  if (!user) return null;

  return {
    id: String(user._id),
    fullName:
      [user.lastName, user.firstName, user.middleName].filter(Boolean).join(" ") || null,
    academicTitle: titleOf(user.academicTitle),
    position: titleOf(user.position),
    department: titleOf(user.department),
    faculty: titleOf(user.faculty),
    division: titleOf(user.division),
    phone: user.phone ?? null,
    office: user.office ?? null,
    workingHours: user.workingHours ?? null,
  };
}

module.exports = { buildSupervisorCard, USER_FIELDS, REF_FIELDS };
