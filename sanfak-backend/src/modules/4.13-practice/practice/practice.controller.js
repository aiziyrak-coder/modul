const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const service = require("./practice.service");
const templateService = require("#modules/4.13-practice/contractTemplate/contractTemplate.service");
const { fillTemplate, buildDocHtml } = require("#modules/4.13-practice/_shared/contractDoc");

const roleTitle = (req) => req.user?.role?.title;

const canActAs = (req, ...allowed) => {
  const rt = roleTitle(req);
  return allowed.includes(rt) || rt === ROLES.SUPER_ADMIN || rt === ROLES.ADMIN;
};

const wrapErr = (err, message) =>
  err && err.statusCode ? err : new ErrorHandler(400, message, err && err.message);

const respondResult = (res, result, okMsg) => {
  if (result === null) return res.status(404).json({ message: "not found" });
  if (result && result.invalid) {
    return res.status(409).json({ message: result.invalid });
  }
  return res.status(200).json({ message: okMsg, status: result.status });
};

const buildEri = (req) => {
  if (req.eri) {
    return {
      signedAt: req.eri.signedAt,
      serialNumber: req.eri.serialNumber,
      cert: req.eri.cert,
      signature: req.eri.signature,
    };
  }
  return {
    signedAt: new Date(),
    serialNumber: req.body.certSerial || null,
    cert: { subject: req.body.certSubject || null },
    signature: req.body.eriSignature || null,
  };
};

module.exports = {
  addContract: async (req, res, next) => {
    try {
      const doc = await service.create(req.body, req.user._id);
      if (!doc) return res.status(400).json({ message: "Saqlab bo'lmadi" });
      return res
        .status(201)
        .json({ message: "Shartnoma yaratildi", _id: doc._id, number: doc.number });
    } catch (err) {
      if (err && err.code === 11000) {
        return next(new ErrorHandler(409, "Shartnoma raqami band — qayta urinib ko'ring", err.message));
      }
      return next(new ErrorHandler(400, "Yaratishda xato", err.message));
    }
  },

  findAllContracts: async (req, res, next) => {
    try {
      const organizationIds = await service.findOrganizationIdsByTitle(req.query.search);
      const userOrgIds = await service.resolveUserOrgIds(req.user);
      const filter = service.buildFilter({
        ...req.query,
        organizationIds,
        roleTitle: roleTitle(req),
        userOrgIds,
      });
      const docs = await service.findAll(filter);
      return res.status(200).json(docs || []);
    } catch (err) {
      return next(new ErrorHandler(400, "Ro'yxatda xato", err.message));
    }
  },

  paginateContracts: async (req, res, next) => {
    try {
      const organizationIds = await service.findOrganizationIdsByTitle(req.query.search);
      const userOrgIds = await service.resolveUserOrgIds(req.user);
      const filter = service.buildFilter({
        ...req.query,
        organizationIds,
        roleTitle: roleTitle(req),
        userOrgIds,
      });
      const doc = await service.paginate(filter, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Sahifalashda xato", err.message));
    }
  },

  tabsCount: async (req, res, next) => {
    try {
      const userOrgIds = await service.resolveUserOrgIds(req.user);
      const base = service.buildFilter({
        academicYear: req.query.academicYear,
        direction: req.query.direction,
        roleTitle: roleTitle(req),
        userOrgIds,
      });
      const byStatus = await service.tabsCount(base);
      return res.status(200).json(byStatus);
    } catch (err) {
      return next(new ErrorHandler(400, "Soni hisoblashda xato", err.message));
    }
  },

  findOneContract: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      await service.assertOrgOwnership(req.user, doc.organization);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Olishda xato"));
    }
  },

  updateContract: async (req, res, next) => {
    try {
      const result = await service.update(req.params.id, req.body);
      return respondResult(res, result, "Muvaffaqiyatli yangilandi");
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xato", err.message));
    }
  },

  deleteContract: async (req, res, next) => {
    try {
      const result = await service.remove(req.params.id);
      return respondResult(res, result, "O'chirildi");
    } catch (err) {
      return next(new ErrorHandler(400, "O'chirishda xato", err.message));
    }
  },

  sendToRector: async (req, res, next) => {
    try {
      const result = await service.sendToRector(req.params.id);
      return respondResult(res, result, "Rektorga yuborildi");
    } catch (err) {
      return next(new ErrorHandler(400, "Yuborishda xato", err.message));
    }
  },

  rectorSign: async (req, res, next) => {
    try {
      if (!canActAs(req, ROLES.REKTOR)) {
        return res.status(403).json({ message: "Faqat rektor imzolashi mumkin" });
      }
      const result = await service.rectorSign(req.params.id, buildEri(req), req.user._id);
      return respondResult(res, result, "Rektor tasdiqladi");
    } catch (err) {
      return next(new ErrorHandler(400, "Rektor imzolashda xato", err.message));
    }
  },

  orgSign: async (req, res, next) => {
    try {
      if (!canActAs(req, ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI)) {
        return res
          .status(403)
          .json({ message: "Faqat tibbiyot birlashmasi rahbari imzolashi mumkin" });
      }
      const result = await service.orgSign(req.params.id, buildEri(req), req.user);
      return respondResult(res, result, "Rahbar tasdiqladi (yakuniy)");
    } catch (err) {
      return next(wrapErr(err, "Rahbar imzolashda xato"));
    }
  },

  rejectContract: async (req, res, next) => {
    try {
      const rt = roleTitle(req);
      let rejectedBy = null;
      if (rt === ROLES.REKTOR) rejectedBy = "rektor";
      else if (rt === ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI) rejectedBy = "org_head";
      else if (rt === ROLES.SUPER_ADMIN || rt === ROLES.ADMIN)
        rejectedBy = req.body.rejectedBy === "org_head" ? "org_head" : "rektor";
      else return res.status(403).json({ message: "Rad etishga ruxsat yo'q" });

      const result = await service.reject(req.params.id, req.body.reason, rejectedBy, req.user);
      return respondResult(res, result, "Rad etildi");
    } catch (err) {
      return next(wrapErr(err, "Rad etishda xato"));
    }
  },

  getPracticeReport: async (req, res, next) => {
    try {
      const userOrgIds = await service.resolveUserOrgIds(req.user);
      const data = await service.report({ ...req.query, roleTitle: roleTitle(req), userOrgIds });
      return res.status(200).json(data);
    } catch (err) {
      return next(new ErrorHandler(400, "Hisobotda xato", err.message));
    }
  },

  previewContract: async (req, res, next) => {
    try {
      const doc = await service.getForDocument(req.params.id);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      await service.assertOrgOwnership(req.user, doc.organization);
      const body = await templateService.getBody();
      const text = fillTemplate(body, doc);
      return res.status(200).json({ text, number: doc.number });
    } catch (err) {
      return next(wrapErr(err, "Ko'rishda xato"));
    }
  },

  downloadDoc: async (req, res, next) => {
    try {
      const doc = await service.getForDocument(req.params.id);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      await service.assertOrgOwnership(req.user, doc.organization);
      const body = await templateService.getBody();
      const text = fillTemplate(body, doc);
      const html = buildDocHtml(text);
      const fileName = `shartnoma-${String(doc.number).replace(/\W+/g, "-")}.doc`;
      res.setHeader("Content-Type", "application/msword");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.status(200).send(html);
    } catch (err) {
      return next(wrapErr(err, "Yuklab olishda xato"));
    }
  },
};
