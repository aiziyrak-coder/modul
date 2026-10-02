const mongoose = require("mongoose");

const CANDIDATE_FIELDS = "firstName lastName middleName department academicTitle role";

async function usersWithRoles(roleIds) {
  if (!roleIds || roleIds.length === 0) return [];

  return mongoose
    .model("user")
    .find({ role: { $in: roleIds }, active: { $ne: false } })
    .select(CANDIDATE_FIELDS)
    .populate("role", "title")
    .populate("academicTitle", "title")
    .sort({ lastName: 1, firstName: 1 })
    .lean();
}

module.exports = { usersWithRoles, CANDIDATE_FIELDS };
