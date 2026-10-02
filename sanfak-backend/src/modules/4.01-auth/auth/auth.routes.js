const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const Controller = require("./auth.controller");
const { oneIdLoginSchema, updateProfileSchema } = require("./auth.validation");
const {
  uploadLimiter,
  authLoginIpLimiter,
  authLoginPinLimiter,
  authRefreshLimiter,
} = require("#shared/rateLimiter");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const loginLockGuard = require("../_loginLock/loginLock.guard");

router
  .route("/")
  .post(
    authLoginIpLimiter,
    authLoginPinLimiter,
    validator.body(oneIdLoginSchema),
    loginLockGuard,
    Controller.oneIdLogin,
  );

router.route("/refresh").post(authRefreshLimiter, Controller.refreshToken);

router.route("/config").get(Controller.getConfig);

router.use(authenticate);
router.route("/profile").get(Controller.getProfile);

router
  .route("/profile")
  .put(
    uploadLimiter,
    uploadImages,
    resizeImages,
    validator.body(updateProfileSchema),
    Controller.updateProfile,
  );

router.route("/logout").post(Controller.logout);

router.route("/eri-status").get(Controller.getEriStatus);
router.route("/eri-attach").post(Controller.attachEri);
router.route("/eri-detach").delete(Controller.detachEri);

module.exports = router;
