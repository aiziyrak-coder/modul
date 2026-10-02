const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const User = require("#modules/4.01-auth/user/user.model");
const TeacherProfileModel = require("#modules/4.03-teacher/teacher/teacher.model");
const { ROLES } = require("#config/constants");
const AcademicYear = require("#references/academicYear/academicYear.model");
const { calculateAnnualHours } = require("./annualHoursCalculator");
const TeacherLeave = require("#modules/4.02-studyLoad/teacherLeave/teacherLeave.model");
const { resolvePositionSlug } = require("#modules/4.02-studyLoad/_shared/positionSlug");

async function getTeacherCurrentLoad(teacherId, academicYear) {
  const dists = await WorkloadDistribution.find({
    "teachers.teacher": teacherId,
    "teachers.isVacant": { $ne: true },
    academicYear,
    active: true,
  }).select("teachers");

  let total = 0;
  for (const dist of dists) {
    for (const entry of dist.teachers || []) {
      if (
        String(entry.teacher) === String(teacherId) &&
        !entry.isVacant
      ) {
        total += entry.totalHour || 0;
      }
    }
  }
  return total;
}

async function getTeacherCurrentLoadsBatch(teacherIds, academicYear) {
  const ids = (teacherIds || []).map(String);
  const totals = new Map(ids.map((id) => [id, 0]));
  if (ids.length === 0) return totals;

  const dists = await WorkloadDistribution.find({
    "teachers.teacher": { $in: teacherIds },
    "teachers.isVacant": { $ne: true },
    academicYear,
    active: true,
  })
    .select("teachers")
    .lean();

  const idSet = new Set(ids);
  for (const dist of dists) {
    for (const entry of dist.teachers || []) {
      const teacherId = String(entry.teacher);
      if (idSet.has(teacherId) && !entry.isVacant) {
        totals.set(
          teacherId,
          (totals.get(teacherId) || 0) + (entry.totalHour || 0),
        );
      }
    }
  }
  return totals;
}

async function getTaughtBeforeCountsBatch(
  teacherIds,
  vacantSciences,
  academicYears,
) {
  const counts = new Map();
  const scienceIds = Array.from(vacantSciences || []);
  if (scienceIds.length === 0 || !teacherIds?.length) return counts;

  const docs = await WorkloadDistribution.find({
    teachers: {
      $elemMatch: {
        teacher: { $in: teacherIds },
        "blocks.science": { $in: scienceIds },
      },
    },
    academicYear: { $in: academicYears },
    status: { $ne: "superseded" },
  })
    .select("teachers.teacher teachers.blocks.science")
    .lean();

  const idSet = new Set(teacherIds.map(String));
  for (const doc of docs) {
    const matchedInDoc = new Set();
    for (const entry of doc.teachers || []) {
      const teacherId = String(entry.teacher);
      if (!idSet.has(teacherId) || matchedInDoc.has(teacherId)) continue;
      const hasScience = (entry.blocks || []).some(
        (b) => b?.science && scienceIds.includes(String(b.science)),
      );
      if (hasScience) {
        matchedInDoc.add(teacherId);
        counts.set(teacherId, (counts.get(teacherId) || 0) + 1);
      }
    }
  }
  return counts;
}

