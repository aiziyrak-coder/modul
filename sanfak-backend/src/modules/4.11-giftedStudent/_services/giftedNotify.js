const mongoose = require("mongoose");
const winston = require("#shared/winston.logger");
const { dispatch } = require("#system/notification/notificationDispatcher");

const EVENTS = {
  ACHIEVEMENT_REVIEWED: "gifted_achievement_reviewed",
  APPLICATION_REVIEWED: "gifted_application_reviewed",
};

const LINKS = {
  STUDENT_ACTIVITIES: "/gifted-students/student/activities",
  STUDENT_SCHOLARSHIPS: "/gifted-students/student/scholarships",
};

async function notifyUser(userId, { eventType, title, body, link, metadata }) {
  try {
    if (!userId) return;
    await dispatch({ userId, eventType, title, body, link, metadata });
  } catch (err) {
    winston.error(`[giftedNotify] bildirishnoma xato: ${err.message}`);
  }
}

async function notifyStudent(giftedStudentId, payload) {
  try {
    if (!giftedStudentId) return;
    const GiftedStudent = mongoose.model("giftedStudent");
    const gs = await GiftedStudent.findById(giftedStudentId).select("user").lean();
    if (!gs?.user) return;
    await notifyUser(gs.user, payload);
  } catch (err) {
    winston.error(`[giftedNotify] talaba topilmadi: ${err.message}`);
  }
}

module.exports = { notifyUser, notifyStudent, EVENTS, LINKS };
