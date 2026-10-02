const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const UserModel = require("#modules/4.01-auth/user/user.model");
const eImzo = require("#shared/eImzo");
const service = require("./auth.service");
const loginLock = require("../_loginLock/loginLock.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  oneIdLogin: async (req, res, next) => {
    try {
      const { accessToken, refreshToken, user } =
        await service.loginWithCredentials(req.body);

      if (user) {
        req.auditUser = {
          id: user._id,
          name: `${user.lastName || ""} ${user.firstName || ""}`.trim(),
        };
      }

      const okPin = String(req.body?.oneIdPin || "");
      if (okPin) {
        try {
          await loginLock.clearFailures(req.ip, okPin);
        } catch (lockErr) {
          winston.error(`[loginLock] sanoqni tozalashda xato: ${lockErr.message}`);
        }
      }

      return res.status(200).json({ accessToken, refreshToken });
    } catch (err) {
      const pin = String(req.body?.oneIdPin || "");
      if (pin) {
        req.auditUser = {
          id: null,
          name: `Muvaffaqiyatsiz kirish · PIN ****${pin.slice(-4)}`,
        };

        try {
          const outcome = await loginLock.registerFailure(req.ip, pin);
          if (outcome.justLocked) {
            const minutes = Math.round(loginLock.LOCK_POLICY.LOCK_MS / 60000);
            req.auditUser.name = `${req.auditUser.name} · HISOB QULFLANDI (${minutes} daq)`;
            winston.warn(
              `[loginLock] hisob qulflandi · PIN ****${pin.slice(-4)} · ochilish: ${outcome.lockedUntil.toISOString()}`,
            );
          }
        } catch (lockErr) {
          winston.error(`[loginLock] urinishni qayd etishda xato: ${lockErr.message}`);
        }
      }
      return next(wrapErr(err, "OneID orqali kirishda xatolik"));
    }
  },

  refreshToken: async (req, res, next) => {
    try {
      const tokens = await service.refreshSession(req.body.refreshToken, {
        userAgent: req.headers["user-agent"],
      });
      return res.status(200).json(tokens);
    } catch (err) {
      return next(wrapErr(err, "Token yangilashda xatolik"));
    }
  },

  getConfig: (req, res) => {
    return res.status(200).json(service.getPublicConfig());
  },

  logout: async (req, res, next) => {
    try {
      await service.revokeAllSessions(req.user._id, "logout");
      return res.status(200).json({ message: "Muvaffaqiyatli chiqildi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Chiqishda xatolik", err.message));
    }
  },

  getProfile: async (req, res, next) => {
    try {
      const result = req.user.toObject();

      delete result.tokenVersion;

      if (result?.role && result?.role?.permissions) {
        result.role.permissions = result?.role?.permissions.flatMap((p) =>
          p.actionKeys.map((action) => `${p?.section}:${action}`),
        );
        result.role.scopes = result.role.permissions;
      }

      return res.status(200).json(result);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to get profile", err.message));
    }
  },

  updateProfile: async (req, res, next) => {
    try {
      const user = req.user._id;

      const allowedFields = [
        "firstName",
        "lastName",
        "middleName",
        "email",
        "phone",
        "photo",
        "passportNumber",
        "passportSeria",
      ];

      const updates = {};
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });

      const updated = await UserModel.findByIdAndUpdate(
        user,
        { $set: updates },
        { new: true, runValidators: true },
      );

      if (!updated) {
        return next(new ErrorHandler(404, "Foydalanuvchi topilmadi"));
      }

      return res.status(200).json({ message: "successfully updated profile" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update profile", err.message),
      );
    }
  },

  getEriStatus: async (req, res, next) => {
    try {
      const user = await UserModel.findById(req.user._id).select("eriCertificate").lean();

      if (!user?.eriCertificate || !user.eriCertificate.serialNumber) {
        return res.status(200).json({
          hasCertificate: false,
          status: "missing",
          message: "ERI sertifikati biriktirilmagan. Tasdiqlash imkoniyati cheklangan.",
        });
      }

      const cert = user.eriCertificate;
      const now = new Date();
      const validTo = cert.validTo ? new Date(cert.validTo) : null;
      const validFrom = cert.validFrom ? new Date(cert.validFrom) : null;

      const daysLeft = validTo
        ? Math.floor((validTo - now) / (1000 * 60 * 60 * 24))
        : null;

      let status, message;
      if (validFrom && now < validFrom) {
        status = "not_yet_valid";
        message = `ERI sertifikati ${validFrom.toISOString().slice(0, 10)} dan boshlab amal qiladi`;
      } else if (validTo && now > validTo) {
        status = "expired";
        message = `ERI sertifikati ${Math.abs(daysLeft)} kun oldin tugagan. Yangilash kerak.`;
      } else if (daysLeft !== null && daysLeft <= 7) {
        status = "expiring_critical";
        message = `⚠ ERI sertifikati ${daysLeft} kundan keyin tugaydi! Tezda yangilang.`;
      } else if (daysLeft !== null && daysLeft <= 30) {
        status = "expiring_soon";
        message = `ERI sertifikati ${daysLeft} kundan keyin tugaydi`;
      } else {
        status = "valid";
        message = "ERI sertifikati amal qiladi";
      }

      return res.status(200).json({
        hasCertificate: true,
        serialNumber: cert.serialNumber,
        issuedBy: cert.issuedBy,
        validFrom: cert.validFrom,
        validTo: cert.validTo,
        daysLeft,
        status,
        message,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "ERI status xatolik", err.message));
    }
  },

  attachEri: async (req, res, next) => {
    try {
      const { certificateBase64 } = req.body;
      if (!certificateBase64) {
        return next(new ErrorHandler(400, "certificateBase64 majburiy"));
      }

      let certInfo;
      try {
        const buf = Buffer.from(certificateBase64, "base64");
        certInfo = eImzo.parseCertificate(buf);
      } catch (err) {
        return next(new ErrorHandler(400, "Sertifikat parse xatolik", err.message));
      }

      if (!certInfo?.serialNumber) {
        return next(new ErrorHandler(400, "Sertifikat noto'g'ri yoki seriya raqami yo'q"));
      }

      const now = new Date();
      if (certInfo.validTo && new Date(certInfo.validTo) < now) {
        return next(
          new ErrorHandler(400, "Sertifikat muddati tugagan, biriktirib bo'lmaydi"),
        );
      }

      await UserModel.findByIdAndUpdate(req.user._id, {
        eriCertificate: {
          serialNumber: certInfo.serialNumber,
          validFrom: certInfo.validFrom,
          validTo: certInfo.validTo,
          issuedBy: certInfo.issuer || certInfo.issuedBy || null,
        },
      });

      return res.status(200).json({
        message: "ERI muvaffaqiyatli biriktirildi",
        serialNumber: certInfo.serialNumber,
        validTo: certInfo.validTo,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "ERI biriktirishda xato", err.message));
    }
  },

  detachEri: async (req, res, next) => {
    try {
      await UserModel.findByIdAndUpdate(req.user._id, {
        $unset: { eriCertificate: "" },
      });
      return res.status(200).json({ message: "ERI sertifikat olib tashlandi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Xato", err.message));
    }
  },

};
