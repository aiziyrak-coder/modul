const mongoose = require("mongoose");
const QualCourseSubscription = require("#modules/4.04-qualification/qualCourseSubscription/qualCourseSubscription.model");
const QualCourse = require("#modules/4.04-qualification/qualCourse/qualCourse.model");
const QualListener = require("#modules/4.04-qualification/_shared/qualListener.model");
const User = require("#modules/4.01-auth/user/user.model");
const ChatMessage = require("#system/chat/chatMessage.model");
const { isOnlineBatch } = require("#system/_shared/socketHandler");
const { callListener } = require("#modules/4.04-qualification/_shared/listenerApi");
const { getListenerId } = require("#modules/4.04-qualification/_shared/listenerContext");

const LISTENER_ROLE = "malaka_tinglovchi";
const CONTACT_FIELDS = "firstName lastName photo workingSchedule lastSeen";

const withOnlineBatch = async (users) => {
  const online = await isOnlineBatch(users.map((u) => u._id));
  return users.map((u) => ({ ...u, online: online.get(String(u._id)) ?? false }));
};

async function listenerContacts(req) {
  const listenerId = await getListenerId(req);
  if (!listenerId) return [];
  const listener = { _id: listenerId };

  const subs = await QualCourseSubscription.find({ listener: listener._id })
    .select("course")
    .lean();
  const courseIds = subs.map((s) => s.course).filter(Boolean);
  if (!courseIds.length) return [];

  const courses = await QualCourse.find({ _id: { $in: courseIds } })
    .select("teachers")
    .lean();
  const teacherIds = [
    ...new Set(courses.flatMap((c) => (c.teachers || []).map(String))),
  ];
  if (!teacherIds.length) return [];

  return User.find({ _id: { $in: teacherIds }, active: true })
    .select(CONTACT_FIELDS)
    .lean();
}

async function teacherContacts(user) {
  const courses = await QualCourse.find({ teachers: user._id }).select("_id").lean();
  const courseIds = courses.map((c) => c._id);
  if (!courseIds.length) return [];

  const subs = await QualCourseSubscription.find({ course: { $in: courseIds } })
    .select("listener")
    .lean();
  const listenerIds = [...new Set(subs.map((s) => String(s.listener)))];
  if (!listenerIds.length) return [];

  const listeners = await QualListener.find({ _id: { $in: listenerIds } })
    .select("fullName lastSeen")
    .lean();

  return listeners.map((l) => {
    const parts = String(l.fullName || "").trim().split(/\s+/).filter(Boolean);
    return {
      _id: l._id,
      lastName: parts[0] || null,
      firstName: parts[1] || null,
      middleName: parts.slice(2).join(" ") || null,
      photo: null,
      workingSchedule: [],
      lastSeen: l.lastSeen ?? null,
    };
  });
}

async function contacts(req) {
  const user = req.user || {};
  const isListener = !!req.listenerId || (user.role && user.role.title) === LISTENER_ROLE;
  const list = isListener ? await listenerContacts(req) : await teacherContacts(user);
  return withOnlineBatch(list);
}

async function conversations(myUserId) {
  return callListener("/chat/conversations", { actAs: myUserId });
}

async function chatThread(myUserId, otherUserId, query) {
  return callListener(`/chat/${otherUserId}`, { actAs: myUserId, query });
}

async function chatSend(myUserId, body) {
  return callListener("/chat/send", { method: "POST", actAs: myUserId, body });
}

async function chatUnread(myUserId) {
  return callListener("/chat/unread-count", { actAs: myUserId });
}

async function chatDelete(myUserId, id) {
  return callListener(`/chat/${id}`, { method: "DELETE", actAs: myUserId });
}

async function _legacyConversations(myUserId) {
  const me = new mongoose.Types.ObjectId(String(myUserId));

  const rows = await ChatMessage.aggregate([
    { $match: { $or: [{ sender: me }, { receiver: me }], isDeleted: false } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { $cond: [{ $eq: ["$sender", me] }, "$receiver", "$sender"] },
        lastMessage: { $first: "$$ROOT" },
        unreadCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$receiver", me] }, { $eq: ["$readAt", null] }] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    {
      $project: {
        "user._id": 1,
        "user.firstName": 1,
        "user.lastName": 1,
        "user.photo": 1,
        "user.workingSchedule": 1,
        "user.lastSeen": 1,
        "lastMessage.message": 1,
        "lastMessage.createdAt": 1,
        "lastMessage.fileType": 1,
        "lastMessage.sender": 1,
        "lastMessage.readAt": 1,
        unreadCount: 1,
      },
    },
    { $sort: { "lastMessage.createdAt": -1 } },
  ]);

  const usersWithOnline = await withOnlineBatch(rows.map((c) => c.user));
  return rows.map((c, i) => ({ ...c, user: usersWithOnline[i] }));
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function sanitizeSchedule(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (s) =>
        s &&
        Number.isInteger(s.day) &&
        s.day >= 1 &&
        s.day <= 7 &&
        HHMM.test(s.from) &&
        HHMM.test(s.to) &&
        s.from < s.to,
    )
    .map((s) => ({ day: s.day, from: s.from, to: s.to }))
    .sort((a, b) => a.day - b.day);
}

async function getProfile(userId) {
  const u = await User.findById(userId)
    .select("firstName lastName photo workingSchedule")
    .lean();
  return {
    firstName: u?.firstName ?? "",
    lastName: u?.lastName ?? "",
    photo: u?.photo ?? null,
    workingSchedule: u?.workingSchedule ?? [],
  };
}

async function updateProfile(userId, workingSchedule) {
  const clean = sanitizeSchedule(workingSchedule);
  await User.findByIdAndUpdate(userId, { workingSchedule: clean }, { runValidators: true });
  return { workingSchedule: clean };
}

module.exports = {
  contacts,
  conversations,
  chatThread,
  chatSend,
  chatUnread,
  chatDelete,
  getProfile,
  updateProfile,
};
