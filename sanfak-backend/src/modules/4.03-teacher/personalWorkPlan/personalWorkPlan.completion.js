const ACTIVITY_PLAN_NOT_APPROVED =
  "Faoliyatni faqat tasdiqlangan ish rejasida bajarilgan deb belgilash mumkin";
const ACTIVITY_ALREADY_DONE =
  "Faoliyat allaqachon bajarilgan — faqat qaytarilgan (rad etilgan) dalilni " +
  "qayta yuborish mumkin";

function completeActivityLock(plan, item) {
  if (plan.status !== "approved") return ACTIVITY_PLAN_NOT_APPROVED;
  if (item.status === "completed" && item.verification?.status !== "rejected") {
    return ACTIVITY_ALREADY_DONE;
  }
  return null;
}

const countsAsCompleted = (item) =>
  item.status === "completed" && item.verification?.status !== "rejected";

function completionBlockers(plan, sections) {
  let notCompleted = 0;
  let notVerified = 0;
  for (const section of sections) {
    for (const item of plan[section] || []) {
      if (item.status !== "completed") notCompleted += 1;
      else if (item.verification?.status !== "approved") notVerified += 1;
    }
  }
  return { notCompleted, notVerified };
}

module.exports = { completeActivityLock, countsAsCompleted, completionBlockers };
