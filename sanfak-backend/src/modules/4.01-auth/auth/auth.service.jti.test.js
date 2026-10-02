jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#modules/4.01-auth/role/role.model");
jest.mock("../_authProviders", () => ({
  name: "pin",
  isRedirectBased: false,
  verify: jest.fn(),
}));
jest.mock("#system/_shared/socketHandler", () => ({
  disconnectUser: jest.fn().mockResolvedValue(undefined),
}));

const crypto = require("crypto");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
const provider = require("../_authProviders");
const service = require("./auth.service");

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

beforeAll(() => {
  process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret_jti";
  process.env.JWT_REFRESH_EXPIRES_IN = "3d";
});

const mockRoleTitle = (title) => {
  RoleModel.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({ title }),
    }),
  });
};

const makeStatefulUser = (overrides = {}) => {
  const user = {
    _id: "user1",
    oneIdPin: "00000000000001",
    role: "role1",
    active: true,
    tokenVersion: 0,
    refreshToken: null,
    refreshTokenHash: null,
    refreshTokenPrevHash: null,
    refreshTokenRotatedAt: null,
    ...overrides,
  };
  user.save = jest.fn().mockResolvedValue(undefined);
  return user;
};

const wireFindByIdAndUpdate = (user) => {
  UserModel.findByIdAndUpdate.mockImplementation((id, update) => {
    if (update?.$inc?.tokenVersion) {
      user.tokenVersion = (user.tokenVersion ?? 0) + update.$inc.tokenVersion;
    }
    if (update?.$set) Object.assign(user, update.$set);
    return { lean: jest.fn().mockResolvedValue({ tokenVersion: user.tokenVersion }) };
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRoleTitle("oqituvchi");
});

afterEach(() => {
  jest.useRealTimers();
});

describe("issueTokens — `jti` noyoblik (bir xil soniya, real jwt)", () => {
  test("ketma-ket ikki login (bir xil fake soniya) → access/refresh HAR IKKALASI FARQLI", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    provider.verify.mockResolvedValue({
      externalId: "00000000000001",
      verified: false,
      provider: "pin",
    });

    const user1 = makeStatefulUser();
    UserModel.findOne.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(user1) });
    const login1 = await service.loginWithCredentials({ oneIdPin: "00000000000001" });

    const user2 = makeStatefulUser();
    UserModel.findOne.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(user2) });
    const login2 = await service.loginWithCredentials({ oneIdPin: "00000000000001" });

    expect(login1.accessToken).not.toBe(login2.accessToken);
    expect(login1.refreshToken).not.toBe(login2.refreshToken);
  });
});

describe("refreshSession — grace/reuse zanjiri, bir xil fake soniya (jti fix regressiyasi)", () => {
  test("(a) darhol refresh → 200, (b) yana eski token grace ichida → 200, keyin (d) yana eski token → 401 + tokenVersion++", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    provider.verify.mockResolvedValue({
      externalId: "00000000000001",
      verified: false,
      provider: "pin",
    });

    const user = makeStatefulUser();
    UserModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(user) });
    UserModel.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    wireFindByIdAndUpdate(user);

    const login = await service.loginWithCredentials({ oneIdPin: "00000000000001" });
    const r0 = login.refreshToken;

    const stepA = await service.refreshSession(r0);
    expect(stepA.accessToken).toBeDefined();
    expect(stepA.refreshToken).not.toBe(r0);

    const stepB = await service.refreshSession(r0);
    expect(stepB.accessToken).toBeDefined();
    expect(stepB.refreshToken).not.toBe(r0);
    expect(stepB.refreshToken).not.toBe(stepA.refreshToken);

    const tvBefore = user.tokenVersion;

    jest.setSystemTime(new Date(Date.now() + 11_000));

    await expect(service.refreshSession(r0)).rejects.toMatchObject({ statusCode: 401 });

    expect(user.tokenVersion).toBe(tvBefore + 1);
    expect(user.refreshTokenHash).toBeNull();
    expect(user.refreshTokenPrevHash).toBeNull();
  });

  test("hash'lar aniq FARQLI (jti fix haqiqatan ishlayotganining to'g'ridan-to'g'ri isboti)", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

    provider.verify.mockResolvedValue({
      externalId: "00000000000001",
      verified: false,
      provider: "pin",
    });

    const user = makeStatefulUser();
    UserModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(user) });
    UserModel.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

    const login = await service.loginWithCredentials({ oneIdPin: "00000000000001" });
    const hashAfterLogin = user.refreshTokenHash;

    const rotated = await service.refreshSession(login.refreshToken);
    const hashAfterRotation = user.refreshTokenHash;

    expect(hashAfterLogin).not.toBe(hashAfterRotation);
    expect(hashAfterRotation).toBe(sha256(rotated.refreshToken));
    expect(user.refreshTokenPrevHash).toBe(hashAfterLogin);
  });
});
