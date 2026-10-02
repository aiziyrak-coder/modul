const { ErrorHandler } = require("#shared/error");
const Announcement = require("#system/announcement/announcement.model");
const { notify, templates } = require("#system/notification/notification.service");
const winston = require("#shared/winston.logger");
const {
  dispatchMany,
} = require("#system/notification/notificationDispatcher");
const {
  resolveAudienceFilter,
  resolveAnnouncementAudienceUserIds,
} = require("./announcement.audience");

module.exports = {
  addAnnouncement: async (req, res, next) => {
    try {
      const doc = await new Announcement({
        ...req.body,
        publishedBy: req.user._id,
      }).save();

      if (!doc) return res.status(404).json({ message: "Saqlab bo'lmadi" });

      await notify({
        message: templates.announcementNew(doc.title, doc.module),
        type: "telegram",
      });

      try {
        const audienceIds = await resolveAnnouncementAudienceUserIds(doc);
        if (audienceIds && audienceIds.length) {
          await dispatchMany({
            userIds: audienceIds,
            eventType: "announcement_new",
            title: doc.title,
            body: doc.body,
            metadata: { announcementId: doc._id, module: doc.module },
          });
        }
      } catch (notifErr) {
        winston.warn(`[Announcement] in-app dispatch xato: ${notifErr.message}`);
      }

      return res
        .status(201)
        .json({ message: "E'lon muvaffaqiyatli yaratildi" });
    } catch (err) {
      return next(new ErrorHandler(400, "E'lon yaratishda xato", err.message));
    }
  },

  findAll: async (req, res, next) => {
    try {
      const userId = req.user._id;
      const { module: mod, search } = req.query;
      const audienceOr = await resolveAudienceFilter(userId);

      let filter = {
        active: true,
        $or: [{ expiresAt: { $gte: new Date() } }, { expiresAt: null }],
        $and: [{ $or: audienceOr }],
      };
      if (mod) filter.module = mod;
      if (search) filter.title = { $regex: new RegExp(search, "i") };

      const docs = await Announcement.find(filter, {
        readBy: 0,
        createdAt: 0,
        updatedAt: 0,
        targetUsers: 0,
      })
        .populate("publishedBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .exec();

      if (!docs) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "E'lonlarni olishda xato", err.message),
      );
    }
  },

  getMyAnnouncements: async (req, res, next) => {
    try {
      const userId = req.user._id;
      const { module: mod, page = 1, limit = 10 } = req.query;

      const audienceOr = await resolveAudienceFilter(userId);

      let filter = {
        active: true,
        $or: [{ expiresAt: { $gte: new Date() } }, { expiresAt: null }],
        $and: [{ $or: audienceOr }],
      };
      if (mod) filter.module = mod;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [{ path: "publishedBy", select: "firstName lastName" }],
      };

      const doc = await Announcement.paginate(filter, options);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      const result = doc.docs.map((a) => {
        const obj = a.toObject ? a.toObject() : a;
        const isRead =
          (obj.readBy || []).some(
            (r) => String(r.user) === String(userId),
          );
        delete obj.readBy;
        return { ...obj, isRead };
      });

      return res.status(200).json({ ...doc, docs: result });
    } catch (err) {
      return next(
        new ErrorHandler(400, "E'lonlarni olishda xato", err.message),
      );
    }
  },

  paginate: async (req, res, next) => {
    try {
      const { module: mod, active, search, page = 1, limit = 10 } = req.query;
      let filter = {};
      if (mod) filter.module = mod;
      if (search) filter.title = { $regex: new RegExp(search, "i") };
      if (active !== undefined) filter.active = active === "true";

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [{ path: "publishedBy", select: "firstName lastName" }],
        select: "-readBy",
      };

      const doc = await Announcement.paginate(filter, options);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Sahifalashda xato", err.message));
    }
  },

  findOne: async (req, res, next) => {
    try {
      const userId = req.user._id;
      const audienceOr = await resolveAudienceFilter(userId);

      const doc = await Announcement.findOne({
        _id: req.params.id,
        active: true,
        $or: [{ expiresAt: { $gte: new Date() } }, { expiresAt: null }],
        $and: [{ $or: audienceOr }],
      })
        .populate("publishedBy", "firstName lastName")
        .exec();
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "E'lonni olishda xato", err.message));
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await Announcement.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json({ message: "Muvaffaqiyatli yangilandi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xato", err.message));
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await Announcement.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json({ message: "E'lon o'chirildi" });
    } catch (err) {
      return next(new ErrorHandler(400, "O'chirishda xato", err.message));
    }
  },

  markAsRead: async (req, res, next) => {
    try {
      const userId = req.user._id;

      const already = await Announcement.findOne({
        _id: req.params.id,
        "readBy.user": userId,
      });

      if (already) {
        return res.status(200).json({ message: "Allaqachon o'qilgan" });
      }

      await Announcement.findByIdAndUpdate(req.params.id, {
        $push: { readBy: { user: userId, readAt: new Date() } },
      });

      return res.status(200).json({ message: "O'qildi deb belgilandi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Belgilashda xato", err.message));
    }
  },

  getUnreadCount: async (req, res, next) => {
    try {
      const userId = req.user._id;

      const audienceOr = await resolveAudienceFilter(userId);

      const count = await Announcement.countDocuments({
        active: true,
        $or: [{ expiresAt: { $gte: new Date() } }, { expiresAt: null }],
        "readBy.user": { $ne: userId },
        $and: [{ $or: audienceOr }],
      });
      return res.status(200).json({ count });
    } catch (err) {
      return next(new ErrorHandler(400, "Hisoblashda xato", err.message));
    }
  },

  sendToGroup: async (req, res, next) => {
    try {
      const { title, body, targetUsers, module: mod, expiresAt } = req.body;
      const doc = await new Announcement({
        title,
        body,
        module: mod,
        targetUsers: targetUsers || [],
        expiresAt: expiresAt || null,
        publishedBy: req.user._id,
        active: true,
      }).save();
      if (!doc) return res.status(404).json({ message: "Saqlab bo'lmadi" });
      return res.status(201).json({ message: "E'lon guruhga yuborildi" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Guruhga yuborishda xato", err.message),
      );
    }
  },

  getModuleAnnouncements: async (req, res, next) => {
    try {
      const { module: mod } = req.params;
      const userId = req.user._id;
      const audienceOr = await resolveAudienceFilter(userId);

      const docs = await Announcement.find(
        {
          module: mod,
          active: true,
          $or: [{ expiresAt: { $gte: new Date() } }, { expiresAt: null }],
          $and: [{ $or: audienceOr }],
        },
        { readBy: 0, createdAt: 0, updatedAt: 0, targetUsers: 0 },
      )
        .populate("publishedBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Modul e'lonlarini olishda xato", err.message),
      );
    }
  },

  getReadStats: async (req, res, next) => {
    try {
      const doc = await Announcement.findById(req.params.id)
        .populate("readBy.user", "firstName lastName")
        .exec();
      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      return res.status(200).json({
        total: doc.readBy.length,
        readBy: doc.readBy,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Hisobot olishda xato", err.message));
    }
  },
};
