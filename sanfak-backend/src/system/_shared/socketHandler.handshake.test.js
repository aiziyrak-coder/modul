jest.mock("jsonwebtoken");
jest.mock("#modules/4.01-auth/user/user.model", () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
}));

const jwt = require("jsonwebtoken");
const User = require("#modules/4.01-auth/user/user.model");
const { initSocket } = require("./socketHandler");

const mockFindById = (result) => {
  User.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: result instanceof Error
        ? jest.fn().mockRejectedValue(result)
        : jest.fn().mockResolvedValue(result),
    }),
  });
};

const makeIo = () => {
  let handshakeMiddleware;
  const io = {
    use: (fn) => {
      handshakeMiddleware = fn;
    },
    on: () => {},
    emit: jest.fn(),
    to: () => ({ emit: () => {} }),
    in: () => ({ fetchSockets: async () => [] }),
  };
  return {
    io,
    run: (socket) =>
      new Promise((resolve) => {
        handshakeMiddleware(socket, (err) => resolve(err));
      }),
  };
};

const makeSocket = (auth = {}) => ({
  handshake: { auth, headers: {} },
  data: {},
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("socketHandler — JWT handshake tokenVersion/active (WP-C · C2-BE)", () => {
  test("token yo'q → rad etiladi", async () => {
    const { io, run } = makeIo();
    initSocket(io);

    const err = await run(makeSocket({}));

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Token topilmadi/);
  });

  test("tv mos, active:true → qabul qilinadi, socket.userId o'rnatiladi", async () => {
    const { io, run } = makeIo();
    initSocket(io);
    jwt.verify.mockReturnValue({ _id: "user1", tv: 2 });
    mockFindById({ tokenVersion: 2, active: true });

    const socket = makeSocket({ token: "valid.jwt" });
    const err = await run(socket);

    expect(err).toBeUndefined();
    expect(socket.userId).toBe("user1");
  });

  test("tv mos kelmaydi (sessiya bekor qilingan) → rad etiladi", async () => {
    const { io, run } = makeIo();
    initSocket(io);
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    mockFindById({ tokenVersion: 1, active: true });

    const err = await run(makeSocket({ token: "eski.jwt" }));

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Sessiya bekor qilingan/);
  });

  test("eski (tv'siz) token + tokenVersion:0 hali → `?? 0` bilan qabul qilinadi", async () => {
    const { io, run } = makeIo();
    initSocket(io);
    jwt.verify.mockReturnValue({ _id: "user1" });
    mockFindById({ tokenVersion: 0, active: true });

    const socket = makeSocket({ token: "eski.tv-siz.jwt" });
    const err = await run(socket);

    expect(err).toBeUndefined();
    expect(socket.userId).toBe("user1");
  });

  test("foydalanuvchi topilmasa → rad etiladi", async () => {
    const { io, run } = makeIo();
    initSocket(io);
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    mockFindById(null);

    const err = await run(makeSocket({ token: "valid.jwt" }));

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Foydalanuvchi topilmadi/);
  });

  test("active:false → rad etiladi", async () => {
    const { io, run } = makeIo();
    initSocket(io);
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    mockFindById({ tokenVersion: 0, active: false });

    const err = await run(makeSocket({ token: "valid.jwt" }));

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/bloklangan/);
  });

  test("FAIL-CLOSED: DB xatosi → ulanish RAD etiladi (sukut bo'yicha qabul emas)", async () => {
    const { io, run } = makeIo();
    initSocket(io);
    jwt.verify.mockReturnValue({ _id: "user1", tv: 0 });
    mockFindById(new Error("Mongo uzildi"));

    const err = await run(makeSocket({ token: "valid.jwt" }));

    expect(err).toBeInstanceOf(Error);
  });

  test("yaroqsiz JWT → rad etiladi", async () => {
    const { io, run } = makeIo();
    initSocket(io);
    jwt.verify.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const err = await run(makeSocket({ token: "garbage" }));

    expect(err).toBeInstanceOf(Error);
  });
});
