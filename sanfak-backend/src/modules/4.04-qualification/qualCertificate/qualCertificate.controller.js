"use strict";

const { ErrorHandler } = require("#shared/error");
const { resolvePublicBaseUrl } = require("#shared/publicBaseUrl");
const QualEarnedCertificate = require("#modules/4.04-qualification/_shared/qualEarnedCertificate.model");
const {
  certificateCode,
} = require("#modules/4.04-qualification/_shared/certificateCode");
const Service = require("./qualCertificate.service");

const { STATUS } = Service;

const baseOf = (req) => resolvePublicBaseUrl(req);

module.exports = {
  paginate: async (req, res, next) => {
    try {
      const query = {};
      if (req.query.status) query.status = Number(req.query.status);
      if (req.query.course) query.course = req.query.course;
      if (req.query.kind) query.kind = Number(req.query.kind);

      const docs = await QualEarnedCertificate.paginate(query, {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 10,
        sort: { status: 1, createdAt: -1 },
        lean: true,
        populate: [
          { path: "listener", model: "QualListener", select: "fullName" },
          { path: "course", select: "title creditHours startDate endDate" },
          { path: "approvedBy", model: "user", select: "firstName lastName" },
        ],
      });
      return res.status(200).json({
        ...docs,
        docs: docs.docs.map((d) => ({ ...d, code: certificateCode(d) })),
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Hujjatlar ro'yxati olinmadi", err.message));
    }
  },

  pendingCount: async (req, res, next) => {
    try {
      const count = await QualEarnedCertificate.countDocuments({ status: STATUS.PENDING });
      return res.status(200).json({ count });
    } catch (err) {
      return next(new ErrorHandler(400, "Son olinmadi", err.message));
    }
  },

  approve: async (req, res, next) => {
    try {
      const { ids } = req.body;
      const result = await Service.approveMany(ids, req.user._id, baseOf(req));
      return res.status(200).json({
        message: "Tasdiqlandi",
        approved: result.approved.length,
        failed: result.failed,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Tasdiqlanmadi", err.message));
    }
  },

  reject: async (req, res, next) => {
    try {
      const { ids, reason } = req.body;
      const result = await Service.rejectMany(ids, req.user._id, reason);
      return res.status(200).json({ message: "Rad etildi", rejected: result.rejected });
    } catch (err) {
      return next(new ErrorHandler(400, "Rad etilmadi", err.message));
    }
  },
};
