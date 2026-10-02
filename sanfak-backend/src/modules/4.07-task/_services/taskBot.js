const { Telegraf } = require("telegraf");
const winston = require("#shared/winston.logger");
const UserModel = require("#modules/4.01-auth/user/user.model");
const Binding = require("#modules/4.07-task/taskTelegramBinding/taskTelegramBinding.model");
const TelegramQueue = require("./telegramQueue.model");

let bot = null;

const getBot = () => bot;

const TG_MAX_LEN = 4096;

const normalizePhone = (phone) => (phone || "").replace(/\D/g, "");

const initTaskBot = () => {
  const token = process.env.TASK_TELEGRAM_BOT_TOKEN;
  if (!token) {
    winston.warn(
      "[TaskBot] TASK_TELEGRAM_BOT_TOKEN topilmadi — telegram bot ishga tushmadi (in-app feed ishlayveradi)",
    );
    return;
  }

  try {
    bot = new Telegraf(token);

    bot.start((ctx) =>
      ctx.reply(
        "Assalomu alaykum! Topshiriqlar bo'yicha bildirishnomalarni olish uchun " +
          "telefon raqamingizni ulang.",
        {
          reply_markup: {
            keyboard: [
              [{ text: "📱 Telefon raqamni yuborish", request_contact: true }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        },
      ),
    );

    bot.on("contact", async (ctx) => {
      try {
        const contact = ctx.message?.contact;
        const chatId = String(ctx.from?.id || "");
        const phoneDigits = normalizePhone(contact?.phone_number);

        if (!phoneDigits || !chatId) {
          return ctx.reply("Telefon raqamini aniqlay olmadim. Qaytadan urinib ko'ring.");
        }

        const last9 = phoneDigits.slice(-9);
        const matches = await UserModel.find({ phone: { $regex: `${last9}$` } })
          .select("_id firstName lastName")
          .limit(2)
          .lean();

        if (matches.length === 0) {
          return ctx.reply(
            "Bu raqam tizimda topilmadi. Administrator bilan bog'laning.",
          );
        }
        if (matches.length > 1) {
          winston.warn(`[TaskBot] last9=${last9} bir nechta foydalanuvchiga mos keldi — bog'lash rad etildi`);
          return ctx.reply(
            "Bu raqam bir nechta hisobga mos keldi. Administrator bilan bog'laning.",
          );
        }
        const user = matches[0];

        await Binding.findOneAndUpdate(
          { user: user._id },
          { user: user._id, chatId, phone: phoneDigits },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        return ctx.reply(
          `✅ Ulandi! ${user.lastName} ${user.firstName}, endi topshiriq biriktirilganda xabar olasiz.`,
          { reply_markup: { remove_keyboard: true } },
        );
      } catch (err) {
        winston.error(`[TaskBot] contact handler xato: ${err.message}`);
        return ctx.reply("Xatolik yuz berdi. Keyinroq urinib ko'ring.");
      }
    });

    bot.launch();
    winston.info("[TaskBot] ishga tushdi");

    process.once("SIGINT", () => bot && bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot && bot.stop("SIGTERM"));
  } catch (err) {
    winston.error(`[TaskBot] init xato: ${err.message}`);
    bot = null;
  }
};

const sendTaskAssigned = async (userId, { code, title, deadline }) => {
  try {
    const binding = await Binding.findOne({ user: userId }).select("chatId").lean();
    if (!binding?.chatId) {
      winston.info(`[TaskBot] user ${userId} bog'lanmagan — telegram o'tkazib yuborildi`);
      return;
    }

    const when = deadline
      ? new Date(deadline).toLocaleDateString("uz-UZ")
      : "—";
    const message =
      `📌 <b>Yangi topshiriq</b> ${code ? `(${code})` : ""}\n` +
      `${title}\n` +
      `Muddat: <b>${when}</b>`;

    const safeMessage = message.length > TG_MAX_LEN
      ? message.slice(0, TG_MAX_LEN - 3) + "..."
      : message;
    try {
      await TelegramQueue.create({
        chatId:   binding.chatId,
        message:  safeMessage,
        metadata: { userId: String(userId), code },
      });
    } catch (qErr) {
      winston.error(`[Task:TgQueue] navbatga yozish xato (userId=${userId}): ${qErr.message}`);
    }
  } catch (err) {
    winston.error(`[TaskBot] sendTaskAssigned xato: ${err.message}`);
  }
};

module.exports = { initTaskBot, sendTaskAssigned, getBot };
