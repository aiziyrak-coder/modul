const { sendNotification } = require("#shared/telegram");
const winston = require("#shared/winston.logger");

let _mailTransporter = null;
let _nodemailerAvailable = null;

const getMailTransporter = () => {
  if (_mailTransporter) return _mailTransporter;
  if (_nodemailerAvailable === false) return null;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    winston.warn("[NotificationService] SMTP sozlamalari topilmadi (.env)");
    _nodemailerAvailable = false;
    return null;
  }

  try {
    const nodemailer = require("nodemailer");
    _mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    _nodemailerAvailable = true;
    return _mailTransporter;
  } catch (err) {
    winston.warn(
      `[NotificationService] nodemailer o'rnatilmagan — \`npm install nodemailer\``,
    );
    _nodemailerAvailable = false;
    return null;
  }
};

const notify = async ({
  message,
  subject,
  chatId,
  telegramChatId,
  phone,
  email,
  type = "telegram",
}) => {
  const results = [];
  const tgChat = chatId || telegramChatId;

  if (type === "telegram" || type === "all") {
    try {
      await sendNotification(message, tgChat);
      results.push({ channel: "telegram", success: true });
    } catch (err) {
      winston.error(`[NotificationService] Telegram xato: ${err.message}`);
      results.push({ channel: "telegram", success: false, error: err.message });
    }
  }

  if ((type === "sms" || type === "all") && phone) {
    try {
      await sendSms(phone, message);
      results.push({ channel: "sms", success: true });
    } catch (err) {
      winston.error(`[NotificationService] SMS xato: ${err.message}`);
      results.push({ channel: "sms", success: false, error: err.message });
    }
  }

  if ((type === "email" || type === "all") && email) {
    try {
      await sendEmail({
        to: email,
        subject: subject || "Tizim xabarnomasi",
        html: message,
      });
      results.push({ channel: "email", success: true });
    } catch (err) {
      winston.error(`[NotificationService] Email xato: ${err.message}`);
      results.push({ channel: "email", success: false, error: err.message });
    }
  }

  return results;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getMailTransporter();
  if (!transporter) {
    throw new Error("SMTP yoki nodemailer mavjud emas");
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  return await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ""),
  });
};

const sendSms = async (phone, message) => {
  if (!process.env.SMS_EMAIL || !process.env.SMS_PASSWORD) {
    winston.warn("[NotificationService] SMS sozlamalari topilmadi (.env)");
    return;
  }

  const https = require("https");

  const tokenData = JSON.stringify({
    email: process.env.SMS_EMAIL,
    password: process.env.SMS_PASSWORD,
  });

  const token = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "notify.eskiz.uz",
        path: "/api/auth/login",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(tokenData),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed?.data?.token);
          } catch {
            reject(new Error("SMS token parse xatosi"));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(tokenData);
    req.end();
  });

  if (!token) throw new Error("SMS token olinmadi");

  const smsData = JSON.stringify({
    mobile_phone: phone.replace(/\D/g, ""),
    message,
    from: process.env.SMS_FROM || "4546",
  });

  await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "notify.eskiz.uz",
        path: "/api/message/sms/send",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(smsData),
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(body));
      },
    );
    req.on("error", reject);
    req.write(smsData);
    req.end();
  });
};

const templates = {
  expulsionWarning: (name, hours) =>
    `⚠️ <b>Ogohlantirish!</b>\n${name} ${hours} soat sababsiz dars qoldirdi.\nAgar davom etsa, chetlatish buyrug'i shakllantiriladi.`,

  expulsionOrder: (name) =>
    `📄 <b>Chetlatish buyrug'i loyihasi</b>\n${name} 72 soatdan ortiq sababsiz dars qoldirdi.\nLoyiha shakllantirildi; qaror va imzo bo'lim zimmasida.`,

  applicationStatus: (type, status) =>
    `📋 <b>Ariza holati o'zgardi</b>\nAriza turi: ${type}\nYangi holat: <b>${status}</b>`,

  admissionStatus: (fullName, status) =>
    `🎓 <b>Qabul holati</b>\n${fullName}\nHolat: <b>${status}</b>`,

  contractSigned: (signType) =>
    `✅ <b>Shartnoma imzolandi</b>\nImzolagan: ${signType}`,

  taskAssigned: (title, deadline) =>
    `📌 <b>Yangi topshiriq</b>\n${title}\nMuddat: ${deadline}`,

  announcementNew: (title, module) =>
    `📢 <b>Yangi e'lon</b> [${module}]\n${title}`,

  scholarshipResult: (type, status) =>
    `🏆 <b>Stipendiya arizasi natijasi</b>\nTuri: ${type}\nNatija: <b>${status}</b>`,
};

module.exports = { notify, templates, sendEmail, sendSms };
