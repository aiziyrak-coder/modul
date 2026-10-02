const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
const provider = require("../_authProviders");
const { disconnectUser } = require("#system/_shared/socketHandler");

const LISTENER_ROLE_TITLE = "malaka_tinglovchi";

const LISTENER_BLOCKED_MSG =
  "Tinglovchi asosiy tizimga kira olmaydi — malaka oshirish portalidan foydalaning";

const REFRESH_GRACE_MS = 10_000;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const sanitizeForLog = (value) =>
  typeof value === "string" ? value.replace(/[\r\n]+/g, " ").slice(0, 200) : "-";

const issueTokens = (user) => {
  const tv = user.tokenVersion ?? 0;
  const accessToken = jwt.sign(
    { _id: user._id, tv, jti: crypto.randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN },
  );
  const refreshToken = jwt.sign(
    { _id: user._id, tv, jti: crypto.randomUUID() },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN },
  );
  return { accessToken, refreshToken };
};

const revokeAllSessions = async (userId, reason) => {
  const updated = await UserModel.findByIdAndUpdate(
    userId,
    {
      $inc: { tokenVersion: 1 },
      $set: {
        refreshToken: null,
        refreshTokenHash: null,
        refreshTokenPrevHash: null,
        refreshTokenRotatedAt: null,
      },
    },
    { new: true, select: "tokenVersion" },
  ).lean();

  if (!updated) return null;

  try {
    await disconnectUser(userId);
  } catch (err) {
    winston.error(`[auth] revokeAllSessions disconnectUser xato: ${err.message}`);
  }

  winston.info(`[auth] Sessiyalar bekor qilindi: user=${userId} sabab=${reason || "-"}`);

  return updated.tokenVersion;
};

const isListenerAccount = async (user) => {
  if (!user.role) return true;
  const role = await RoleModel.findById(user.role).select("title").lean();
  return role?.title === LISTENER_ROLE_TITLE;
};

module.exports = {
  loginWithCredentials: async (credentials) => {
    const identity = await provider.verify(credentials);

    const user = await UserModel.findOne({ oneIdPin: identity.externalId }).exec();
    if (!user) {
      throw new ErrorHandler(401, "Foydalanuvchi ro'yxatdan o'tmagan");
    }

    if (typeof user.active === "boolean" && user.active === false) {
      throw new ErrorHandler(403, "Foydalanuvchi bloklangan");
    }

    if (await isListenerAccount(user)) {
      throw new ErrorHandler(403, LISTENER_BLOCKED_MSG);
    }

    const { accessToken, refreshToken } = issueTokens(user);
    user.refreshToken = null;
    user.refreshTokenHash = hashToken(refreshToken);
    user.refreshTokenPrevHash = null;
    user.refreshTokenRotatedAt = new Date();
    await user.save();

    return { accessToken, refreshToken, user };
  },

  refreshSession: async (refreshToken, meta = {}) => {
    if (!refreshToken) {
      throw new ErrorHandler(400, "Refresh token topilmadi");
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw new ErrorHandler(401, "Refresh token muddati tugagan, qayta kiring");
      }
      throw new ErrorHandler(401, "Yaroqsiz refresh token");
    }

    const user = await UserModel.findById(decoded._id).select(
      "+refreshToken +refreshTokenHash +refreshTokenPrevHash +refreshTokenRotatedAt",
    );
    if (!user) {
      throw new ErrorHandler(401, "Foydalanuvchi topilmadi");
    }

    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new ErrorHandler(401, "Sessiya bekor qilingan, qayta kiring");
    }

    const incomingHash = hashToken(refreshToken);
    const rotatedAtMs = user.refreshTokenRotatedAt ? user.refreshTokenRotatedAt.getTime() : 0;

    const isCurrent = Boolean(user.refreshTokenHash) && incomingHash === user.refreshTokenHash;
    const isGrace =
      !isCurrent &&
      Boolean(user.refreshTokenPrevHash) &&
      incomingHash === user.refreshTokenPrevHash &&
      Date.now() - rotatedAtMs <= REFRESH_GRACE_MS;
    const isLegacyMatch =
      !isCurrent &&
      !isGrace &&
      !user.refreshTokenHash &&
      Boolean(user.refreshToken) &&
      user.refreshToken === refreshToken;

    if (!isCurrent && !isGrace && !isLegacyMatch) {
      const elapsedMs = rotatedAtMs ? Date.now() - rotatedAtMs : null;
      winston.warn(
        `[auth] Refresh reuse aniqlandi: user=${user._id} ua="${sanitizeForLog(meta.userAgent)}" oxirgi_rotatsiyadan=${elapsedMs === null ? "noma'lum" : `${elapsedMs}ms`}`,
      );
      await revokeAllSessions(user._id, "refresh reuse");
      throw new ErrorHandler(
        401,
        "Refresh token qayta ishlatildi. Xavfsizlik sabab barcha sessiyalar o'chirildi. Qayta kiring.",
      );
    }

    if (typeof user.active === "boolean" && user.active === false) {
      throw new ErrorHandler(403, "Foydalanuvchi bloklangan");
    }

    if (await isListenerAccount(user)) {
      throw new ErrorHandler(403, LISTENER_BLOCKED_MSG);
    }

    const { accessToken, refreshToken: newRefreshToken } = issueTokens(user);

    user.refreshTokenPrevHash = user.refreshTokenHash || null;
    user.refreshTokenHash = hashToken(newRefreshToken);
    if (!isGrace) {
      user.refreshTokenRotatedAt = new Date();
    }
    user.refreshToken = null;
    await user.save();

    return { accessToken, refreshToken: newRefreshToken };
  },

  revokeAllSessions,

  getPublicConfig: () => ({
    provider: provider.name,
    selfService: false,
    loginUrl: provider.isRedirectBased ? "/api/auth/oneid/start" : null,
  }),
};
