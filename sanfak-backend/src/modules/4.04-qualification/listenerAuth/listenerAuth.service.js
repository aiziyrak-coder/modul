const { ErrorHandler } = require("#shared/error");
const User = require("#modules/4.01-auth/user/user.model");
const QualListener = require("#modules/4.04-qualification/_shared/qualListener.model");
const QualPetition = require("#modules/4.04-qualification/qualPetition/qualPetition.model");

function toPublic(card, user) {
  const u = user || {};
  const fromCard = String(card.fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    listenerId: String(card._id),
    userId: u._id ? String(u._id) : String(card._id),
    fullName:
      card.fullName ||
      [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ").trim(),
    firstName: u.firstName || fromCard[1] || null,
    lastName: u.lastName || fromCard[0] || null,
    middleName: u.middleName || fromCard.slice(2).join(" ") || null,
    passport: card.passport || null,
    passportSeria: u.passportSeria || null,
    passportNumber: u.passportNumber != null ? String(u.passportNumber) : null,
    email: u.email || null,
    phone: u.phone || null,
  };
}

async function cardByPassport(passport) {
  const existing = await QualListener.findOne({ passport }).lean();
  if (existing) return existing;

  const petition = await QualPetition.findOne({ passport, status: 2 })
    .select("fullName")
    .lean();
  if (!petition) return null;

  const created = await QualListener.create({ fullName: petition.fullName, passport });
  return created.toObject ? created.toObject() : created;
}

const userByPassport = (passport) =>
  User.findOne({ oneIdPin: passport })
    .select("+oneIdPin firstName lastName middleName passportSeria passportNumber email phone active")
    .lean();

async function resolveByPin(pin) {
  const card = await cardByPassport(pin);
  if (!card) {
    throw new ErrorHandler(
      404,
      "Siz hali tinglovchi emassiz — kursga arizangiz tasdiqlanishi kerak",
    );
  }
  const user = await userByPassport(pin);
  if (user && user.active === false) throw new ErrorHandler(403, "Foydalanuvchi bloklangan");
  return toPublic(card, user);
}

async function resolveByUserId(id) {
  let card = await QualListener.findById(id).lean().catch(() => null);
  if (!card) {
    const user = await User.findById(id).select("+oneIdPin").lean().catch(() => null);
    if (user && user.oneIdPin) card = await cardByPassport(user.oneIdPin);
  }
  if (!card) throw new ErrorHandler(404, "Tinglovchi topilmadi");
  return toPublic(card, await userByPassport(card.passport));
}

module.exports = { resolveByPin, resolveByUserId };