async function suggestReplacementTeachers(distributionId, vacantEntryId, limit = 5) {
  const dist = await WorkloadDistribution.findById(distributionId)
    .populate("department")
    .lean();
  if (!dist) throw new Error("Distribution topilmadi");

  const vacantEntry = (dist.teachers || []).find(
    (t) => String(t._id) === String(vacantEntryId),
  );
  if (!vacantEntry) throw new Error("Vakant yozuv topilmadi");
  if (!vacantEntry.isVacant) throw new Error("Bu yozuv hali vakant emas");

  const vacantSciences = new Set(
    (vacantEntry.blocks || [])
      .filter((b) => b && b.science)
      .map((b) => String(b.science)),
  );

  const profileUserIds = await TeacherProfileModel.find({
    department: dist.department?._id,
    active: { $ne: false },
  }).distinct("user");

  const candidates = await User.find({
    _id: { $in: profileUserIds },
    department: dist.department?._id,
    active: true,
  })
    .populate("position academicTitle role")
    .select(
      "firstName lastName middleName position academicTitle stake email telegramChatId role",
    )
    .lean();

  const leavingIds =
    (await TeacherLeave.distinct("teacher", {
      teacher: { $in: candidates.map((c) => c._id) },
      type: { $in: ["resignation", "transfer"] },
      status: { $in: ["pending", "approved"] },
    })) || [];
  const excluded = new Set([
    String(vacantEntry.teacher || ""),
    ...leavingIds.map(String),
  ]);

  const oqituvchiCandidates = candidates.filter(
    (c) => c.role?.title === ROLES.OQITUVCHI && !excluded.has(String(c._id)),
  );

  const academicYear = dist.academicYear;

  const lastYear = await resolvePreviousAcademicYearId(academicYear);
  const prevYears = [academicYear, lastYear].filter(Boolean);

  const candidateIds = oqituvchiCandidates.map((c) => c._id);
  const currentLoads = await getTeacherCurrentLoadsBatch(
    candidateIds,
    academicYear,
  );
  const taughtBeforeCounts = await getTaughtBeforeCountsBatch(
    candidateIds,
    vacantSciences,
    prevYears,
  );

  const scored = [];

  for (const t of oqituvchiCandidates) {
    let score = 0;
    const reasons = [];

    const currentLoad = currentLoads.get(String(t._id)) || 0;
    let limits = null;
    let freeCapacity = 0;
    let maxHours = 720;
    try {
      if (t.position) {
        limits = await calculateAnnualHours({
          position: t.position,
          academicTitle: t.academicTitle,
          stake: t.stake || 1.0,
        });
        maxHours = limits.annualHours;
      }
    } catch (_) {}

    freeCapacity = maxHours - currentLoad;

    if (freeCapacity >= (vacantEntry.totalHour || 0)) {
      score += 30;
      reasons.push(`Bo'sh sig'im: ${freeCapacity} soat`);
    } else if (freeCapacity > 0) {
      const ratio = freeCapacity / (vacantEntry.totalHour || 1);
      score += Math.round(30 * ratio);
      reasons.push(`Qisman bo'sh sig'im: ${freeCapacity}/${vacantEntry.totalHour}`);
    } else {
      score -= 10;
      reasons.push(`Sig'im yo'q (yuklama: ${currentLoad}/${maxHours})`);
    }

    if (vacantSciences.size > 0) {
      const taughtBefore = taughtBeforeCounts.get(String(t._id)) || 0;
      if (taughtBefore > 0) {
        score += 25;
        reasons.push(`Avval shu fanlarni o'qigan (${taughtBefore} hujjat)`);
      }
    }

    if (t.academicTitle) {
      score += 10;
      reasons.push(`Ilmiy unvon: ${t.academicTitle.title || "bor"}`);
    }

    if (currentLoad > maxHours) {
      const overload = currentLoad - maxHours;
      const penalty = Math.floor(overload / 100) * 10;
      score -= penalty;
      reasons.push(`Ortiqcha yuklama: -${penalty}`);
    }

    scored.push({
      teacher: {
        _id: t._id,
        firstName: t.firstName,
        lastName: t.lastName,
        middleName: t.middleName,
        position: t.position,
        academicTitle: t.academicTitle,
      },
      score,
      reasons,
      currentLoad,
      freeCapacity,
      maxHours,
      limits,
    });
  }

  return scored
    .filter((s) => s.score > -50)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function reassignVacancy({
  distributionId,
  vacantEntryId,
  newTeacherId,
  actorUserId,
}) {
  const dist = await WorkloadDistribution.findById(distributionId);
  if (!dist) throw new Error("Distribution topilmadi");

  const entry = dist.teachers.id(vacantEntryId);
  if (!entry) throw new Error("Vakant yozuv topilmadi");
  if (!entry.isVacant) throw new Error("Yozuv vakant emas");

  const newTeacher = await User.findById(newTeacherId);
  if (!newTeacher) throw new Error("Yangi o'qituvchi topilmadi");

  const currentLoad = await getTeacherCurrentLoad(newTeacherId, dist.academicYear);
  let limits = null;
  if (newTeacher.position) {
    try {
      limits = await calculateAnnualHours({
        position: newTeacher.position,
        academicTitle: newTeacher.academicTitle,
        stake: newTeacher.stake || 1.0,
      });
    } catch (_) {}
  }

  const projected = currentLoad + (entry.totalHour || 0);
  if (limits && projected > limits.annualHours) {
    throw new Error(
      `Yangi o'qituvchining yuklamasi limit'dan oshib ketadi: ${projected} > ${limits.annualHours}`,
    );
  }

  entry.reassignedFrom = entry.teacher;
  entry.reassignedAt = new Date();
  entry.reassignedBy = actorUserId || null;

  entry.teacher = newTeacherId;
  const newProfile = await TeacherProfileModel.findOne({ user: newTeacherId })
    .populate("position", "title")
    .select("position")
    .lean();
  entry.position = resolvePositionSlug(newProfile?.position?.title) || null;
  entry.isVacant = false;
  entry.vacantLabel = null;
  entry.vacancyReason = null;
  entry.acceptanceStatus = "pending";
  entry.rejectionReason = null;
  entry.respondedAt = null;

  for (const block of entry.blocks || []) {
    block.acceptanceStatus = "pending";
    block.rejectionReason = null;
    block.respondedAt = null;
  }

  if (typeof dist.residueHour === "number") {
    dist.residueHour = Math.max(0, dist.residueHour - (entry.totalHour || 0));
  }

  await dist.save();

  return { distribution: dist, entry };
}

async function resolvePreviousAcademicYearId(academicYearId) {
  if (!academicYearId) return null;

  const current = await AcademicYear.findById(academicYearId)
    .select("title")
    .lean()
    .catch(() => null);
  if (!current?.title) return null;

  const m = String(current.title).match(/^(\d{4})\s*[/-]\s*(\d{4})$/);
  if (!m) return null;

  const sep = String(current.title).includes("/") ? "/" : "-";
  const prevTitle = `${Number(m[1]) - 1}${sep}${Number(m[2]) - 1}`;

  const prev = await AcademicYear.findOne({ title: prevTitle })
    .select("_id")
    .lean()
    .catch(() => null);
  return prev?._id ?? null;
}

module.exports = {
  suggestReplacementTeachers,
  reassignVacancy,
  getTeacherCurrentLoad,
  getTeacherCurrentLoadsBatch,
  getTaughtBeforeCountsBatch,
};
