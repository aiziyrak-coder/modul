jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#modules/4.01-auth/role/role.model");
jest.mock("jsonwebtoken");
jest.mock("../_authProviders", () => ({
  name: "pin",
  isRedirectBased: false,
  verify: jest.fn(),
}));
jest.mock("#system/_shared/socketHandler", () => ({
  disconnectUser: jest.fn().mockResolvedValue(undefined),
}));

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
const { disconnectUser } = require("#system/_shared/socketHandler");
const provider = require("../_authProviders");
const service = require("./auth.service");

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const makeUser = (overrides = {}) => ({
  _id: "user1",
  oneIdPin: "00000000000001",
  role: "role1",
  active: true,
  tokenVersion: 0,
  refreshToken: null,
  refreshTokenHash: null,
  refreshTokenPrevHash: null,
  refreshTokenRotatedAt: null,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const mockRoleTitle = (title) => {
  RoleModel.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(title === null ? null : { title }),
    }),
  });
};

const mockRevokeUpdate = (result) => {
  UserModel.findByIdAndUpdate.mockReturnValue({
    lean: jest.fn().mockResolvedValue(result),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jwt.sign.mockReturnValue("signed.jwt.token");
  provider.name = "pin";
  mockRoleTitle("oqituvchi");
  mockRevokeUpdate({ tokenVersion: 1 });
});

describe("auth.service — loginWithCredentials", () => {
  test("mavjud faol xodim hisobi → token beriladi", async () => {
    provider.verify.mockResolvedValue({
      externalId: "00000000000001",
      verified: false,
      provider: "pin",
    });
    UserModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(makeUser()),
    });

    const result = await service.loginWithCredentials({
      oneIdPin: "00000000000001",
    });

    expect(result.accessToken).toBe("signed.jwt.token");
    expect(result.refreshToken).toBe("signed.jwt.token");
    expect(UserModel.findOne).toHaveBeenCalledWith({
      oneIdPin: "00000000000001",
    });
  });

  test("refresh token DB'da FAQAT HASH sifatida saqlanadi — plaintext yo'q", async () => {
    provider.verify.mockResolvedValue({
      externalId: "00000000000001",
      verified: false,
      provider: "pin",
    });
    const user = makeUser({
      refreshToken: "eski.plaintext",
      refreshTokenPrevHash: "eski-prev-hash",
    });
    UserModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(user) });

    await service.loginWithCredentials({ oneIdPin: "00000000000001" });

    expect(user.refreshToken).toBeNull();
    expect(user.refreshTokenHash).toBe(sha256("signed.jwt.token"));
    expect(user.refreshTokenPrevHash).toBeNull();
    expect(user.refreshTokenRotatedAt).toBeInstanceOf(Date);
    expect(user.save).toHaveBeenCalled();
  });

  test("token payload'ga `tv` (tokenVersion) claim qo'shiladi", async () => {
    provider.verify.mockResolvedValue({
      externalId: "00000000000001",
      verified: false,
      provider: "pin",
    });
    const user = makeUser({ tokenVersion: 3 });
    UserModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(user) });

    await service.loginWithCredentials({ oneIdPin: "00000000000001" });

    expect(jwt.sign).toHaveBeenCalledWith(
      { _id: "user1", tv: 3, jti: expect.any(String) },
      process.env.JWT_SECRET,
      expect.any(Object),
    );
  });

  test("noma'lum PIN → 401 (avto-yaratish YO'Q — self-service olib tashlandi)", async () => {
    provider.verify.mockResolvedValue({
      externalId: "99999999999999",
      verified: true,
      provider: "oneid",
    });
    provider.name = "oneid";
    process.env.ONEID_SELF_SERVICE = "true";
    UserModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    UserModel.mockImplementation(() => {
      throw new Error("UserModel konstruktor CHAQIRILMASLIGI kerak edi");
    });

    await expect(
      service.loginWithCredentials({ oneIdPin: "99999999999999" }),
    ).rejects.toMatchObject({ statusCode: 401 });

    delete process.env.ONEID_SELF_SERVICE;
  });

  test("active:false hisob → 403", async () => {
    provider.verify.mockResolvedValue({
      externalId: "00000000000002",
      verified: false,
      provider: "pin",
    });
    UserModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(makeUser({ active: false })),
    });

    await expect(
      service.loginWithCredentials({ oneIdPin: "00000000000002" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("auth.service — tinglovchi bloki (asosiy tizim token BERMAYDI)", () => {
  const listenerIdentity = {
    externalId: "33333333333333",
    verified: false,
    provider: "pin",
  };

  test("roli malaka_tinglovchi → 403, token berilmaydi", async () => {
    provider.verify.mockResolvedValue(listenerIdentity);
    const user = makeUser({ role: "listenerRole1" });
    UserModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(user),
    });
    mockRoleTitle("malaka_tinglovchi");

    await expect(
      service.loginWithCredentials({ oneIdPin: "33333333333333" }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(jwt.sign).not.toHaveBeenCalled();
    expect(user.save).not.toHaveBeenCalled();
  });

  test("rolsiz hisob → 403 (fail-closed, avval default tinglovchi rolini olardi)", async () => {
    provider.verify.mockResolvedValue(listenerIdentity);
    const user = makeUser({ role: null });
    UserModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(user),
    });

    await expect(
      service.loginWithCredentials({ oneIdPin: "33333333333333" }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(RoleModel.findById).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  test("refresh: tinglovchi mavjud sessiyani ham yangilay olmaydi → 403", async () => {
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    const user = makeUser({
      refreshTokenHash: sha256("eski.token"),
      refreshTokenRotatedAt: new Date(),
      role: "listenerRole1",
    });
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });
    mockRoleTitle("malaka_tinglovchi");

    await expect(service.refreshSession("eski.token")).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(jwt.sign).not.toHaveBeenCalled();
    expect(user.refreshTokenHash).toBe(sha256("eski.token"));
  });
});

describe("auth.service — refreshSession", () => {
  test("refreshToken yo'q → 400", async () => {
    await expect(service.refreshSession(undefined)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test("jwt.verify muddati tugagan → 401", async () => {
    jwt.verify.mockImplementation(() => {
      const err = new Error("expired");
      err.name = "TokenExpiredError";
      throw err;
    });

    await expect(
      service.refreshSession("expired.token"),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  test("jwt.verify yaroqsiz → 401", async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    await expect(
      service.refreshSession("garbage.token"),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  test("foydalanuvchi topilmasa → 401", async () => {
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.refreshSession("some.token"),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  test("(a) joriy hash bilan mos → yangi juftlik qaytadi, prev = eski joriy", async () => {
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    const user = makeUser({
      refreshTokenHash: sha256("joriy.token"),
      refreshTokenRotatedAt: new Date(),
    });
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    const result = await service.refreshSession("joriy.token");

    expect(result.accessToken).toBe("signed.jwt.token");
    expect(result.refreshToken).toBe("signed.jwt.token");
    expect(user.refreshTokenPrevHash).toBe(sha256("joriy.token"));
    expect(user.refreshTokenHash).toBe(sha256("signed.jwt.token"));
    expect(user.refreshToken).toBeNull();
  });

  test("(b) prev hash + grace oynasi ichida → yana rotatsiya, 200 kabi muvaffaqiyat", async () => {
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    const user = makeUser({
      refreshTokenHash: sha256("yangi.token"),
      refreshTokenPrevHash: sha256("eski.token"),
      refreshTokenRotatedAt: new Date(Date.now() - 3000),
    });
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    const result = await service.refreshSession("eski.token");

    expect(result.accessToken).toBe("signed.jwt.token");
    expect(user.refreshTokenPrevHash).toBe(sha256("yangi.token"));
    expect(user.refreshTokenHash).toBe(sha256("signed.jwt.token"));
  });

  test("(b) grace shoxida `refreshTokenRotatedAt` O'ZGARMAYDI (asl rotatsiya vaqti saqlanadi)", async () => {
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    const originalRotatedAt = new Date(Date.now() - 3000);
    const user = makeUser({
      refreshTokenHash: sha256("yangi.token"),
      refreshTokenPrevHash: sha256("eski.token"),
      refreshTokenRotatedAt: originalRotatedAt,
    });
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    await service.refreshSession("eski.token");

    expect(user.refreshTokenRotatedAt).toBe(originalRotatedAt);
  });

  test("sirg'alish zanjiri: (a)→(b) t=5s→(b) t=8s→ t=12s reuse-detection (fake timers)", async () => {
    jest.useFakeTimers({ now: 0 });
    try {
      jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
      let jtiSeq = 0;
      jwt.sign.mockImplementation(() => `signed.jti${jtiSeq++}`);

      const user = makeUser({
        refreshTokenHash: sha256("boshlangich.token"),
        refreshTokenRotatedAt: new Date(0),
      });
      UserModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      const r1 = await service.refreshSession("boshlangich.token");
      expect(user.refreshTokenRotatedAt.getTime()).toBe(0);
      const rotatedAtAfterA = user.refreshTokenRotatedAt;

      jest.setSystemTime(5000);
      const r2 = await service.refreshSession("boshlangich.token");
      expect(typeof r2.accessToken).toBe("string");
      expect(user.refreshTokenRotatedAt).toBe(rotatedAtAfterA);

      jest.setSystemTime(8000);
      const r3 = await service.refreshSession(r1.refreshToken);
      expect(typeof r3.accessToken).toBe("string");
      expect(user.refreshTokenRotatedAt).toBe(rotatedAtAfterA);

      jest.setSystemTime(12000);
      mockRevokeUpdate({ tokenVersion: 1 });
      await expect(service.refreshSession(r2.refreshToken)).rejects.toMatchObject({
        statusCode: 401,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  test("grace tugagach eski (prev) token → reuse-detection, 401", async () => {
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    const user = makeUser({
      refreshTokenHash: sha256("yangi.token"),
      refreshTokenPrevHash: sha256("eski.token"),
      refreshTokenRotatedAt: new Date(Date.now() - 15000),
    });
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });
    mockRevokeUpdate({ tokenVersion: 1 });

    await expect(service.refreshSession("eski.token")).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "user1",
      expect.objectContaining({ $inc: { tokenVersion: 1 } }),
      expect.any(Object),
    );
    expect(disconnectUser).toHaveBeenCalledWith("user1");
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  test("(c) hash yo'q + eski plaintext mos → hash'ga o'tadi (rotatsiya)", async () => {
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    const user = makeUser({ refreshToken: "eski.plaintext.token" });
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    const result = await service.refreshSession("eski.plaintext.token");

    expect(result.accessToken).toBe("signed.jwt.token");
    expect(user.refreshTokenHash).toBe(sha256("signed.jwt.token"));
    expect(user.refreshTokenPrevHash).toBeNull();
    expect(user.refreshToken).toBeNull();
  });

  test("(d) DBdagi hash/plaintext bilan mos kelmasa → reuse-detection, barcha sessiya bekor", async () => {
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    const user = makeUser({ refreshTokenHash: sha256("boshqa.token") });
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });
    mockRevokeUpdate({ tokenVersion: 5 });

    await expect(
      service.refreshSession("kelgan.token"),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "user1",
      expect.objectContaining({
        $inc: { tokenVersion: 1 },
        $set: expect.objectContaining({
          refreshToken: null,
          refreshTokenHash: null,
          refreshTokenPrevHash: null,
          refreshTokenRotatedAt: null,
        }),
      }),
      expect.any(Object),
    );
    expect(disconnectUser).toHaveBeenCalledWith("user1");
  });

  test("tokenVersion mos kelmasa → 401 (hash to'g'ri bo'lsa ham qayta rotatsiya YO'Q)", async () => {
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    const user = makeUser({
      tokenVersion: 1,
      refreshTokenHash: sha256("joriy.token"),
      refreshTokenRotatedAt: new Date(),
    });
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    await expect(
      service.refreshSession("joriy.token"),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(user.save).not.toHaveBeenCalled();
  });

  test("active:false hisob → 403", async () => {
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    const user = makeUser({
      refreshTokenHash: sha256("eski.token"),
      refreshTokenRotatedAt: new Date(),
      active: false,
    });
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    await expect(
      service.refreshSession("eski.token"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("to'g'ri refreshToken (xodim) → yangi juftlik qaytadi (rotatsiya)", async () => {
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    const user = makeUser({
      refreshTokenHash: sha256("eski.token"),
      refreshTokenRotatedAt: new Date(),
    });
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    const result = await service.refreshSession("eski.token");

    expect(result.accessToken).toBe("signed.jwt.token");
    expect(result.refreshToken).toBe("signed.jwt.token");
    expect(user.refreshTokenHash).toBe(sha256("signed.jwt.token"));
  });

  test("reuse-detection — winston.warn ORQALI xabar beradi (token/hash loglanmaydi)", async () => {
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    const winston = require("#shared/winston.logger");
    const warnSpy = jest.spyOn(winston, "warn").mockImplementation(() => {});
    const user = makeUser({ refreshTokenHash: sha256("boshqa.token") });
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    await expect(
      service.refreshSession("kelgan.token", { userAgent: "TestAgent/1.0" }),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(warnSpy).toHaveBeenCalled();
    const loggedMessage = warnSpy.mock.calls.map((c) => String(c[0])).join(" ");
    expect(loggedMessage).toContain("user1");
    expect(loggedMessage).toContain("TestAgent/1.0");
    expect(loggedMessage).not.toContain("kelgan.token");
    expect(loggedMessage).not.toContain(sha256("boshqa.token"));

    warnSpy.mockRestore();
  });

  test("reuse-detection — User-Agent'dagi \\r/\\n tozalanadi, 200 belgiga kesiladi", async () => {
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    const winston = require("#shared/winston.logger");
    const warnSpy = jest.spyOn(winston, "warn").mockImplementation(() => {});
    const user = makeUser({ refreshTokenHash: sha256("boshqa.token") });
    UserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    const maliciousUa =
      'RealAgent/1.0\r\n[FAKE] 2026-09-04 12:00:00 admin login muvaffaqiyatli\n' + "X".repeat(300);

    await expect(
      service.refreshSession("kelgan.token", { userAgent: maliciousUa }),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(warnSpy).toHaveBeenCalled();
    const loggedMessage = warnSpy.mock.calls.map((c) => String(c[0])).join(" ");
    expect(loggedMessage).not.toMatch(/[\r\n]/);
    expect(loggedMessage.length).toBeLessThan(maliciousUa.length);

    warnSpy.mockRestore();
  });
});

describe("auth.service — revokeAllSessions", () => {
  test("tokenVersion oshiradi, refresh maydonlarini tozalaydi, socket uzadi", async () => {
    mockRevokeUpdate({ tokenVersion: 7 });

    const newTv = await service.revokeAllSessions("user1", "logout");

    expect(newTv).toBe(7);
    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "user1",
      expect.objectContaining({
        $inc: { tokenVersion: 1 },
        $set: {
          refreshToken: null,
          refreshTokenHash: null,
          refreshTokenPrevHash: null,
          refreshTokenRotatedAt: null,
        },
      }),
      expect.objectContaining({ new: true }),
    );
    expect(disconnectUser).toHaveBeenCalledWith("user1");
  });

  test("foydalanuvchi topilmasa → null qaytadi, socket uzilmaydi", async () => {
    mockRevokeUpdate(null);

    const result = await service.revokeAllSessions("noexist", "logout");

    expect(result).toBeNull();
    expect(disconnectUser).not.toHaveBeenCalled();
  });

  test("disconnectUser xato tashlasa ham tokenVersion natijasi qaytadi (best-effort)", async () => {
    mockRevokeUpdate({ tokenVersion: 2 });
    disconnectUser.mockRejectedValueOnce(new Error("socket xato"));

    const result = await service.revokeAllSessions("user1", "logout");

    expect(result).toBe(2);
  });
});

describe("auth.service — getPublicConfig", () => {
  test("selfService har doim false (olib tashlandi), pin provayder → loginUrl null", () => {
    process.env.ONEID_SELF_SERVICE = "true";
    const config = service.getPublicConfig();
    expect(config).toEqual({
      provider: "pin",
      selfService: false,
      loginUrl: null,
    });
    delete process.env.ONEID_SELF_SERVICE;
  });
});
