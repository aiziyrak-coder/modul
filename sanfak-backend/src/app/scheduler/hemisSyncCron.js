const cron = require("node-cron");
const winston = require("#shared/winston.logger");
const Service = require("#modules/4.14-hemis/hemis.service");
const { HEAVY_TYPES } = require("#modules/4.14-hemis/hemis.config");

// Har kuni 04:30 — oddiy ro'yxatlar; yakshanba 05:30 — og'ir (baholar) ro'yxati.
// Faqat HEMIS_SYNC_ENABLED=true bo'lsa ishlaydi.
function startHemisSyncCron() {
  if (process.env.HEMIS_SYNC_ENABLED !== "true") {
    winston.info("[HemisSyncCron] o'chiq (HEMIS_SYNC_ENABLED=true emas)");
    return;
  }
  const run = (opts) =>
    Service.syncAll({ ...opts, trigger: "cron" }).catch((e) =>
      winston.error(`[HemisSyncCron] ${e.message}`),
    );
  cron.schedule("30 4 * * *", () => run({}));
  cron.schedule("30 5 * * 0", () => run({ types: HEAVY_TYPES }));
  winston.info("[HemisSyncCron] yoqildi (kunlik 04:30, yakshanba 05:30)");
}

module.exports = { startHemisSyncCron };
