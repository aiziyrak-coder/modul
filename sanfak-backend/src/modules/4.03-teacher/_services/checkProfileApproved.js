const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");

const checkProfileApproved = async (req, res, next) => {
  try {
    if (!req.user?._id) {
      return res
        .status(401)
        .json({ message: "Autentifikatsiya talab etiladi" });
    }

    const profile = await TeacherProfile.findOne(
      { user: req.user._id },
      { hrApprovalStatus: 1 },
    );

    if (!profile) {
      return res.status(403).json({
        message: "O'qituvchi profili topilmadi. Avval profil yarating.",
      });
    }

    if (profile.hrApprovalStatus !== "approved") {
      const statusMap = {
        pending: "ko'rib chiqilmoqda",
        rejected: "rad etilgan",
      };
      return res.status(403).json({
        message: `Profilingiz hali kadrlar bo'limi tomonidan tasdiqlanmagan (holat: ${statusMap[profile.hrApprovalStatus] || profile.hrApprovalStatus}). Tasdiqlangandan so'ng ushbu funksiyadan foydalanish mumkin.`,
        hrApprovalStatus: profile.hrApprovalStatus,
      });
    }

    next();
  } catch (err) {
    return res.status(500).json({
      message: "Profil tekshirishda xatolik",
      error: err.message,
    });
  }
};

module.exports = checkProfileApproved;
