const { wrapErr } = require("../lib/crudController");
const service = require("./admissionMessage.service");

module.exports = {
  findAllMessages: async (req, res, next) => {
    try {
      const docs = await service.list(req.query);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Xabarlar ro'yxati olinmadi"));
    }
  },

  paginateMessages: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Xabarlar sahifasi olinmadi"));
    }
  },

  findOneMessage: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Xabar topilmadi"));
    }
  },

  previewRecipients: async (req, res, next) => {
    try {
      const count = await service.previewRecipients(req.query);
      return res.status(200).json({ recipientCount: count });
    } catch (err) {
      return next(wrapErr(err, "Qabul qiluvchilar soni hisoblanmadi"));
    }
  },

  sendMessage: async (req, res, next) => {
    try {
      const doc = await service.send(req.user, req.body);
      return res.status(201).json({
        message: "Xabar yuborildi",
        recipientCount: doc.recipientCount,
        deliveredCount: doc.deliveredCount,
      });
    } catch (err) {
      return next(wrapErr(err, "Xabar yuborilmadi"));
    }
  },
};
