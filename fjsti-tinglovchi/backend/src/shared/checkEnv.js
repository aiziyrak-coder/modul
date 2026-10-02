const logger = require("./logger");

const WEAK_VALUES = new Set([
  "test",
  "secret",
  "changeme",
  "change_me",
  "change_me_too",
  "jwt_secret",
  "password",
  "1234",
]);

function assertStrong(name, value) {
  const v = String(value || "");
  if (!v) return `${name} sozlanmagan`;
  if (v.length < 32) return `${name} juda qisqa (<32 belgi) — kuchsiz`;
  if (WEAK_VALUES.has(v.toLowerCase())) return `${name} ma'lum zaif/default qiymat`;
  return null;
}

function checkEnv() {
  const problems = [
    assertStrong("LISTENER_JWT_SECRET", process.env.LISTENER_JWT_SECRET),
    assertStrong("REFRESH_TOKEN_SECRET", process.env.REFRESH_TOKEN_SECRET),
    assertStrong("SERVICE_KEY", process.env.SERVICE_KEY),
  ].filter(Boolean);

  if (problems.length) {
    logger.error(
      "[checkEnv] Xavfsizlik: zaif imzo siri bilan ishga tushib bo'lmaydi:\n  - " +
        problems.join("\n  - ") +
        "\n  Yechim: kuchli tasodifiy qiymat qo'ying — `openssl rand -hex 32` yoki " +
        "`node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"`.",
    );
    process.exit(1);
  }

  if (
    process.env.NODE_ENV === "production" &&
    /^http:\/\//i.test(process.env.MAIN_API_URL || "")
  ) {
    logger.warn(
      "[checkEnv] MAIN_API_URL `http://` (TLS yo'q) — production'da token MITM xavfi. HTTPS/mTLS tavsiya etiladi.",
    );
  }
}

module.exports = { checkEnv };
