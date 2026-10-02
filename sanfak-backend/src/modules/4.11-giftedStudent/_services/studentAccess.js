const winston = require("#shared/winston.logger");
const { ROLES } = require("#config/constants");
const GiftedStudentModel = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");
const {
  isRegistryOwner,
  isJudge,
  isObserver,
  isAdvisor,
  isStudent,
} = require("./moduleRoles");

async function canAccessStudent(user, studentId) {
  const role = user?.role;
  if (!role) return false;

  if (role.title === ROLES.SUPER_ADMIN) return true;

  if (isRegistryOwner(role) || isJudge(role) || isObserver(role)) return true;

  const advisor = isAdvisor(role);
  const student = isStudent(role);

  if (!advisor && !student) {
    winston.warn(
      `[4.11] studentAccess: rol profili aniqlanmadi — kirish rad etildi. ` +
        `role="${role.title}" user=${user._id} student=${studentId}`,
    );
    return false;
  }

  const gs = await GiftedStudentModel.findById(studentId)
    .select("advisorId user")
    .lean();
  if (!gs) return false;

  if (advisor) return String(gs.advisorId || "") === String(user._id);
  return String(gs.user || "") === String(user._id);
}

async function denyStudentAccess(req, res, studentId) {
  const ok = await canAccessStudent(req.user, studentId);
  if (ok) return false;
  res.status(404).json({ message: "not found" });
  return true;
}

async function resolveOwnedGiftedStudentIds(user) {
  const role = user?.role;
  if (!role) return [];

  if (role.title === ROLES.SUPER_ADMIN) return null;

  if (isRegistryOwner(role) || isJudge(role) || isObserver(role)) return null;

  if (isAdvisor(role)) {
    const rows = await GiftedStudentModel.find({ advisorId: String(user._id) })
      .select("_id")
      .lean();
    return rows.map((r) => r._id);
  }

  if (isStudent(role)) {
    const rows = await GiftedStudentModel.find({ user: user._id })
      .select("_id")
      .lean();
    return rows.map((r) => r._id);
  }

  return [];
}

module.exports = {
  canAccessStudent,
  denyStudentAccess,
  resolveOwnedGiftedStudentIds,
};
