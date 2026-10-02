"use strict";

const winston = require("#shared/winston.logger");

const ScientificWork = require("#modules/4.06-scientificCouncil/scientificWork/scientificWork.model");

const LIVE = { active: true };
const STATUSLAR = ["new", "pending", "approved", "rejected", "revision", "seminar", "closed"];

const bosh = (kalitlar) => Object.fromEntries(kalitlar.map((k) => [k, 0]));

module.exports = {
  overview: async (req, res, next) => {
    try {
      const [agg] = await ScientificWork.aggregate([
        { $match: LIVE },
        {
          $facet: {
            total: [{ $count: "n" }],
            byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
            external: [{ $match: { authorType: "external" } }, { $count: "n" }],
            externalResearchers: [
              { $match: { authorType: "external", "externalAuthor.name": { $nin: [null, ""] } } },
              { $group: { _id: "$externalAuthor.name" } },
              { $count: "n" },
            ],
            internal: [{ $match: { authorType: "internal" } }, { $count: "n" }],
            defended: [{ $match: { seminarResult: "defended" } }, { $count: "n" }],
            notDefended: [{ $match: { seminarResult: "not_defended" } }, { $count: "n" }],
          },
        },
      ]);

      const byStatus = bosh(STATUSLAR);
      (agg?.byStatus ?? []).forEach((r) => {
        if (r._id in byStatus) byStatus[r._id] = r.n;
      });

      return res.status(200).json({
        total: agg?.total?.[0]?.n ?? 0,
        byStatus,
        external: agg?.external?.[0]?.n ?? 0,
        externalResearchers: agg?.externalResearchers?.[0]?.n ?? 0,
        internal: agg?.internal?.[0]?.n ?? 0,
        defended: agg?.defended?.[0]?.n ?? 0,
        notDefended: agg?.notDefended?.[0]?.n ?? 0,
      });
    } catch (error) {
      winston.error(error.message);
      return next(error);
    }
  },
};
