const Service = require("./startupType.service");

module.exports = {
  addStartupType: async (req, res, next) => {
    try {
      return res.status(201).json(await Service.create(req.body));
    } catch (err) {
      return next(err);
    }
  },

  findAllStartupTypes: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.list(req.query));
    } catch (err) {
      return next(err);
    }
  },

  paginateStartupTypes: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.paginate(req.query));
    } catch (err) {
      return next(err);
    }
  },

  findOneStartupType: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.findById(req.params.id));
    } catch (err) {
      return next(err);
    }
  },

  updateStartupType: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.update(req.params.id, req.body));
    } catch (err) {
      return next(err);
    }
  },

  deleteStartupType: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.remove(req.params.id));
    } catch (err) {
      return next(err);
    }
  },
};
