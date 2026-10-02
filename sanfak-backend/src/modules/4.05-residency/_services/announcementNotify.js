"use strict";

const Notification = require("#system/notification/notification.model");
const {
  dispatch,
} = require("#system/notification/notificationDispatcher");
const winston = require("#shared/winston.logger");

const EVENT_TYPE = "residency_announcement_published";

const buildPayload = (doc, userId) => ({
  userId: String(userId),
  eventType: EVENT_TYPE,
  title: "Yangi e'lon",
  body: doc.title,
  link: `/residency/elonlar?id=${doc._id}`,
  metadata: { announcementId: String(doc._id) },
});

const findFor = (announcementId) =>
  Notification.find({
    eventType: EVENT_TYPE,
    "metadata.announcementId": String(announcementId),
  })
    .select("user active")
    .lean();

const notifyAll = async (doc, userIds) => {
  let sent = 0;
  for (const userId of userIds) {
    try {
      await dispatch(buildPayload(doc, userId));
      sent += 1;
    } catch (err) {
      winston.error(
        `[announcementNotify] bildirishnoma yuborilmadi (${userId}): ${err.message}`,
      );
    }
  }
  return sent;
};

const sync = async (doc, shouldUserIds) => {
  const should = new Set(shouldUserIds.map(String));
  const existing = await findFor(doc._id);

  const staleIds = [];
  const dormantIds = [];
  const seen = new Set();

  for (const row of existing) {
    const uid = String(row.user);
    seen.add(uid);
    if (row.active && !should.has(uid)) staleIds.push(row._id);
    else if (!row.active && should.has(uid)) dormantIds.push(row._id);
  }
  const missing = [...should].filter((uid) => !seen.has(uid));

  if (staleIds.length) {
    await Notification.updateMany(
      { _id: { $in: staleIds } },
      { active: false },
    );
  }
  if (dormantIds.length) {
    await Notification.updateMany(
      { _id: { $in: dormantIds } },
      { active: true },
    );
  }
  const created = missing.length ? await notifyAll(doc, missing) : 0;

  return { revoked: staleIds.length, restored: dormantIds.length, created };
};

const revokeAll = async (announcementId) => {
  const res = await Notification.updateMany(
    {
      eventType: EVENT_TYPE,
      "metadata.announcementId": String(announcementId),
      active: true,
    },
    { active: false },
  );
  return res.modifiedCount ?? 0;
};

const syncInBackground = (doc, shouldUserIds) => {
  setImmediate(() => {
    sync(doc, shouldUserIds).catch((err) =>
      winston.error(
        `[announcementNotify] sinxronlash yiqildi (${doc._id}): ${err.message}`,
      ),
    );
  });
};

module.exports = {
  EVENT_TYPE,
  buildPayload,
  notifyAll,
  sync,
  syncInBackground,
  revokeAll,
};
