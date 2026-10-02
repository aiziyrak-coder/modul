const { ErrorHandler } = require("#shared/error");
const service = require("./monograph.service");
const { streamMonographArchive } = require("./monograph.archive");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const buildEri = (req) => {
  if (req.eri) {
    return {
      signedAt: req.eri.signedAt || new Date(),
      serialNumber: req.eri.serialNumber,
      signature: req.eri.signature,
    };
  }
  return {
    signedAt: new Date(),
    serialNumber: req.body.eriKey || null,
    signature: req.body.eriSignature || null,
  };
};

module.exports = {
  addMonograph: async (req, res, next) => {
    try {
      const doc = await service.create(req.user, req.body);
      return res.status(201).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Monografiya yuborilmadi"));
    }
  },

  findAllMonographs: async (req, res, next) => {
    try {
      const docs = await service.list(req.query, req.scope, req.user);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Monografiyalar ro'yxati olinmadi"));
    }
  },

  paginateMonographs: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query, req.scope, req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Monografiyalar sahifasi olinmadi"));
    }
  },

  downloadMonographArchive: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id, req.scope, req.user);
      return await streamMonographArchive(doc, res);
    } catch (err) {
      if (res.headersSent) return undefined;
      return next(wrapErr(err, "Arxivni yuklab bo'lmadi"));
    }
  },

  findOneMonograph: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id, req.scope, req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Monografiya topilmadi"));
    }
  },

  updateMonograph: async (req, res, next) => {
    try {
      const doc = await service.update(req.user, req.params.id, req.body);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Monografiya yangilanmadi"));
    }
  },

  approveMonograph: async (req, res, next) => {
    try {
      const doc = await service.ilmiyApprove(req.user, req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Monografiya tasdiqlanmadi"));
    }
  },

  signMonograph: async (req, res, next) => {
    try {
      const doc = await service.sign(
        req.user,
        req.params.id,
        req.body,
        buildEri(req),
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "E-imzo bajarilmadi"));
    }
  },

  rejectMonograph: async (req, res, next) => {
    try {
      const doc = await service.reject(req.user, req.params.id, req.body.reason);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Monografiya rad etilmadi"));
    }
  },

  ssvSendMonograph: async (req, res, next) => {
    try {
      const doc = await service.ssvSend(req.user, req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "SSV ga yuborish belgilanmadi"));
    }
  },

  ssvDecisionMonograph: async (req, res, next) => {
    try {
      const doc = await service.ssvDecision(
        req.user,
        req.params.id,
        req.body,
        req.body.file,
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "SSV javobi qayd etilmadi"));
    }
  },

  fillDataMonograph: async (req, res, next) => {
    try {
      const doc = await service.fillData(
        req.user,
        req.params.id,
        req.body,
        req.body.file,
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ma'lumotlar saqlanmadi"));
    }
  },

  dataApproveMonograph: async (req, res, next) => {
    try {
      const doc = await service.dataApprove(req.user, req.params.id);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ma'lumotlar tasdiqlanmadi"));
    }
  },

  dataRejectMonograph: async (req, res, next) => {
    try {
      const doc = await service.dataReject(
        req.user,
        req.params.id,
        req.body.reason,
      );
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ma'lumotlar rad etilmadi"));
    }
  },

  deleteMonograph: async (req, res, next) => {
    try {
      await service.softDelete(req.params.id);
      return res.status(200).json({ message: "Monografiya o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Monografiya o'chirilmadi"));
    }
  },
};
