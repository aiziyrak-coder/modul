const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const files = require("#modules/4.05-residency/_services/announcementFiles");
const Announcement = require("./residencyAnnouncement.model");
const service = require("./residencyAnnouncement.service");
const {
  applyAcademicYearFilter,
} = require("#modules/4.05-residency/_services/academicYearFilter");
const { searchRegex } = require("#modules/4.05-residency/_services/searchTerm");

const POP = [
  { path: "createdBy", select: "firstName lastName middleName" },
  { path: "attachments.uploadedBy", select: "firstName lastName middleName" },
];

const fullName = (u) =>
  u ? [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ") : null;

const wrapErr = (err, fallback) =>
  err instanceof ErrorHandler ? err : new ErrorHandler(400, fallback, err.message);

const contentDisposition = (name) => {
  const safe = String(name || "fayl");
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
};

function buildFilter(query) {
  const { search, audience, academicYear, active } = query;
  const data = {};
  if (audience) data.audience = audience;
  applyAcademicYearFilter(data, academicYear);
  if (active !== undefined) data.active = active;
  const rx = searchRegex(search);
  if (rx) data.title = rx;
  return data;
}

async function buildQuery(req) {
  const filter = buildFilter(req.query);
  const scope = await service.buildScope(req.user);
  return Object.keys(scope).length ? { $and: [filter, scope] } : filter;
}

module.exports = {
  requireVisibleAnnouncement: async (req, res, next) => {
    try {
      const visible = await service.findVisible(req.params.id, req.user);
      if (!visible) return res.status(404).json({ message: "not found" });
      return next();
    } catch (err) {
      return next(wrapErr(err, "E'lonni tekshirishda xato"));
    }
  },

  addAnnouncement: async (req, res, next) => {
    try {
      const doc = await new Announcement({
        ...req.body,
        createdBy: req.user._id,
        createdByName: fullName(req.user),
      }).save();
      res.status(201).json({ message: "successfully created", _id: doc._id });

      service.notifyAudienceInBackground(doc);
      return undefined;
    } catch (err) {
      return next(new ErrorHandler(400, "E'lon yaratishda xato", err.message));
    }
  },

  findAllAnnouncements: async (req, res, next) => {
    try {
      const query = await buildQuery(req);
      const docs = await Announcement.find(query).populate(POP).sort({ createdAt: -1 });
      return res.status(200).json(await service.attachIsRead(docs, req.user._id));
    } catch (err) {
      return next(new ErrorHandler(400, "E'lonlar ro'yxati xatosi", err.message));
    }
  },

  paginateAnnouncements: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const query = await buildQuery(req);
      const doc = await Announcement.paginate(query, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: POP,
      });
      return res.status(200).json({
        ...doc,
        docs: await service.attachIsRead(doc.docs, req.user._id),
      });
    } catch (err) {
      return next(new ErrorHandler(400, "E'lon sahifalash xatosi", err.message));
    }
  },

  updateAnnouncement: async (req, res, next) => {
    try {
      const doc = await Announcement.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      await service.syncNotificationsInBackground(doc);
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "E'lonni yangilashda xato", err.message));
    }
  },

  deleteAnnouncement: async (req, res, next) => {
    try {
      const doc = await service.deleteAnnouncement(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(wrapErr(err, "E'lonni o'chirishda xato"));
    }
  },

  addAttachments: async (req, res, next) => {
    try {
      const { doc, created } = await service.addAttachments(
        req.params.id,
        req.attachmentDrafts,
        req.user,
      );
      return res.status(201).json({
        message: "successfully uploaded",
        created,
        attachments: doc.attachments,
      });
    } catch (err) {
      return next(wrapErr(err, "Fayl biriktirishda xato"));
    }
  },

  deleteAttachment: async (req, res, next) => {
    try {
      const doc = await service.removeAttachment(
        req.params.id,
        req.params.attachmentId,
      );
      return res
        .status(200)
        .json({ message: "successfully deleted", attachments: doc.attachments });
    } catch (err) {
      return next(wrapErr(err, "Faylni o'chirishda xato"));
    }
  },

  markRead: async (req, res, next) => {
    try {
      const { already } = await service.markAsRead(req.params.id, req.user);
      return res
        .status(200)
        .json({ message: already ? "already read" : "marked as read" });
    } catch (err) {
      return next(wrapErr(err, "O'qilgan deb belgilashda xato"));
    }
  },

  readStats: async (req, res, next) => {
    try {
      return res.status(200).json(await service.getReadStats(req.params.id));
    } catch (err) {
      return next(wrapErr(err, "Hisobot olishda xato"));
    }
  },

  downloadAttachment: async (req, res, next) => {
    try {
      const { attachment, size } = await service.findAttachmentForDownload(
        req.params.id,
        req.params.attachmentId,
        req.user,
      );

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Length", size);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", contentDisposition(attachment.name));

      const stream = files.createReadStream(attachment.storageKey);
      stream.on("error", (err) => {
        winston.error(
          `[residencyAnnouncement] fayl oqimi uzildi (${attachment.storageKey}): ${err.message}`,
        );
        res.destroy();
      });
      return stream.pipe(res);
    } catch (err) {
      return next(wrapErr(err, "Faylni yuklab olishda xato"));
    }
  },
};
