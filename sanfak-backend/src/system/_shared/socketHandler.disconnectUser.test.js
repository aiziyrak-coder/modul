jest.mock("./redisClient", () => {
  const { EventEmitter } = require("events");
  const mockPub = new EventEmitter();
  mockPub.status = "wait";
  return { pub: mockPub, sub: {} };
});

jest.mock("#shared/winston.logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("#modules/4.01-auth/user/user.model", () => ({
  findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
}));

const { pub } = require("./redisClient");
const winston = require("#shared/winston.logger");
const { initSocket, disconnectUser } = require("./socketHandler");

const USER_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ADAPTER_FETCH_TIMEOUT_MS = 3000;

const makeIo = ({ adapterDisconnect, localDisconnect } = {}) => {
  const adapterSpy = adapterDisconnect || jest.fn().mockResolvedValue(undefined);
  const localSpy = localDisconnect || jest.fn().mockResolvedValue(undefined);
  return {
    use: () => {},
    on: () => {},
    emit: jest.fn(),
    in: jest.fn(() => ({ disconnectSockets: adapterSpy })),
    local: { in: jest.fn(() => ({ disconnectSockets: localSpy })) },
    to: jest.fn(() => ({ emit: jest.fn() })),
    _adapterSpy: adapterSpy,
    _localSpy: localSpy,
  };
};

afterEach(() => {
  pub.status = "wait";
  pub.emit("ready");
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe("disconnectUser — Redis TAYYOR EMAS", () => {
  test("to'g'ridan-to'g'ri LOKAL operator ishlatiladi, adapterga tegilmaydi", async () => {
    pub.status = "wait";
    const io = makeIo();
    initSocket(io);

    await disconnectUser(USER_A);

    expect(io.local.in).toHaveBeenCalledWith(USER_A);
    expect(io._localSpy).toHaveBeenCalledWith(true);
    expect(io._adapterSpy).not.toHaveBeenCalled();
  });
});

describe("disconnectUser — Redis TAYYOR, adapter TEZ javob beradi", () => {
  test("adapter ishlatiladi, lokalga tushilmaydi", async () => {
    pub.status = "ready";
    const io = makeIo();
    initSocket(io);

    await disconnectUser(USER_A);

    expect(io._adapterSpy).toHaveBeenCalledWith(true);
    expect(io._localSpy).not.toHaveBeenCalled();
  });
});

describe("disconnectUser — Redis TAYYOR, adapter javob bermaydi", () => {
  test("timeout ichida LOKAL natijaga tushadi, warn yoziladi", async () => {
    jest.useFakeTimers();
    pub.status = "ready";
    const io = makeIo({
      adapterDisconnect: jest.fn(() => new Promise(() => {})),
    });
    initSocket(io);

    const pending = disconnectUser(USER_A);
    await jest.advanceTimersByTimeAsync(ADAPTER_FETCH_TIMEOUT_MS);
    await pending;

    expect(io._localSpy).toHaveBeenCalledWith(true);
    expect(winston.warn).toHaveBeenCalled();
  });
});

describe("disconnectUser — `_ioRef` yo'q (server socket ulamagan)", () => {
  test("no-op, yiqilmaydi", async () => {
    let freshDisconnectUser;
    jest.isolateModules(() => {
      freshDisconnectUser = require("./socketHandler").disconnectUser;
    });

    await expect(freshDisconnectUser(USER_A)).resolves.toBeUndefined();
  });
});
