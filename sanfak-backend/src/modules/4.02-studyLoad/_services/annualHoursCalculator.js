const Position = require("#references/position/position.model");
const AcademicTitle = require("#references/academicTitle/academicTitle.model");

async function calculateAnnualHours({
  position,
  academicTitle = null,
  stake = 1.0,
}) {
  if (!position) {
    throw new Error("annualHoursCalculator: position majburiy");
  }

  let pos = position;
  if (typeof position === "string" || (position._id && !position.annualHours)) {
    pos = await Position.findById(position._id || position).lean();
  }
  if (!pos) {
    throw new Error("Position topilmadi");
  }

  let title = academicTitle;
  if (academicTitle && (typeof academicTitle === "string" || !academicTitle.hourMultiplier)) {
    title = await AcademicTitle.findById(academicTitle._id || academicTitle).lean();
  }

  const multiplier = title?.hourMultiplier || 1.0;

  return {
    annualHours: Math.round((pos.annualHours || 720) * stake),
    minAuditoriumHours: Math.round((pos.minAuditoriumHours || 400) * stake),
    maxAuditoriumHours: Math.round((pos.maxAuditoriumHours || 800) * stake * multiplier),
    multiplier,
    stake,
    allowedStakes: pos.allowedStakes || [0.25, 0.5, 0.75, 1.0],
    position: pos,
    academicTitle: title,
  };
}

async function validateTeacherWorkload({
  teacher,
  totalHours,
  auditoriumHours = null,
}) {
  if (!teacher) throw new Error("teacher majburiy");

  const User = require("#modules/4.01-auth/user/user.model");
  const user = await User.findById(teacher)
    .select("position academicTitle stake firstName lastName")
    .lean();

  if (!user) {
    return { valid: false, errors: ["Foydalanuvchi topilmadi"], limits: null };
  }
  if (!user.position) {
    return { valid: false, errors: ["Lavozim biriktirilmagan"], limits: null };
  }

  const limits = await calculateAnnualHours({
    position: user.position,
    academicTitle: user.academicTitle,
    stake: user.stake || 1.0,
  });

  const errors = [];

  if (totalHours > limits.annualHours) {
    errors.push(
      `Jami soat ${totalHours} > ruxsat etilgan ${limits.annualHours} (stavka ${limits.stake})`,
    );
  }

  if (auditoriumHours !== null) {
    if (auditoriumHours < limits.minAuditoriumHours) {
      errors.push(
        `Auditoriya soati ${auditoriumHours} < minimal ${limits.minAuditoriumHours}`,
      );
    }
    if (auditoriumHours > limits.maxAuditoriumHours) {
      errors.push(
        `Auditoriya soati ${auditoriumHours} > maksimal ${limits.maxAuditoriumHours}`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    limits,
    teacherName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
  };
}

async function validateDistribution(distribution) {
  const results = [];
  for (const entry of distribution.teachers || []) {
    if (entry.isVacant) continue;
    if (!entry.teacher) continue;

    const result = await validateTeacherWorkload({
      teacher: entry.teacher,
      totalHours: entry.totalHour || 0,
      auditoriumHours: entry.auditoriumHour || null,
    });

    results.push({
      teacher: entry.teacher,
      teacherName: result.teacherName,
      valid: result.valid,
      errors: result.errors,
      limits: result.limits,
    });
  }
  return results;
}

module.exports = {
  calculateAnnualHours,
  validateTeacherWorkload,
  validateDistribution,
};
