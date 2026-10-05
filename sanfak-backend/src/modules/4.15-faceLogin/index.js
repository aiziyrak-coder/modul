const router = require("express").Router();

// Yuzni o'zi ro'yxatdan o'tkazish (tizimga kirgan foydalanuvchi). /auth/face-login umumiy router.js da.
router.use("/auth/face-enroll", require("./faceEnroll.routes"));

module.exports = router;
