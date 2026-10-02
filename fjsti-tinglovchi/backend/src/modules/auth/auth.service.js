const jwt = require("jsonwebtoken");
const { ErrorHandler } = require("#shared/error");
const logger = require("#shared/logger");
const { callMain } = require("#shared/mainApi");
const { ROLE, LISTENER_ROLE_TITLE } = require("#config/constants");
const { Listener } = require("#shared/models/listener");

const PIN_RE = /^\d{14}$/;

async function lazyProvision(pin) {
  let identity;
  try {
    identity = await callMain("/qualification-listener-auth/resolve", {
      method: "POST",
      body: { pin },
    });
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 403) throw err;
    throw new ErrorHandler(503, "Yangi tinglovchini tekshirib bo'lmadi — keyinroq urinib ko'ring");
  }

  const doc = await Listener().findOneAndUpdate(
    { passport: pin },
    {
      $set: {
        passport: pin,
        fullName: identity.fullName ?? null,
        userId: identity.userId ?? null,
        listenerId: identity.listenerId ?? null,
        active: true,
        firstName: identity.firstName ?? null,
        lastName: identity.lastName ?? null,
        middleName: identity.middleName ?? null,
        passportSeria: identity.passportSeria ?? null,
        passportNumber: identity.passportNumber ?? null,
        email: identity.email ?? null,
        phone: identity.phone ?? null,
        syncedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
  logger.info("[auth] yangi tinglovchi mahalliy bazaga qo'shildi (lazy provision)");
  return doc;
}

function signTokens(payload) {
  const accessToken = jwt.sign(payload, process.env.LISTENER_JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_TTL || "1d",
  });
  const refreshToken = jwt.sign({ sub: payload.sub }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_TTL || "30d",
  });
  return { accessToken, refreshToken };
}

const buildAccessPayload = (d) => ({
  _id: d.listenerId,
  sub: d.listenerId,
  role: ROLE,
  listenerId: d.listenerId,
});

const toPublicUser = (d) => ({
  id: d.listenerId,
  fullName:
    d.fullName || [d.lastName, d.firstName, d.middleName].filter(Boolean).join(" ").trim(),
  firstName: d.firstName ?? null,
  lastName: d.lastName ?? null,
  middleName: d.middleName ?? null,
  passport: d.passport ?? null,
  passportSeria: d.passportSeria ?? null,
  passportNumber: d.passportNumber ?? null,
  email: d.email ?? null,
  phone: d.phone ?? null,
  role: ROLE,
});

async function login(oneIdPin) {
  const pin = String(oneIdPin || "");
  if (!PIN_RE.test(pin)) {
    throw new ErrorHandler(400, "PIN 14 ta raqamdan iborat bo'lishi kerak");
  }
  const Model = Listener();
  let doc = await Model.findOne({ passport: pin });

  if (!doc) doc = await lazyProvision(pin);
  if (!doc.active) throw new ErrorHandler(403, "Foydalanuvchi bloklangan");
  if (doc.role && doc.role !== LISTENER_ROLE_TITLE) {
    throw new ErrorHandler(403, "Bu kabinetga faqat tinglovchi kira oladi");
  }
  if (!doc.userId || !doc.listenerId) {
    throw new ErrorHandler(
      403,
      "Tinglovchi kartochkasi to'liq emas — administratorga murojaat qiling",
    );
  }

  await Model.updateOne(
    { _id: doc._id },
    { $set: { lastLoginAt: new Date() }, $inc: { loginCount: 1 } },
  );

  return { ...signTokens(buildAccessPayload(doc)), user: toPublicUser(doc) };
}

async function refresh(refreshToken) {
  if (!refreshToken) throw new ErrorHandler(401, "Refresh token yuborilmadi");
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    throw new ErrorHandler(401, "Refresh token yaroqsiz yoki muddati tugagan");
  }
  const doc = await Listener().findOne({ listenerId: String(decoded.sub) });
  if (!doc) throw new ErrorHandler(404, "Tinglovchi topilmadi");
  if (!doc.active) throw new ErrorHandler(403, "Foydalanuvchi bloklangan");
  return { ...signTokens(buildAccessPayload(doc)), user: toPublicUser(doc) };
}

async function profile(listenerId) {
  const doc = await Listener().findOne({ listenerId: String(listenerId) });
  if (!doc) throw new ErrorHandler(404, "Tinglovchi topilmadi");
  return toPublicUser(doc);
}

module.exports = { login, refresh, profile };
