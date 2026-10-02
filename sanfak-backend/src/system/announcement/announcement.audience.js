const ResidentModel = require("#modules/4.05-residency/resident/resident.model");
const StudentModel = require("#domain/student/student.model");

async function resolveUserAudience(userId) {
  const myCourses = [];
  const myDirections = [];

  const resident = await ResidentModel.findOne({ user: userId })
    .select("course specialty")
    .lean();
  if (resident) {
    if (resident.course) myCourses.push(resident.course);
    if (resident.specialty) myDirections.push(resident.specialty);
  }

  const student = await StudentModel.findOne({ user: userId })
    .select("course direction")
    .lean();
  if (student) {
    if (student.course) myCourses.push(student.course);
    if (student.direction) myDirections.push(student.direction);
  }

  return { myCourses, myDirections };
}

function buildAudienceOr(userId, myCourses = [], myDirections = []) {
  const audienceOr = [
    {
      $and: [
        { $or: [{ targetUsers: { $size: 0 } }, { targetUsers: { $exists: false } }] },
        { $or: [{ targetCourses: { $size: 0 } }, { targetCourses: { $exists: false } }] },
        { $or: [{ targetDirections: { $size: 0 } }, { targetDirections: { $exists: false } }] },
      ],
    },
    { targetUsers: userId },
  ];
  if (myCourses.length) audienceOr.push({ targetCourses: { $in: myCourses } });
  if (myDirections.length) audienceOr.push({ targetDirections: { $in: myDirections } });
  return audienceOr;
}

async function resolveAudienceFilter(userId) {
  const { myCourses, myDirections } = await resolveUserAudience(userId);
  return buildAudienceOr(userId, myCourses, myDirections);
}

function buildCourseDirectionOr(targetCourses, targetDirections, directionField) {
  const or = [];
  if (targetCourses.length) or.push({ course: { $in: targetCourses } });
  if (targetDirections.length) or.push({ [directionField]: { $in: targetDirections } });
  return or;
}

async function resolveAnnouncementAudienceUserIds(doc) {
  const targetUsers = doc?.targetUsers || [];
  if (targetUsers.length) return targetUsers;

  const targetCourses = doc?.targetCourses || [];
  const targetDirections = doc?.targetDirections || [];
  if (!targetCourses.length && !targetDirections.length) return null;

  const residentOr = buildCourseDirectionOr(targetCourses, targetDirections, "specialty");
  const studentOr = buildCourseDirectionOr(targetCourses, targetDirections, "direction");

  const [residents, students] = await Promise.all([
    ResidentModel.find({ $or: residentOr }).select("user").lean(),
    StudentModel.find({ $or: studentOr }).select("user").lean(),
  ]);

  const seen = new Set();
  const uniqueIds = [];
  for (const r of [...residents, ...students]) {
    if (!r.user) continue;
    const key = String(r.user);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueIds.push(r.user);
  }
  return uniqueIds;
}

module.exports = {
  resolveUserAudience,
  buildAudienceOr,
  resolveAudienceFilter,
  resolveAnnouncementAudienceUserIds,
};
