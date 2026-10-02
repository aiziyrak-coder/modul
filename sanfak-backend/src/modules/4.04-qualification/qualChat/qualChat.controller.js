const { ErrorHandler } = require("#shared/error");
const service = require("./qualChat.service");

module.exports = {
  contacts: async (req, res, next) => {
    try {
      const list = await service.contacts(req);
      return res.status(200).json(list);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Chat kontaktlarini olishda xato", err.message),
      );
    }
  },

  conversations: async (req, res, next) => {
    try {
      const list = await service.conversations(req.user._id);
      return res.status(200).json(list);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Suhbatlar ro'yxatini olishda xato", err.message),
      );
    }
  },

  chatThread: async (req, res, next) => {
    try {
      return res
        .status(200)
        .json(await service.chatThread(req.user._id, req.params.userId, req.query));
    } catch (err) {
      return next(err.statusCode ? err : new ErrorHandler(400, "Suhbat tarixida xato", err.message));
    }
  },

  chatSend: async (req, res, next) => {
    try {
      return res.status(201).json(await service.chatSend(req.user._id, req.body));
    } catch (err) {
      return next(err.statusCode ? err : new ErrorHandler(400, "Xabar yuborishda xato", err.message));
    }
  },

  chatUnread: async (req, res, next) => {
    try {
      return res.status(200).json(await service.chatUnread(req.user._id));
    } catch (err) {
      return next(err.statusCode ? err : new ErrorHandler(400, "O'qilmaganlarda xato", err.message));
    }
  },

  chatDelete: async (req, res, next) => {
    try {
      return res.status(200).json(await service.chatDelete(req.user._id, req.params.id));
    } catch (err) {
      return next(err.statusCode ? err : new ErrorHandler(400, "O'chirishda xato", err.message));
    }
  },

  getProfile: async (req, res, next) => {
    try {
      return res.status(200).json(await service.getProfile(req.user._id));
    } catch (err) {
      return next(new ErrorHandler(400, "Profilni olishda xato", err.message));
    }
  },

  updateProfile: async (req, res, next) => {
    try {
      const data = await service.updateProfile(req.user._id, req.body.workingSchedule);
      return res.status(200).json({ message: "successfully updated", ...data });
    } catch (err) {
      return next(new ErrorHandler(400, "Profilni saqlashda xato", err.message));
    }
  },
};
