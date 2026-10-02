const { ErrorHandler } = require("#shared/error");
const { zipFileSlots } = require("./fileSlots");

function createAchievementController(service, label) {
  const wrapErr = (err, message) =>
    err.statusCode ? err : new ErrorHandler(400, message, err.message);

  const FILE_SLOTS = { document: "fileUrl", autoAbstract: "autoAbstractUrl" };

  const extractPayload = (req) => {
    const { media, fileSlots, ...rest } = req.body;
    const payload = { ...rest };

    if (fileSlots) {
      const zipped = zipFileSlots({ media, fileSlots }, Object.keys(FILE_SLOTS));
      Object.entries(zipped).forEach(([slot, url]) => {
        payload[FILE_SLOTS[slot]] = url;
      });
      return payload;
    }

    if (Array.isArray(media) && media[0] && media[0].image) {
      payload.fileUrl = media[0].image;
    }
    return payload;
  };

  return {
    add: async (req, res, next) => {
      try {
        const doc = await service.create(req.user, extractPayload(req));
        return res.status(201).json(doc);
      } catch (err) {
        return next(wrapErr(err, `${label} qo'shilmadi`));
      }
    },
    findAll: async (req, res, next) => {
      try {
        const docs = await service.list(req.query, req.scope);
        return res.status(200).json(docs);
      } catch (err) {
        return next(wrapErr(err, `${label} ro'yxati olinmadi`));
      }
    },
    paginate: async (req, res, next) => {
      try {
        const doc = await service.paginate(req.query, req.scope);
        return res.status(200).json(doc);
      } catch (err) {
        return next(wrapErr(err, `${label} sahifasi olinmadi`));
      }
    },
    findOne: async (req, res, next) => {
      try {
        const doc = await service.findById(req.params.id, req.scope);
        return res.status(200).json(doc);
      } catch (err) {
        return next(wrapErr(err, `${label} topilmadi`));
      }
    },
    update: async (req, res, next) => {
      try {
        const doc = await service.update(req.user, req.params.id, extractPayload(req));
        return res.status(200).json(doc);
      } catch (err) {
        return next(wrapErr(err, `${label} yangilanmadi`));
      }
    },
    approve: async (req, res, next) => {
      try {
        const doc = await service.approve(req.user, req.params.id);
        return res.status(200).json(doc);
      } catch (err) {
        return next(wrapErr(err, `${label} tasdiqlanmadi`));
      }
    },
    reject: async (req, res, next) => {
      try {
        const doc = await service.reject(req.user, req.params.id, req.body.reason);
        return res.status(200).json(doc);
      } catch (err) {
        return next(wrapErr(err, `${label} rad etilmadi`));
      }
    },
    remove: async (req, res, next) => {
      try {
        await service.softDelete(req.user, req.params.id);
        return res.status(200).json({ message: `${label} o'chirildi` });
      } catch (err) {
        return next(wrapErr(err, `${label} o'chirilmadi`));
      }
    },
  };
}

module.exports = { createAchievementController };
