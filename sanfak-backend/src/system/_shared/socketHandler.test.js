const { EventEmitter } = require("events");

jest.mock("#modules/4.01-auth/user/user.model", () => ({
  findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
}));

const {
  initSocket,
  emitToUser,
  isOnline,
  isOnlineBatch,
  listOnlineUserIds,
  registerListenerLastSeenSink,
} = require("./socketHandler");

const User = require("#modules/4.01-auth/user/user.model");

class FakeSocket extends EventEmitter {
  constructor(id, userId) {
    super();
    this.id = id;
    this.userId = userId;
    this.rooms = new Set();
    this.data = {};
  }
  join(room) {
    this.rooms.add(room);
  }
}

const makeFakeIo = () => {
  let sockets = [];
  let connectionHandler = null;
  const roomMembers = (room) => sockets.filter((s) => s.rooms.has(room));
  const io = {
    use: () => {},
    on: (event, handler) => {
      if (event === "connection") connectionHandler = handler;
    },
    emit: jest.fn(),
    to: (room) => ({
      emit: (event, payload) => roomMembers(room).forEach((s) => s.emit(event, payload)),
    }),
    in: (room) => ({
      fetchSockets: async () => roomMembers(room),
    }),
    fetchSockets: async () => [...sockets],
    connect: (fakeSocket) => {
      sockets.push(fakeSocket);
      connectionHandler(fakeSocket);
    },
    disconnect: (fakeSocket) => {
      sockets = sockets.filter((s) => s !== fakeSocket);
      fakeSocket.rooms.clear();
      fakeSocket.emit("disconnect");
    },
  };
  return io;
};

const USER_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const USER_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const tick = () => new Promise(process.nextTick);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("socketHandler — onlayn holat (haqiqiy socketlardan)", () => {
  test("bitta user ikkita tabda ochsa — bittasi yopilganda hali onlayn", async () => {
    const io = makeFakeIo();
    initSocket(io);

    const s1 = new FakeSocket("S1", USER_A);
    io.connect(s1);
    await tick();
    expect(await isOnline(USER_A)).toBe(true);

    const s2 = new FakeSocket("S2", USER_A);
    io.connect(s2);
    await tick();

    io.disconnect(s1);
    await tick();
    expect(await isOnline(USER_A)).toBe(true);

    io.disconnect(s2);
    await tick();
    expect(await isOnline(USER_A)).toBe(false);
  });

  test("isOnlineBatch — bir nechta userni bitta so'rovda tekshiradi", async () => {
    const io = makeFakeIo();
    initSocket(io);
    io.connect(new FakeSocket("S1", USER_A));
    await tick();

    const result = await isOnlineBatch([USER_A, USER_B]);
    expect(result.get(USER_A)).toBe(true);
    expect(result.get(USER_B)).toBe(false);
  });

  test("listOnlineUserIds — faqat ulangan userlar, takrorsiz", async () => {
    const io = makeFakeIo();
    initSocket(io);
    const s1 = new FakeSocket("S1", USER_A);
    const s2 = new FakeSocket("S2", USER_A);
    io.connect(s1);
    io.connect(s2);
    io.connect(new FakeSocket("S3", USER_B));
    await tick();

    const ids = await listOnlineUserIds();
    expect(ids.sort()).toEqual([USER_A, USER_B].sort());

    io.disconnect(s1);
    io.disconnect(s2);
    await tick();
    expect(await listOnlineUserIds()).toEqual([USER_B]);
  });

  test("REGRESSIYA: ko'p connect/disconnect sikli holatni SIYIRMAYDI", async () => {
    const io = makeFakeIo();
    initSocket(io);

    for (let i = 0; i < 25; i += 1) {
      const s = new FakeSocket(`S${i}`, USER_A);
      io.connect(s);
      await tick();
      io.disconnect(s);
      await tick();
    }
    expect(await isOnline(USER_A)).toBe(false);
    expect(await listOnlineUserIds()).toEqual([]);
  });

  test("REGRESSIYA: server qayta ishga tushsa (yangi io) — hech kim onlayn emas", async () => {
    const io1 = makeFakeIo();
    initSocket(io1);
    io1.connect(new FakeSocket("S1", USER_A));
    await tick();
    expect(await isOnline(USER_A)).toBe(true);

    const io2 = makeFakeIo();
    initSocket(io2);
    expect(await isOnline(USER_A)).toBe(false);
    expect(await listOnlineUserIds()).toEqual([]);
  });

  test("uzilishda ham `onlineUsers` broadcast qilinadi (ro'yxat yangilanadi)", async () => {
    const io = makeFakeIo();
    initSocket(io);
    const s1 = new FakeSocket("S1", USER_A);
    io.connect(s1);
    await tick();
    io.emit.mockClear();

    io.disconnect(s1);
    await tick();

    const call = io.emit.mock.calls.find(([ev]) => ev === "onlineUsers");
    expect(call).toBeDefined();
    expect(call[1]).toEqual([]);
  });
});

describe("socketHandler — emitToUser (ko'p-tab, fetchSockets orqali)", () => {
  test("onlayn userga event uning BARCHA socketlariga yetadi", async () => {
    const io = makeFakeIo();
    initSocket(io);
    const s1 = new FakeSocket("S1", USER_A);
    const s2 = new FakeSocket("S2", USER_A);
    io.connect(s1);
    io.connect(s2);
    await tick();

    const received = [];
    s1.on("ping", (p) => received.push(["S1", p]));
    s2.on("ping", (p) => received.push(["S2", p]));

    const delivered = await emitToUser(USER_A, "ping", { hi: true });

    expect(delivered).toBe(true);
    expect(received).toHaveLength(2);
  });

  test("offline userga false qaytaradi (hech kim ulanmagan)", async () => {
    const io = makeFakeIo();
    initSocket(io);

    const delivered = await emitToUser(USER_B, "ping", {});
    expect(delivered).toBe(false);
  });
});

describe("socketHandler — lastSeen egasiga qarab yoziladi", () => {
  afterEach(() => registerListenerLastSeenSink(null));

  test("ODDIY user — `User` modeliga yoziladi", async () => {
    const sink = jest.fn();
    registerListenerLastSeenSink(sink);
    const io = makeFakeIo();
    initSocket(io);

    io.connect(new FakeSocket("S1", USER_A));
    await tick();

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      USER_A,
      expect.objectContaining({ lastSeen: expect.any(Date) }),
    );
    expect(sink).not.toHaveBeenCalled();
  });

  test("TINGLOVCHI — modul yozuvchisiga boradi, `User`ga TEGMAYDI", async () => {
    const sink = jest.fn().mockResolvedValue(undefined);
    registerListenerLastSeenSink(sink);
    const io = makeFakeIo();
    initSocket(io);

    const s1 = new FakeSocket("S1", USER_B);
    s1.data.isListener = true;
    io.connect(s1);
    await tick();

    expect(sink).toHaveBeenCalledWith(USER_B, expect.any(Date));
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("yozuvchi ro'yxatdan o'tmagan bo'lsa — yiqilmaydi", async () => {
    registerListenerLastSeenSink(null);
    const io = makeFakeIo();
    initSocket(io);

    const s1 = new FakeSocket("S1", USER_B);
    s1.data.isListener = true;
    expect(() => io.connect(s1)).not.toThrow();
    await tick();
    expect(await isOnline(USER_B)).toBe(true);
  });
});
