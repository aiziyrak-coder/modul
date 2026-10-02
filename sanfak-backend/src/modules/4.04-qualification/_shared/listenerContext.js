const QualListener = require("#modules/4.04-qualification/_shared/qualListener.model");
const QualPetition = require("#modules/4.04-qualification/qualPetition/qualPetition.model");
const User = require("#modules/4.01-auth/user/user.model");

async function getPassport(req) {
  if (req.listenerId) {
    const card = await QualListener.findById(req.listenerId).select("passport").lean();
    return (card && card.passport) || null;
  }
  const id = req.user && req.user._id;
  if (!id) return null;
  const user = await User.findById(id).select("oneIdPin").lean();
  return (user && user.oneIdPin) || null;
}

async function getListenerId(req) {
  if (req.listenerId) return req.listenerId;
  const passport = await getPassport(req);
  if (!passport) return null;
  const listener = await QualListener.findOne({ passport }).select("_id").lean();
  return listener ? listener._id : null;
}

async function getOrCreateListenerId(req) {
  if (req.listenerId) return req.listenerId;
  const passport = await getPassport(req);
  if (!passport) return null;

  const existing = await QualListener.findOne({ passport }).select("_id").lean();
  if (existing) return existing._id;

  const petition = await QualPetition.findOne({ passport, status: 2 })
    .select("fullName")
    .lean();
  if (!petition) return null;

  const created = await QualListener.create({
    fullName: petition.fullName,
    passport,
  });
  return created._id;
}

async function getOrCreateListenerIdByPassport(passport) {
  if (!passport) return null;
  const existing = await QualListener.findOne({ passport }).select("_id").lean();
  if (existing) return existing._id;
  const petition = await QualPetition.findOne({ passport, status: 2 })
    .select("fullName")
    .lean();
  if (!petition) return null;
  const created = await QualListener.create({ fullName: petition.fullName, passport });
  return created._id;
}

async function isApprovedForCourse(req, courseId) {
  const passport = await getPassport(req);
  if (!passport) return false;
  const petition = await QualPetition.findOne({
    passport,
    status: 2,
    course: courseId,
  })
    .select("_id")
    .lean();
  return !!petition;
}

const LISTENER_ROLE_TITLE = "malaka_tinglovchi";

const MATCH_NONE = Object.freeze({ _id: null });

function isListenerRequest(req) {
  if (req && req.listenerId) return true;
  const role = req && req.user && req.user.role;
  return !!role && role.title === LISTENER_ROLE_TITLE;
}

async function listenerScope(req, field = "listener") {
  if (!isListenerRequest(req)) return {};

  if (field === "passport") {
    const passport = await getPassport(req);
    return passport ? { passport } : MATCH_NONE;
  }

  const listenerId = await getListenerId(req);
  return listenerId ? { [field]: listenerId } : MATCH_NONE;
}

module.exports = {
  getPassport,
  getListenerId,
  getOrCreateListenerId,
  getOrCreateListenerIdByPassport,
  isApprovedForCourse,
  isListenerRequest,
  listenerScope,
};
