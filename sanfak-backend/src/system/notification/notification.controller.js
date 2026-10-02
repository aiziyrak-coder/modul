const { ErrorHandler } = require("#shared/error");
const Notification = require("#system/notification/notification.model");
const NotificationPreference = require("#system/notification/notificationPreference.model");

module.exports = {
  myFeed: async (req, res, next) => {
    try {
      const { read, eventType, page = 1, limit = 20 } = req.query;
      const filter = { user: req.user._id, active: true };
      if (read !== undefined) filter.read = read === "true";
      if (eventType) filter.eventType = eventType;

      const result = await Notification.paginate(filter, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        select: "-deliveryStatus -channels",
      });
      return res.status(200).json(result);
    } catch (err) {
      return next(new ErrorHandler(400, "Feed olishda xato", err.message));
    }
  },

  unreadCount: async (req, res, next) => {
    try {
      const count = await Notification.countDocuments({
        user: req.user._id,
        read: false,
        active: true,
      });
      return res.status(200).json({ count });
    } catch (err) {
      return next(new ErrorHandler(400, "Hisoblashda xato", err.message));
    }
  },

  markRead: async (req, res, next) => {
    try {
      const doc = await Notification.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { read: true, readAt: new Date() },
        { new: true },
      );
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json({ message: "O'qildi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Belgilashda xato", err.message));
    }
  },

  markAllRead: async (req, res, next) => {
    try {
      const result = await Notification.updateMany(
        { user: req.user._id, read: false },
        { read: true, readAt: new Date() },
      );
      return res.status(200).json({
        message: "Hammasi o'qildi",
        modified: result.modifiedCount,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Belgilashda xato", err.message));
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await Notification.findOneAndDelete({
        _id: req.params.id,
        user: req.user._id,
      });
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json({ message: "O'chirildi" });
    } catch (err) {
      return next(new ErrorHandler(400, "O'chirishda xato", err.message));
    }
  },

  getPreferences: async (req, res, next) => {
    try {
      let pref = await NotificationPreference.findOne({ user: req.user._id });
      if (!pref) {
        pref = await NotificationPreference.create({ user: req.user._id });
      }
      const prefsObj = {};
      if (pref.preferences && pref.preferences.forEach) {
        pref.preferences.forEach((v, k) => (prefsObj[k] = v));
      }
      return res.status(200).json({
        preferences: prefsObj,
        digest: pref.digest,
        paused: pref.paused,
        pausedUntil: pref.pausedUntil,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Preferences olishda xato", err.message));
    }
  },

  updatePreferences: async (req, res, next) => {
    try {
      const { preferences, digest, paused, pausedUntil } = req.body;
      const updateObj = {};
      if (preferences && typeof preferences === "object") {
        const map = new Map();
        for (const [k, v] of Object.entries(preferences)) {
          map.set(k, v);
        }
        updateObj.preferences = map;
      }
      if (digest) updateObj.digest = digest;
      if (paused !== undefined) updateObj.paused = paused;
      if (pausedUntil !== undefined) updateObj.pausedUntil = pausedUntil;

      const pref = await NotificationPreference.findOneAndUpdate(
        { user: req.user._id },
        updateObj,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      return res.status(200).json({ message: "Yangilandi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xato", err.message));
    }
  },
};
