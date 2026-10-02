const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const { dispatchMany } = require("#system/notification/notificationDispatcher");
const winston = require("#shared/winston.logger");
const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");
const ScientificPost = require("./scientificPost.model");

const POPULATE = [{ path: "author", select: "firstName lastName" }];

const RECIPIENT_ROLES = {
  teachers: [ROLES.OQITUVCHI],
  heads: [ROLES.KAFEDRA_MUDIRI],
  deans: [ROLES.DEKAN],
  all: [
    ROLES.OQITUVCHI,
    ROLES.KAFEDRA_MUDIRI,
    ROLES.DEKAN,
    ROLES.PROREKTOR,
    ROLES.REKTOR,
    ROLES.ILMIY_KENGASH_KOTIBI,
  ],
};

const roleOf = (user) => user?.role?.title;
const isAdmin = (user) =>
  roleOf(user) === ROLES.SUPER_ADMIN || roleOf(user) === ROLES.ADMIN;
const isSender = (user) => roleOf(user) === ROLES.ILMIY_BOLIM || isAdmin(user);

const GROUPS_BY_ROLE = Object.entries(RECIPIENT_ROLES).reduce((acc, [group, titles]) => {
  titles.forEach((title) => {
    acc[title] = acc[title] || [];
    acc[title].push(group);
  });
  return acc;
}, {});

const visibilityFilter = (user) => {
  if (isSender(user)) return {};
  const groups = GROUPS_BY_ROLE[roleOf(user)] || [];
  return { recipients: { $in: groups } };
};

const buildQuery = ({ search } = {}, user) => {
  const q = { active: true, ...visibilityFilter(user) };
  if (search) q.title = { $regex: new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };
  return q;
};

async function list(query, user) {
  return ScientificPost.find(buildQuery(query, user))
    .sort({ createdAt: -1 })
    .populate(POPULATE)
    .lean();
}

async function paginate(query, user) {
  const { page, limit } = query;
  return ScientificPost.paginate(buildQuery(query, user), {
    page: Number(page),
    limit: Number(limit),
    sort: { createdAt: -1 },
    populate: POPULATE,
    lean: true,
  });
}

async function findById(id, user) {
  const doc = await ScientificPost.findOne({ _id: id, ...visibilityFilter(user) })
    .populate(POPULATE)
    .lean();
  if (!doc || !doc.active) throw new ErrorHandler(404, "E'lon topilmadi");
  return doc;
}

async function resolveRecipientIds(recipients, excludeUserId) {
  const titles = [...new Set((recipients || []).flatMap((r) => RECIPIENT_ROLES[r] || []))];
  if (!titles.length) return [];
  const roles = await Role.find({ title: { $in: titles } }).select("_id").lean();
  const roleIds = roles.map((r) => r._id);
  const users = await User.find({ role: { $in: roleIds }, active: true })
    .select("_id")
    .lean();
  return users
    .map((u) => u._id)
    .filter((id) => String(id) !== String(excludeUserId));
}

async function notifyRecipients(post) {
  try {
    const userIds = await resolveRecipientIds(post.recipients, post.author);
    if (!userIds.length) return;
    await dispatchMany({
      userIds,
      eventType: "scientific_post",
      title: post.title,
      body: post.text,
      link: "/scientific-department/posts",
      metadata: { postId: String(post._id), specialtyCode: post.specialtyCode || "" },
    });
  } catch (err) {
    winston.error(`[ScientificPost] bildirishnoma xato: ${err.message}`);
  }
}

async function create(user, payload) {
  const post = await ScientificPost.create({
    title: payload.title,
    text: payload.text,
    recipients: payload.recipients && payload.recipients.length ? payload.recipients : ["all"],
    telegram: payload.telegram !== undefined ? payload.telegram : true,
    specialtyCode: payload.specialtyCode || "",
    author: user?._id || null,
  });
  await notifyRecipients(post);
  return post;
}

async function softDelete(id) {
  const doc = await ScientificPost.findById(id);
  if (!doc || !doc.active) throw new ErrorHandler(404, "E'lon topilmadi");
  doc.active = false;
  await doc.save();
  return doc;
}

module.exports = { list, paginate, findById, create, softDelete, visibilityFilter };
