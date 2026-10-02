const { ErrorHandler } = require("#shared/error");
const service = require("./taskAssigneeGrant.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  listAssigners: async (req, res, next) => {
    try {
      const doc = await service.listAssigners(req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Foydalanuvchilarni olishda xatolik"));
    }
  },

  listCandidates: async (req, res, next) => {
    try {
      const doc = await service.listCandidates(req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Nomzodlarni olishda xatolik"));
    }
  },

  listRoleOptions: async (req, res, next) => {
    try {
      const data = await service.listRoleOptions();
      return res.status(200).json(data);
    } catch (err) {
      return next(wrapErr(err, "Rollarni olishda xatolik"));
    }
  },

  listGrants: async (req, res, next) => {
    try {
      const data = await service.listGrants(req.params.assignerId);
      return res.status(200).json(data);
    } catch (err) {
      return next(wrapErr(err, "Biriktirishlarni olishda xatolik"));
    }
  },

  replaceGrants: async (req, res, next) => {
    try {
      const data = await service.replaceGrants(
        req.params.assignerId,
        req.body.assignees,
        req.user,
      );
      return res.status(200).json({ message: "Biriktirishlar saqlandi", data });
    } catch (err) {
      return next(wrapErr(err, "Biriktirishlarni saqlashda xatolik"));
    }
  },

  addGrants: async (req, res, next) => {
    try {
      const data = await service.addGrants(
        req.params.assignerId,
        req.body.assignees,
        req.user,
      );
      return res.status(201).json({ message: "Biriktirildi", data });
    } catch (err) {
      return next(wrapErr(err, "Biriktirishda xatolik"));
    }
  },

  removeGrant: async (req, res, next) => {
    try {
      const data = await service.removeGrant(
        req.params.assignerId,
        req.params.assigneeId,
      );
      return res.status(200).json({ message: "Biriktirish olib tashlandi", data });
    } catch (err) {
      return next(wrapErr(err, "Biriktirishni olib tashlashda xatolik"));
    }
  },
};
