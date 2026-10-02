const jwt = require("jsonwebtoken");
const { createMockReq, createMockNext } = require("../helpers/mockResponse");

jest.mock("jsonwebtoken");

jest.mock("#modules/4.01-auth/user/user.model", () => ({
  findById: jest.fn(),
}));

const UserModel = require("#modules/4.01-auth/user/user.model");
const authenticate = require("#shared/authenticate");

const fakeUser = {
  _id: "507f1f77bcf86cd799439011",
  firstName: "Test",
  lastName: "User",
  role: { title: "oqituvchi", permissions: [] },
  active: true,
};

const buildUserChain = (resolveValue) => {
  const execMock = jest.fn().mockResolvedValue(resolveValue);
  const populateMock = jest.fn().mockReturnThis();
  populateMock.exec = execMock;
  const chain = { populate: populateMock, exec: execMock };
  populateMock.mockImplementation(() => chain);
  return chain;
};

const run = async (middleware, req) => {
  const next = createMockNext();
  await middleware(req, {}, next);
  return { err: next.mock.calls[0]?.[0], req, next };
};

beforeEach(() => {
  jest.clearAllMocks();
  jwt.verify.mockReturnValue({ _id: fakeUser._id });
});

describe("authenticate.stream — SSE query token", () => {
  test("?token= bor, header yo'q → req.user o'rnatiladi, next() xatosiz", async () => {
    UserModel.findById.mockReturnValue(buildUserChain(fakeUser));

    const req = createMockReq({
      headers: {},
      query: { token: "valid.jwt.token" },
    });

    const { err } = await run(authenticate.stream, req);

    expect(err).toBeUndefined();
    expect(req.user).toBe(fakeUser);
    expect(jwt.verify).toHaveBeenCalledWith("valid.jwt.token", process.env.JWT_SECRET);
  });
});

describe("authenticate (default) — header-only, query qabul qilmaydi", () => {
  test("faqat ?token= (header yo'q) → 401 'Token topilmadi'", async () => {
    const req = createMockReq({
      headers: {},
      query: { token: "valid.jwt.token" },
    });

    const { err } = await run(authenticate, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Token topilmadi");
    expect(jwt.verify).not.toHaveBeenCalled();
  });
});

describe("authenticate.stream — header Bearer ham ishlaydi", () => {
  test("Bearer header bor → req.user o'rnatiladi", async () => {
    UserModel.findById.mockReturnValue(buildUserChain(fakeUser));

    const req = createMockReq({
      headers: { authorization: "Bearer header.jwt.token" },
      query: {},
    });

    const { err } = await run(authenticate.stream, req);

    expect(err).toBeUndefined();
    expect(req.user).toBe(fakeUser);
    expect(jwt.verify).toHaveBeenCalledWith("header.jwt.token", process.env.JWT_SECRET);
  });
});

describe("authenticate (default) — header Bearer ishlaydi", () => {
  test("Bearer header bor → req.user o'rnatiladi", async () => {
    UserModel.findById.mockReturnValue(buildUserChain(fakeUser));

    const req = createMockReq({
      headers: { authorization: "Bearer header.jwt.token" },
      query: {},
    });

    const { err } = await run(authenticate, req);

    expect(err).toBeUndefined();
    expect(req.user).toBe(fakeUser);
  });
});

describe("bloklangan foydalanuvchi", () => {
  test("active=false → 403 'Foydalanuvchi bloklangan'", async () => {
    const blockedUser = { ...fakeUser, active: false };
    UserModel.findById.mockReturnValue(buildUserChain(blockedUser));

    const req = createMockReq({
      headers: { authorization: "Bearer header.jwt.token" },
      query: {},
    });

    const { err } = await run(authenticate, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe("Foydalanuvchi bloklangan");
  });
});

describe("token xatolari", () => {
  test("JsonWebTokenError → 401 'Yaroqsiz token'", async () => {
    const jwtErr = new Error("invalid");
    jwtErr.name = "JsonWebTokenError";
    jwt.verify.mockImplementation(() => { throw jwtErr; });

    const req = createMockReq({
      headers: { authorization: "Bearer bad.token" },
      query: {},
    });

    const { err } = await run(authenticate, req);

    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Yaroqsiz token");
  });

  test("TokenExpiredError → 401 'Token muddati tugagan'", async () => {
    const expErr = new Error("expired");
    expErr.name = "TokenExpiredError";
    jwt.verify.mockImplementation(() => { throw expErr; });

    const req = createMockReq({
      headers: { authorization: "Bearer expired.token" },
      query: {},
    });

    const { err } = await run(authenticate, req);

    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Token muddati tugagan");
  });
});

describe("tokenVersion — sessiya bekor qilish (WP-C · C2-BE)", () => {
  test("tv mos kelmasa → 401 'Sessiya bekor qilingan, qayta kiring'", async () => {
    jwt.verify.mockReturnValue({ _id: fakeUser._id, tv: 0 });
    UserModel.findById.mockReturnValue(buildUserChain({ ...fakeUser, tokenVersion: 1 }));

    const req = createMockReq({
      headers: { authorization: "Bearer header.jwt.token" },
      query: {},
    });

    const { err } = await run(authenticate, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Sessiya bekor qilingan, qayta kiring");
  });

  test("tv mos keladi → o'tadi, req.user o'rnatiladi", async () => {
    jwt.verify.mockReturnValue({ _id: fakeUser._id, tv: 2 });
    UserModel.findById.mockReturnValue(buildUserChain({ ...fakeUser, tokenVersion: 2 }));

    const req = createMockReq({
      headers: { authorization: "Bearer header.jwt.token" },
      query: {},
    });

    const { err } = await run(authenticate, req);

    expect(err).toBeUndefined();
    expect(req.user.tokenVersion).toBe(2);
  });

  test("eski (tv'siz) token + DB tokenVersion:0 → `?? 0` bilan o'tadi (`|| 0` EMAS)", async () => {
    jwt.verify.mockReturnValue({ _id: fakeUser._id });
    UserModel.findById.mockReturnValue(buildUserChain({ ...fakeUser, tokenVersion: 0 }));

    const req = createMockReq({
      headers: { authorization: "Bearer header.jwt.token" },
      query: {},
    });

    const { err } = await run(authenticate, req);

    expect(err).toBeUndefined();
  });

  test("SSE (?token=) shoxi ham bir xil tv tekshiruvidan o'tadi", async () => {
    jwt.verify.mockReturnValue({ _id: fakeUser._id, tv: 5 });
    UserModel.findById.mockReturnValue(buildUserChain({ ...fakeUser, tokenVersion: 1 }));

    const req = createMockReq({
      headers: {},
      query: { token: "valid.jwt.token" },
    });

    const { err } = await run(authenticate.stream, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Sessiya bekor qilingan, qayta kiring");
  });
});

describe("USER_PROJECTION — scope maydonlari (ADR-030)", () => {
  test("findById proyeksiyasida department VA faculty bor, role/active/tokenVersion ham", async () => {
    UserModel.findById.mockReturnValue(buildUserChain(fakeUser));

    const req = createMockReq({
      headers: { authorization: "Bearer valid.jwt.token" },
    });
    const { err } = await run(authenticate, req);

    expect(err).toBeUndefined();
    expect(UserModel.findById).toHaveBeenCalledTimes(1);
    const projection = UserModel.findById.mock.calls[0][1];
    expect(projection).toEqual(
      expect.objectContaining({ department: 1, faculty: 1, role: 1, active: 1, tokenVersion: 1 }),
    );
  });
});
