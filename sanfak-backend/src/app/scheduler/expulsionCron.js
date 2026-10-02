const cron = require("node-cron");
const {
  runExpulsionSweep,
} = require("#modules/4.05-residency/_services/expulsionCheck");
const winston = require("#shared/winston.logger");

const startExpulsionCron = () => {
  cron.schedule("0 8 * * *", () => runExpulsionSweep());

  winston.info(
    "[ExpulsionCron] Chetlatish cron job ro'yxatdan o'tdi (har kuni 08:00)",
  );
};

module.exports = { startExpulsionCron };
