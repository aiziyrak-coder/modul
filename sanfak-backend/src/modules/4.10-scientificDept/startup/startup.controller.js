const Service = require("./startup.service");
const { streamStartupArchive } = require("./startup.archive");

module.exports = {
  addStartup: async (req, res, next) => {
    try {
      return res.status(201).json(await Service.create(req.user, req.body));
    } catch (err) {
      return next(err);
    }
  },

  findAllStartups: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.list(req.query, req.scope));
    } catch (err) {
      return next(err);
    }
  },

  paginateStartups: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.paginate(req.query, req.scope));
    } catch (err) {
      return next(err);
    }
  },

  findOneStartup: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.findById(req.params.id, req.scope));
    } catch (err) {
      return next(err);
    }
  },

  downloadStartupArchive: async (req, res, next) => {
    try {
      const doc = await Service.findById(req.params.id, req.scope);
      return await streamStartupArchive(doc, res);
    } catch (err) {
      if (res.headersSent) return undefined;
      return next(err);
    }
  },

  updateStartup: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.update(req.user, req.params.id, req.body));
    } catch (err) {
      return next(err);
    }
  },

  deleteStartup: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.softDelete(req.user, req.params.id));
    } catch (err) {
      return next(err);
    }
  },
};
