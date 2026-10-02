const { academicYearOf } = require("./academicYearWindow");
const { yearScoreOf } = require("./yearScore");

const endOfDay = (d) => {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
};

const checkApplyEligibility = (scholarship, gifted, now = new Date()) => {
  if (!scholarship) return null;

  if (scholarship.active === false) {
    return { message: "Bu stipendiya yo'nalishi hozir faol emas" };
  }

  if (scholarship.deadline && now > endOfDay(scholarship.deadline)) {
    const d = new Date(scholarship.deadline).toISOString().slice(0, 10);
    return { message: `Ariza muddati tugagan (${d})` };
  }

  const year = academicYearOf(now);
  const score = yearScoreOf(gifted, year);
  const min = scholarship.minScore || 0;
  if (score < min) {
    return {
      message: `Ball yetarli emas: ${score}/${min} (${year} o'quv yili) — minimal ball talab qilinadi`,
    };
  }

  const allowed = scholarship.allowedCourses || [];
  if (allowed.length > 0) {
    const allowedIds = (scholarship.allowedCourseIds || []).map(String);
    const myId = gifted.courseId ? String(gifted.courseId) : null;
    if (myId && allowedIds.includes(myId)) return null;

    const mine = gifted.course === null || gifted.course === undefined ? null : String(gifted.course);
    if (mine !== null && allowed.includes(mine)) return null;

    return {
      message: `Bu stipendiya faqat quyidagi kurslar uchun: ${allowed.join(", ")}`,
    };
  }

  return null;
};

const ELIGIBILITY_FIELDS = "active deadline minScore allowedCourses allowedCourseIds name";

module.exports = { checkApplyEligibility, ELIGIBILITY_FIELDS, endOfDay };
