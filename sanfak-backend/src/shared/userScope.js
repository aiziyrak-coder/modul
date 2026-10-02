function idOf(value) {
  if (!value) return null;
  if (typeof value === "object" && value._id !== undefined) return value._id || null;
  return value;
}

function resolveUserFacultyId(user) {
  if (!user) return null;
  const derived = idOf(user.department?.faculty);
  const scopeLevel = user.role?.scopeLevel;
  if (scopeLevel === "faculty") {
    return idOf(user.faculty) || derived || null;
  }
  return derived || null;
}

module.exports = { resolveUserFacultyId };
