const router = require("express").Router();
const multer = require("multer");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const { authLoginIpLimiter } = require("#shared/rateLimiter");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
const authService = require("#modules/4.01-auth/auth/auth.service");
const Face = require("./faceLogin.service");

// Jonli odam tekshiruvi yo'q (rasm ko'rsatib aldash mumkin) — shuning uchun yuqori rollar
// yuz bilan KIRMAYDI, faqat JSHSHIR bilan.
const FACE_BLOCKED_ROLES = new Set(["super_admin", "moderator", "rektor", "prorektor", "dekan"]);
const FRAMES = 2;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: FRAMES },
}).array("frames", FRAMES);

router.post(
  "/",
  authLoginIpLimiter,
  (req, res, next) =>
    upload(req, res, (err) =>
      err ? next(new ErrorHandler(400, "Rasm yuklashda xatolik (3 MB gacha, 2 ta kadr)")) : next(),
    ),
  async (req, res, next) => {
    try {
      if (process.env.FACE_LOGIN_ENABLED !== "true") {
        throw new ErrorHandler(503, "Yuz bilan kirish hozircha o'chiq");
      }
      const frames = (req.files || []).map((f) => f.buffer);
      if (frames.length !== FRAMES) {
        throw new ErrorHandler(400, `Aniq ${FRAMES} ta kadr yuborilishi kerak`);
      }

      const decision = await Face.identify(frames);
      if (decision.status === "no_face") {
        throw new ErrorHandler(422, "Yuz aniqlanmadi. Kameraga yaqinroq va yorug'da turing");
      }
      if (decision.status !== "ok") {
        // "unknown" va "unlinked" bir xil javob — kim tizimda borligini oshkor qilmaymiz
        throw new ErrorHandler(401, "Yuz tanilmadi. JSHSHIR bilan kiring");
      }

      const user = await UserModel.findById(decision.user).exec();
      if (!user) throw new ErrorHandler(401, "Yuz tanilmadi. JSHSHIR bilan kiring");

      const role = user.role ? await RoleModel.findById(user.role).select("title").lean() : null;
      if (role && FACE_BLOCKED_ROLES.has(role.title)) {
        winston.warn(`[faceLogin] yuqori rol yuz bilan kirishga uringan: user=${user._id}`);
        throw new ErrorHandler(403, "Bu rol faqat JSHSHIR bilan kiradi");
      }

      const { accessToken, refreshToken } = await authService.loginAsUser(user);
      req.auditUser = {
        id: user._id,
        name: `${user.lastName || ""} ${user.firstName || ""}`.trim() + " · yuz bilan",
      };
      return res.status(200).json({ accessToken, refreshToken });
    } catch (e) {
      return next(e);
    }
  },
);

module.exports = router;
