jest.mock("#system/chat/chatMessage.model", () => ({}));
jest.mock("#modules/4.01-auth/user/user.model", () => ({
  findByIdAndUpdate: jest.fn().mockResolvedValue(null),
  findById: jest.fn(),
}));
jest.mock("#shared/winston.logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { initSocket } = require("./socketHandler");

function makeIo(onlineIds = []) {
  const remote = onlineIds.map((id) => ({ data: { userId: String(id) } }));
  return {
    use: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }),
    fetchSockets: jest.fn().mockResolvedValue(remote),
  };
}

function connect(io, userId) {
  const connectionCb = io.on.mock.calls.find(([ev]) => ev === "connection")[1];
  const handlers = {};
  const socket = {
    userId: String(userId),
    data: {},
    join: jest.fn(),
    emit: jest.fn(),
    on: (ev, fn) => {
      handlers[ev] = fn;
    },
  };
  connectionCb(socket);
  return { socket, handlers };
}

describe("socketHandler — onlayn ro'yxatni SO'RAB olish", () => {
  const TEACHER = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const LISTENER = "bbbbbbbbbbbbbbbbbbbbbbbb";

  it("`getOnlineUsers` hodisasi tinglanadi", () => {
    const io = makeIo([TEACHER, LISTENER]);
    initSocket(io);
    const { handlers } = connect(io, TEACHER);
    expect(typeof handlers.getOnlineUsers).toBe("function");
  });

  it("javob FAQAT so'ragan socketga, broadcast EMAS", async () => {
    const io = makeIo([TEACHER, LISTENER]);
    initSocket(io);
    const { socket, handlers } = connect(io, TEACHER);

    await new Promise((r) => setImmediate(r));
    io.emit.mockClear();
    socket.emit.mockClear();

    await handlers.getOnlineUsers();

    expect(socket.emit).toHaveBeenCalledTimes(1);
    const [event, ids] = socket.emit.mock.calls[0];
    expect(event).toBe("onlineUsers");
    expect(ids.sort()).toEqual([TEACHER, LISTENER].sort());
    expect(io.emit).not.toHaveBeenCalled();
  });

  it("ro'yxat haqiqiy socketlardan — hech kim yo'q bo'lsa bo'sh", async () => {
    const io = makeIo([]);
    initSocket(io);
    const { socket, handlers } = connect(io, TEACHER);
    socket.emit.mockClear();

    await handlers.getOnlineUsers();
    expect(socket.emit).toHaveBeenCalledWith("onlineUsers", []);
  });

  it("bir user bir necha tabda bo'lsa ro'yxatda BIR marta", async () => {
    const io = makeIo([TEACHER, TEACHER, LISTENER]);
    initSocket(io);
    const { socket, handlers } = connect(io, TEACHER);
    socket.emit.mockClear();

    await handlers.getOnlineUsers();
    const [, ids] = socket.emit.mock.calls[0];
    expect(ids).toHaveLength(2);
  });
});
