"use strict";

const { ROLES } = require("#config/constants");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const notify = require("#modules/4.05-residency/_services/announcementNotify");
const files = require("#modules/4.05-residency/_services/announcementFiles");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Announcement = require("./residencyAnnouncement.model");
const AnnouncementRead = require("./residencyAnnouncementRead.model");
const { MAX_FILES, MAX_TOTAL_SIZE } = require("./residencyAnnouncement.upload");

const ROLE_AUDIENCE = {
  [ROLES.MAGISTRANT]: "magistratura",
  [ROLES.REZIDENT]: "ordinatura",
  [ROLES.ILMIY_RAHBAR]: "magistratura",
  [ROLES.KLINIK_USTOZ]: "ordinatura",
  [ROLES.KAFEDRA_MUDIRI]: "kafedra_mudirlari",
};

const buildAudienceScope = (user) => {
  const role = user?.role || {};
  if (role.scopeLevel === "global" || role.title === ROLES.MAGISTRATURA_BOLIM) {
    return {};
  }
  const own = ROLE_AUDIENCE[role.title];
  return { audience: own ? { $in: ["umumiy", own] } : "umumiy" };
};

const TARGETED_ROLES = new Set([ROLES.REZIDENT, ROLES.MAGISTRANT]);

const dimension = (field, value) => {
  const or = [{ [field]: { $size: 0 } }, { [field]: { $exists: false } }];
  if (value !== null && value !== undefined) or.push({ [field]: value });
  return { $or: or };
};

const unset = (field) => ({
  $or: [{ [field]: { $size: 0 } }, { [field]: { $exists: false } }],
});

const courseDimension = (resident) => {
  const or = [{ $and: [unset("targetCourses"), unset("targetCoursesRef")] }];
  if (resident?.courseNumber !== null && resident?.courseNumber !== undefined) {
    or.push({ targetCourses: resident.courseNumber });
  }
  if (resident?.courseRef) or.push({ targetCoursesRef: resident.courseRef });
  return { $or: or };
};

const buildTargetScope = async (user) => {
  if (!TARGETED_ROLES.has(user?.role?.title)) return null;

  const resident = await Resident.findOne({ user: user._id })
    .select("courseNumber courseRef specialty")
    .lean();

  return {
    $and: [
      courseDimension(resident),
      dimension("targetSpecialties", resident?.specialty ?? null),
    ],
  };
};

const buildScope = async (user) => {
  const audience = buildAudienceScope(user);
  const target = await buildTargetScope(user);
  if (!target) return audience;
  return Object.keys(audience).length ? { $and: [audience, target] } : target;
};

const findVisible = async (announcementId, user) =>
  Announcement.findOne({ _id: announcementId, ...(await buildScope(user)) });

const MB = 1024 * 1024;
const mb = (bytes) => Math.round(bytes / MB);

const humanSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
};

const totalBytes = (attachments = []) =>
  attachments.reduce((sum, a) => sum + (a.bytes || 0), 0);

