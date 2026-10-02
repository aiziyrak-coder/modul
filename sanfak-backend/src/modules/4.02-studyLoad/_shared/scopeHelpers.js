const User = require("#modules/4.01-auth/user/user.model");
const Department = require("#references/department/department.model");
const Direction = require("#references/direction/direction.model");
const { resolveUserFacultyId } = require("#shared/userScope");

async function resolveDepartmentMemberIds(user) {
  const department = user?.department?._id || user?.department || null;
  if (!department) return null;

  const members = await User.find({ department, active: true })
    .select("_id")
    .lean();
  return members.map((m) => m._id);
}

async function resolveFacultyDepartmentIds(user) {
  const faculty = resolveUserFacultyId(user);
  if (!faculty) return null;

  const departments = await Department.find({ faculty, active: true })
    .select("_id")
    .lean();
  return departments.map((d) => d._id);
}

async function resolveFacultyMemberIds(user) {
  const departmentIds = await resolveFacultyDepartmentIds(user);
  if (departmentIds === null) return null;

  const members = await User.find({
    department: { $in: departmentIds },
    active: true,
  })
    .select("_id")
    .lean();
  return members.map((m) => m._id);
}

async function resolveFacultyDirectionIds(user) {
  const faculty = resolveUserFacultyId(user);
  if (!faculty) return null;

  const directions = await Direction.find({ faculty, active: true })
    .select("_id")
    .lean();
  return directions.map((d) => d._id);
}

module.exports = {
  resolveDepartmentMemberIds,
  resolveFacultyDepartmentIds,
  resolveFacultyMemberIds,
  resolveFacultyDirectionIds,
};
