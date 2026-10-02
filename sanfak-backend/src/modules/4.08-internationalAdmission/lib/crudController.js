const { ErrorHandler } = require("#shared/error");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

function createCrudController(service, entity) {
  return {
    add: async (req, res, next) => {
      try {
        const doc = await service.create(req.body);
        return res.status(201).json(doc);
      } catch (err) {
        return next(wrapErr(err, `${entity} qo'shilmadi`));
      }
    },

    findAll: async (req, res, next) => {
      try {
        const docs = await service.list(req.query);
        return res.status(200).json(docs);
      } catch (err) {
        return next(wrapErr(err, `${entity} ro'yxati olinmadi`));
      }
    },

    paginate: async (req, res, next) => {
      try {
        const doc = await service.paginate(req.query);
        return res.status(200).json(doc);
      } catch (err) {
        return next(wrapErr(err, `${entity} sahifasi olinmadi`));
      }
    },

    findOne: async (req, res, next) => {
      try {
        const doc = await service.findById(req.params.id);
        return res.status(200).json(doc);
      } catch (err) {
        return next(wrapErr(err, `${entity} topilmadi`));
      }
    },

    update: async (req, res, next) => {
      try {
        await service.update(req.params.id, req.body);
        return res.status(200).json({ message: `${entity} yangilandi` });
      } catch (err) {
        return next(wrapErr(err, `${entity} yangilanmadi`));
      }
    },

    remove: async (req, res, next) => {
      try {
        await service.softDelete(req.params.id);
        return res.status(200).json({ message: `${entity} o'chirildi` });
      } catch (err) {
        return next(wrapErr(err, `${entity} o'chirilmadi`));
      }
    },
  };
}

module.exports = { createCrudController, wrapErr };