const fullName = (u) =>
  u ? [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ") : null;

const addAttachments = async (announcementId, drafts, user) => {
  const committed = [];
  try {
    const doc = await Announcement.findById(announcementId);
    if (!doc) {
      throw new ErrorHandler(404, "E'lon topilmadi", "ANNOUNCEMENT_NOT_FOUND");
    }

    const existing = doc.attachments || [];

    if (existing.length + drafts.length > MAX_FILES) {
      throw new ErrorHandler(
        400,
        `Bitta e'longa ko'pi bilan ${MAX_FILES} ta fayl biriktirish mumkin (hozir ${existing.length} ta)`,
        "ATTACHMENT_TOO_MANY",
      );
    }

    const projected = totalBytes(existing) + totalBytes(drafts);
    if (projected > MAX_TOTAL_SIZE) {
      throw new ErrorHandler(
        400,
        `E'londagi fayllarning umumiy hajmi ${mb(MAX_TOTAL_SIZE)} MB dan oshmasligi kerak (hozir ${humanSize(totalBytes(existing))})`,
        "ATTACHMENT_QUOTA_EXCEEDED",
      );
    }

    const seen = new Set(existing.map((a) => a.checksum));
    for (const draft of drafts) {
      if (seen.has(draft.checksum)) {
        throw new ErrorHandler(
          400,
          `"${draft.name}" bu e'longa allaqachon biriktirilgan`,
          "ATTACHMENT_DUPLICATE",
        );
      }
      seen.add(draft.checksum);
    }

    const rows = [];
    for (const draft of drafts) {
      const storageKey = files.buildStorageKey(draft.ext);
      await files.commit(draft.tmpPath, storageKey);
      committed.push(storageKey);
      rows.push({
        name: draft.name,
        size: humanSize(draft.bytes),
        type: draft.ext.replace(".", ""),
        bytes: draft.bytes,
        mimeType: draft.mimeType,
        storageKey,
        checksum: draft.checksum,
        uploadedBy: user?._id || null,
        uploadedByName: fullName(user),
        uploadedAt: new Date(),
      });
    }

    const updated = await Announcement.findOneAndUpdate(
      {
        _id: announcementId,
        $expr: { $lte: [{ $size: "$attachments" }, MAX_FILES - rows.length] },
      },
      { $push: { attachments: { $each: rows } } },
      { new: true, runValidators: true },
    );

    if (!updated) {
      throw new ErrorHandler(
        400,
        `Bitta e'longa ko'pi bilan ${MAX_FILES} ta fayl biriktirish mumkin`,
        "ATTACHMENT_TOO_MANY",
      );
    }

    const created = updated.attachments.slice(-rows.length);
    return { doc: updated, created };
  } catch (err) {
    await files.removeMany(committed);
    await files.discardMany(drafts.map((d) => d.tmpPath));
    throw err;
  }
};

const removeAttachment = async (announcementId, attachmentId) => {
  const doc = await Announcement.findById(announcementId);
  if (!doc) {
    throw new ErrorHandler(404, "E'lon topilmadi", "ANNOUNCEMENT_NOT_FOUND");
  }

  const attachment = doc.attachments.id(attachmentId);
  if (!attachment) {
    throw new ErrorHandler(404, "Fayl topilmadi", "ATTACHMENT_NOT_FOUND");
  }

  const { storageKey } = attachment;

  const updated = await Announcement.findOneAndUpdate(
    { _id: announcementId },
    { $pull: { attachments: { _id: attachment._id } } },
    { new: true },
  );

  await files.remove(storageKey);
  return updated;
};

const findAttachmentForDownload = async (announcementId, attachmentId, user) => {
  const doc = await findVisible(announcementId, user);
  if (!doc) {
    throw new ErrorHandler(404, "E'lon topilmadi", "ANNOUNCEMENT_NOT_FOUND");
  }

  const attachment = doc.attachments.id(attachmentId);
  if (!attachment) {
    throw new ErrorHandler(404, "Fayl topilmadi", "ATTACHMENT_NOT_FOUND");
  }

  const stat = await files.stat(attachment.storageKey);
  if (!stat) {
    winston.error(
      `[residencyAnnouncement] yetim yozuv — blob topilmadi: ${attachment.storageKey}`,
    );
    throw new ErrorHandler(404, "Fayl topilmadi", "ATTACHMENT_NOT_FOUND");
  }

  return { attachment, size: stat.size };
};

const deleteAnnouncement = async (announcementId) => {
  const doc = await Announcement.hardDelete(announcementId);
  if (!doc) return null;

  await AnnouncementRead.deleteMany({ announcement: announcementId });

  await notify.revokeAll(announcementId);

  const keys = (doc.attachments || []).map((a) => a.storageKey).filter(Boolean);
  if (keys.length) {
    const removed = await files.removeMany(keys);
    if (removed !== keys.length) {
      winston.warn(
        `[residencyAnnouncement] ${announcementId}: ${keys.length - removed} ta blob o'chmadi`,
      );
    }
  }
  return doc;
};

const AUDIENCE_PROGRAM = {
  magistratura: "magistratura",
  ordinatura: "ordinatura",
};

const findRecipients = async (doc) => {
  if (doc.audience === "kafedra_mudirlari") return [];

  const filter = { user: { $ne: null } };
  const program = AUDIENCE_PROGRAM[doc.audience];
  if (program) filter.program = program;
  const courseOr = [];
  if (doc.targetCourses?.length) courseOr.push({ courseNumber: { $in: doc.targetCourses } });
  if (doc.targetCoursesRef?.length) courseOr.push({ courseRef: { $in: doc.targetCoursesRef } });
  if (courseOr.length) filter.$or = courseOr;
  if (doc.targetSpecialties?.length) {
    filter.specialty = { $in: doc.targetSpecialties };
  }

  const residents = await Resident.find(filter)
    .select("user fullName courseNumber specialtyTitle program")
    .lean();

  const seen = new Set();
  return residents.filter((r) => {
    const key = String(r.user);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const findNotifyTargets = async (doc) =>
  (await findRecipients(doc)).map((r) => String(r.user));

const notifyAudience = async (doc) =>
  notify.notifyAll(doc, await findNotifyTargets(doc));

const syncNotificationsInBackground = async (doc) => {
  notify.syncInBackground(doc, await findNotifyTargets(doc));
};

const notifyAudienceInBackground = (doc) => {
  setImmediate(() => {
    notifyAudience(doc)
      .then((sent) => {
        if (sent) {
          winston.info(
            `[residencyAnnouncement] ${doc._id}: ${sent} ta bildirishnoma yuborildi`,
          );
        }
      })
      .catch((err) =>
        winston.error(
          `[residencyAnnouncement] bildirishnoma fan-out xatosi (${doc._id}): ${err.message}`,
        ),
      );
  });
};

const markAsRead = async (announcementId, user) => {
  const visible = await findVisible(announcementId, user);
  if (!visible) {
    throw new ErrorHandler(404, "E'lon topilmadi", "ANNOUNCEMENT_NOT_FOUND");
  }

  const res = await AnnouncementRead.updateOne(
    { announcement: announcementId, user: user._id },
    { $setOnInsert: { readAt: new Date() } },
    { upsert: true },
  );
  return { already: !res.upsertedCount };
};

const getReadStats = async (announcementId) => {
  const doc = await Announcement.findById(announcementId).select(
    "title audience targetCourses targetCoursesRef targetSpecialties",
  );
  if (!doc) {
    throw new ErrorHandler(404, "E'lon topilmadi", "ANNOUNCEMENT_NOT_FOUND");
  }

  const [recipients, reads] = await Promise.all([
    findRecipients(doc),
    AnnouncementRead.find({ announcement: announcementId })
      .select("user readAt")
      .lean(),
  ]);
  const readAtByUser = new Map(reads.map((r) => [String(r.user), r.readAt]));

  const read = [];
  const unread = [];
  for (const r of recipients) {
    const row = {
      user: String(r.user),
      fullName: r.fullName,
      courseNumber: r.courseNumber ?? null,
      specialtyTitle: r.specialtyTitle ?? null,
      program: r.program,
    };
    const readAt = readAtByUser.get(String(r.user));
    if (readAt) read.push({ ...row, readAt });
    else unread.push(row);
  }

  read.sort((a, b) => new Date(b.readAt) - new Date(a.readAt));
  unread.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));

  return {
    total: recipients.length,
    readCount: read.length,
    unreadCount: unread.length,
    percent: recipients.length
      ? Math.round((read.length / recipients.length) * 100)
      : null,
    read,
    unread,
  };
};

const attachIsRead = async (docs, userId) => {
  if (!docs.length) return [];
  const readIds = await AnnouncementRead.find({
    user: userId,
    announcement: { $in: docs.map((d) => d._id) },
  }).distinct("announcement");
  const readSet = new Set(readIds.map(String));

  return docs.map((doc) => {
    const obj = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
    obj.isRead = readSet.has(String(doc._id));
    return obj;
  });
};

module.exports = {
  buildAudienceScope,
  buildTargetScope,
  buildScope,
  findRecipients,
  findNotifyTargets,
  markAsRead,
  getReadStats,
  attachIsRead,
  notifyAudience,
  notifyAudienceInBackground,
  syncNotificationsInBackground,
  findVisible,
  humanSize,
  addAttachments,
  removeAttachment,
  findAttachmentForDownload,
  deleteAnnouncement,
};
