const cron = require("node-cron");
const winston = require("#shared/winston.logger");

const SCHEDULE = "7-59/15 * * * *";

function runTick() {
  let tick;
  try {
    tick = require("#modules/4.05-residency/samsIngest/samsMonitorTick");
  } catch (err) {
    winston.error(`[SamsMonitorCron] tik moduli yuklanmadi: ${err.message}`);
    return Promise.resolve(false);
  }
  return tick.runSamsMonitorTick().catch((err) => {
    winston.error(`[SamsMonitorCron] tik yiqildi: ${err.message}`);
    return false;
  });
}

const startSamsMonitorCron = () => {
  cron.schedule(SCHEDULE, () => runTick());

  winston.info(
    "[SamsMonitorCron] SAMS monitor cron job ro'yxatdan o'tdi (har 15 daqiqada, :07/:22/:37/:52)",
  );
};

module.exports = { startSamsMonitorCron, SCHEDULE };
