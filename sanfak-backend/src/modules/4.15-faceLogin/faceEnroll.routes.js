const router = require("express").Router();
const multer = require("multer");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const { authLoginIpLimiter } = require("#shared/rateLimiter");
const FaceTemplate = require("./faceTemplate.model");
const Face = require("./faceLogin.service");

// Yuzni o'zi ro'yxatdan o'tkazish: faqat tizimga kirgan (JSHSHIR yoki yuz bilan) foydalanuvchi, o'z hisobiga.
// Yuqori rollar (yuz bilan kirishi taqiqlangan) ro'yxatdan o'tkaza olmaydi.
const FACE_BLOCKED_ROLES = new Set(["super_admin", "moderator", "rektor", "prorektor", "dekan"]);
const FRAMES = 3;
const SAME_PERSON_MIN = 0.55; // 3 kadr bir odamniki bo'lishi shart
const OTHER_ACCOUNT_MAX = 0.8; // boshqa hisobning yuzi bilan deyarli bir xil bo'lmasin

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: FRAMES },
}).array("frames", FRAMES);

const norm = (a) => {
  const n = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  return n ? Float32Array.from(a, (x) => x / n) : null;
};
const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

router.post(
  "/",
  authLoginIpLimiter,
  (req, res, next) =>
    upload(req, res, (err) =>
      err ? next(new ErrorHandler(400, "Rasm yuklashda xatolik (3 MB gacha, 3 ta kadr)")) : next(),
    ),
  async (req, res, next) => {
    try {
      if (process.env.FACE_LOGIN_ENABLED !== "true") {
        throw new ErrorHandler(503, "Yuz bilan kirish hozircha o'chiq");
      }
      const roleTitle = req.user?.role?.title;
      if (roleTitle && FACE_BLOCKED_ROLES.has(roleTitle)) {
        throw new ErrorHandler(403, "Bu rol faqat JSHSHIR bilan kiradi");
      }
      const frames = (req.files || []).map((f) => f.buffer);
      if (frames.length !== FRAMES) {
        throw new ErrorHandler(400, `Aniq ${FRAMES} ta kadr yuborilishi kerak`);
      }

      const embs = await Promise.all(frames.map(Face.embedImage));
      if (embs.some((e) => e === null)) {
        throw new ErrorHandler(422, "Yuz aniqlanmadi. Kameraga yaqinroq va yorug'da turing, 3 kadrda ham yuzingiz ko'rinsin");
      }
      const vecs = embs.map(norm);
      if (vecs.some((v) => !v)) throw new ErrorHandler(422, "Yuz aniqlanmadi");
      for (let i = 0; i < vecs.length; i++) {
        for (let j = i + 1; j < vecs.length; j++) {
          if (dot(vecs[i], vecs[j]) < SAME_PERSON_MIN) {
            throw new ErrorHandler(422, "Kadrlar turlicha chiqdi. Boshingizni qimirlatmay, to'g'ri qarab qayta urinib ko'ring");
          }
        }
      }

      // boshqa hisobning yuzi bilan deyarli bir xil bo'lmasin (suratni boshqa hisobga qo'yib yuborishdan himoya)
      const me = String(req.user._id);
      const others = await FaceTemplate.find({ active: true, user: { $ne: req.user._id }, kind: "xodim" })
        .select("+embedding user")
        .lean();
      for (const t of others) {
        const tv = norm(t.embedding);
        if (tv && vecs.some((v) => dot(v, tv) >= OTHER_ACCOUNT_MAX)) {
          winston.warn(`[faceEnroll] boshqa hisob yuzi bilan to'qnashuv: user=${me}`);
          throw new ErrorHandler(409, "Bu yuz boshqa hisobga bog'langan. Administratorga murojaat qiling");
        }
      }

      // eski o'z yuz izlarini almashtiramiz
      await FaceTemplate.updateMany({ user: req.user._id, source: "self" }, { $set: { active: false } });
      await FaceTemplate.createIndexes();
      const now = new Date();
      for (let i = 0; i < embs.length; i++) {
        await FaceTemplate.updateOne(
          { camPersonId: `self:${me}:${i}` },
          { $set: { kind: "xodim", user: req.user._id, embedding: embs[i], active: true, source: "self", syncedAt: now } },
          { upsert: true },
        );
      }
      Face.invalidateCache();
      return res.status(200).json({ success: true, message: "Yuzingiz ro'yxatdan o'tkazildi" });
    } catch (e) {
      return next(e);
    }
  },
);

module.exports = router;
