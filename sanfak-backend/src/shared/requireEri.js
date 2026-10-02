const { ErrorHandler } = require("./error");
const eImzo = require("./eImzo");
const winston = require("./winston.logger");

function requireEri(options = {}) {
  const {
    optional        = false,
    matchUserCert   = true,
    rejectExpired   = true,
    bodyKey         = "eriSignature",
    dataKey         = "eriData",
  } = options;

  return async (req, res, next) => {
    try {
      const signatureBase64 = req.body?.[bodyKey];

      if (!signatureBase64) {
        if (optional) return next();
        return next(new ErrorHandler(400, `${bodyKey} talab etiladi (ERI imzo)`));
      }

      let dataBuffer;
      if (req.body?.[dataKey]) {
        dataBuffer = Buffer.from(String(req.body[dataKey]), "base64");
      } else {
        const stable = stableStringify({
          ...req.body,
          [bodyKey]: undefined,
          [dataKey]: undefined,
        });
        dataBuffer = Buffer.from(stable);
      }

      const userCert = matchUserCert ? req.user?.eriCertificate : null;

      const result = await eImzo.verifyAndMatch({
        signatureBase64,
        dataBuffer,
        userCert,
      });

      if (!result.valid) {
        if (result.reason === "certificate_expired_or_not_yet_valid" && !rejectExpired) {
          req.eri = {
            signature:    signatureBase64,
            cert:         result.cert,
            serialNumber: result.cert?.serialNumber || null,
            signedAt:     new Date(),
            warning:      result.reason,
          };
          return next();
        }

        winston.warn(`[requireEri] reject: ${result.reason}`, {
          userId: req.user?._id,
          path:   req.originalUrl,
        });

        const code =
          result.reason?.startsWith("certificate_mismatch") ? 403 :
          result.reason?.startsWith("certificate_expired") ? 401 :
          400;

        return next(new ErrorHandler(code, "ERI imzo noto'g'ri", result.reason));
      }

      req.eri = {
        signature:    signatureBase64,
        cert:         result.cert,
        serialNumber: result.cert?.serialNumber || null,
        signedAt:     new Date(),
      };

      return next();
    } catch (err) {
      return next(new ErrorHandler(500, "ERI tekshirishda xatolik", err.message));
    }
  };
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") +
    "}"
  );
}

module.exports = requireEri;
module.exports.stableStringify = stableStringify;
