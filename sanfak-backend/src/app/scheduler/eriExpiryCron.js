const cron = require("node-cron");
const UserModel = require("#modules/4.01-auth/user/user.model");
const winston = require("#shared/winston.logger");
const { dispatch } = require("#system/notification/notificationDispatcher");

const MILESTONE_DAYS = [30, 14, 7, 1];

async function checkExpiringCerts() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  let totalNotified = 0;

  for (const days of MILESTONE_DAYS) {
    const targetStart = new Date(startOfDay.getTime() + days * 24 * 60 * 60 * 1000);
    const targetEnd = new Date(targetStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const users = await UserModel.find({
      "eriCertificate.validTo": { $gte: targetStart, $lte: targetEnd },
    })
      .select("firstName lastName email phone telegramChatId eriCertificate")
      .lean();

    for (const user of users) {
      try {
        await dispatch({
          userId: user._id,
          user,
          eventType: "eri_expiring",
          title: `ERI sertifikati ${days} kundan keyin tugaydi`,
          body:
            `Sertifikat seriya: ${user.eriCertificate?.serialNumber}\n` +
            `Tugash sanasi: ${new Date(user.eriCertificate.validTo).toISOString().slice(0, 10)}\n` +
            `Yangilash uchun ERI markazi bilan bog'laning.`,
          link: "/teacher/profile",
          metadata: {
            serialNumber: user.eriCertificate?.serialNumber,
            daysLeft: days,
          },
        });
        totalNotified++;
      } catch (err) {
        winston.warn(`[EriExpiryCron] dispatch fail user=${user._id}: ${err.message}`);
      }
    }
  }

  const expiredUsers = await UserModel.find({
    "eriCertificate.validTo": {
      $lt: startOfDay,
      $gte: new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000),
    },
  })
    .select("firstName lastName email phone telegramChatId eriCertificate")
    .lean();

  for (const user of expiredUsers) {
    try {
      await dispatch({
        userId: user._id,
        user,
        eventType: "eri_expired",
        title: "❗ ERI sertifikati tugadi",
        body:
          `Sertifikat seriya: ${user.eriCertificate?.serialNumber}\n` +
          `Endi siz tasdiqlash amallarini bajarib bo'lmaysiz.\n` +
          `Yangi sertifikat olish uchun ERI markazi bilan bog'laning.`,
        link: "/teacher/profile",
      });
      totalNotified++;
    } catch (err) {
      winston.warn(`[EriExpiryCron] expired dispatch fail: ${err.message}`);
    }
  }

  if (totalNotified > 0) {
    winston.info(`[EriExpiryCron] ${totalNotified} ta foydalanuvchi xabardor qilindi`);
  }
}

function startEriExpiryCron() {
  cron.schedule("0 8 * * *", async () => {
    try {
      await checkExpiringCerts();
    } catch (err) {
      winston.error(`[EriExpiryCron] xato: ${err.message}`);
    }
  });
  winston.info("[EriExpiryCron] yoqildi (har kuni 08:00)");
}

module.exports = { startEriExpiryCron, checkExpiringCerts };
