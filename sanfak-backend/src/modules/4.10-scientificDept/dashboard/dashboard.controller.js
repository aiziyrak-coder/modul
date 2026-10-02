const service = require("./dashboard.service");
const statistics = require("./statistics.service");

module.exports = {
  getStats: async (req, res, next) => {
    try {
      const data = await service.getStats(req.user);
      return res.status(200).json(data);
    } catch (err) {
      return next(err);
    }
  },

  getStatistics: async (req, res, next) => {
    try {
      const data = await statistics.getStatistics(req.user);
      return res.status(200).json(data);
    } catch (err) {
      return next(err);
    }
  },

  getContractsSeries: async (req, res, next) => {
    try {
      const data = await statistics.contractsSeries(req.user, {
        granularity: req.query.granularity,
        from: req.query.from,
        to: req.query.to,
      });
      return res.status(200).json(data);
    } catch (err) {
      return next(err);
    }
  },
};
