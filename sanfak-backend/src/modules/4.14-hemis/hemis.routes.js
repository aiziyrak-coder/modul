const router = require("express").Router();
const { ROLES } = require("#config/constants");
const { ErrorHandler } = require("#shared/error");
const Service = require("./hemis.service");
const { HemisRecord } = require("./hemis.model");
const { TYPES, REGULAR_TYPES } = require("./hemis.config");

// HEMIS sinxroni — faqat super_admin (RBAC katalogiga yangi section qo'shmaslik uchun)
const superAdminOnly = (req, res, next) =>
  req.user?.role?.title === ROLES.SUPER_ADMIN
    ? next()
    : next(new ErrorHandler(403, "Bu bo'lim faqat super admin uchun"));

router.use(superAdminOnly);

router.get("/status", async (req, res, next) => {
  try {
    res.json({ success: true, data: await Service.status() });
  } catch (e) {
    next(e);
  }
});

// Orqa fonda ishga tushiradi (katta ro'yxatlar uchun so'rov kutib o'tirmaydi)
router.post("/sync", async (req, res, next) => {
  try {
    const requested = Array.isArray(req.body?.types) ? req.body.types : REGULAR_TYPES;
    const bad = requested.filter((t) => !TYPES[t]);
    if (bad.length) throw new ErrorHandler(400, `Noma'lum turlar: ${bad.join(", ")}`);
    if (Service.isRunning()) throw new ErrorHandler(409, "HEMIS sinxroni allaqachon ishlayapti");
    Service.syncAll({ types: requested, trigger: "manual" }).catch(() => {});
    res.status(202).json({ success: true, message: "Sinxron boshlandi", types: requested });
  } catch (e) {
    next(e);
  }
});

router.get("/records/:type", async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!TYPES[type]) throw new ErrorHandler(404, "Noma'lum tur");
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const filter = { type, missing: false };
    const [items, total] = await Promise.all([
      HemisRecord.find(filter)
        .sort({ hemisId: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      HemisRecord.countDocuments(filter),
    ]);
    res.json({ success: true, data: { items: items.map((i) => i.data), total, page, limit } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
