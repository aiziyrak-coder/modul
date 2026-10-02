const { Telegraf } = require("telegraf");
const winston = require("./winston.logger");

let bot = null;

const initBot = () => {
  try {
    if (process.env.TELEGRAM_BOT_TOKEN) {
      bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
      winston.info("Telegram bot initialized");
    }
  } catch (err) {
    winston.error(`Telegram bot init error: ${err.message}`);
  }
};

const sendNotification = async (message, chatId) => {
  try {
    if (!bot) {
      winston.warn("Telegram bot is not initialized");
      return;
    }

    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;

    if (!targetChatId) {
      winston.warn("Telegram chat ID not provided");
      return;
    }

    await bot.telegram.sendMessage(targetChatId, message, {
      parse_mode: "HTML",
    });
  } catch (err) {
    winston.error(`Telegram notification error: ${err.message}`);
  }
};

module.exports = { initBot, sendNotification };
