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

const { pub } = require("./redisClient");
const winston = require("#shared/winston.logger");
const { initSocket, emitToUser } = require("./socketHandler");

const USER_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ADAPTER_FETCH_TIMEOUT_MS = 3000;

const makeIo = ({ localSockets = [], adapterFetchSockets } = {}) => {
  const localFetchSockets = jest.fn().mockResolvedValue(localSockets);
  const adapterSpy = adapterFetchSockets || jest.fn().mockResolvedValue(localSockets);
  const roomOperator = {
    fetchSockets: adapterSpy,
    local: { fetchSockets: localFetchSockets },
  };
  return {
    use: () => {},
    on: () => {},
    emit: jest.fn(),
    in: jest.fn(() => roomOperator),
    to: jest.fn(() => ({ emit: jest.fn() })),
    _adapterSpy: adapterSpy,
    _localFetchSockets: localFetchSockets,
  };
};

afterEach(() => {
  pub.status = "wait";
  pub.emit("ready");
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe("fetchSocketsSafe — Redis TAYYOR EMAS (offline navbat xavfi)", () => {
  test("adapter'ga UMUMAN tegilmaydi — to'g'ridan-to'g'ri lokal, emitToUser darhol qaytadi", async () => {
    pub.status = "wait";
    const io = makeIo({ localSockets: [{ data: { userId: USER_A } }] });
    initSocket(io);

    const delivered = await emitToUser(USER_A, "ping", { hi: true });

    expect(delivered).toBe(true);
    expect(io._localFetchSockets).toHaveBeenCalledTimes(1);
    expect(io._adapterSpy).not.toHaveBeenCalled();
  });
});

describe("fetchSocketsSafe — Redis TAYYOR, lekin adapter javob bermaydi", () => {
  test("timeout ichida lokal natijaga tushadi, warn BIR MARTA", async () => {
    jest.useFakeTimers();
    pub.status = "ready";
    const io = makeIo({
      localSockets: [{ data: { userId: USER_A } }],
      adapterFetchSockets: jest.fn(() => new Promise(() => {})),
    });
    initSocket(io);

    const pending = emitToUser(USER_A, "ping", { hi: true });
    await jest.advanceTimersByTimeAsync(ADAPTER_FETCH_TIMEOUT_MS);
    const delivered = await pending;

    expect(delivered).toBe(true);
    expect(io._localFetchSockets).toHaveBeenCalledTimes(1);
    expect(winston.warn).toHaveBeenCalledTimes(1);

    const io2 = makeIo({
      localSockets: [],
      adapterFetchSockets: jest.fn(() => new Promise(() => {})),
    });
    initSocket(io2);
    const pending2 = emitToUser(USER_A, "ping", {});
    await jest.advanceTimersByTimeAsync(ADAPTER_FETCH_TIMEOUT_MS);
    await pending2;
    expect(winston.warn).toHaveBeenCalledTimes(1);
  });

  test("Redis qayta 'ready' bo'lganda warn flag tiklanadi", async () => {
    jest.useFakeTimers();
    pub.status = "ready";
    const io = makeIo({
      localSockets: [],
      adapterFetchSockets: jest.fn(() => new Promise(() => {})),
    });
    initSocket(io);

    const pending = emitToUser(USER_A, "ping", {});
    await jest.advanceTimersByTimeAsync(ADAPTER_FETCH_TIMEOUT_MS);
    await pending;
    expect(winston.warn).toHaveBeenCalledTimes(1);

    pub.emit("ready");

    const io2 = makeIo({
      localSockets: [],
      adapterFetchSockets: jest.fn(() => new Promise(() => {})),
    });
    initSocket(io2);
    const pending2 = emitToUser(USER_A, "ping", {});
    await jest.advanceTimersByTimeAsync(ADAPTER_FETCH_TIMEOUT_MS);
    await pending2;
    expect(winston.warn).toHaveBeenCalledTimes(2);
  });
});

describe("fetchSocketsSafe — Redis TAYYOR, adapter TEZ javob beradi", () => {
  test("adapter natijasi ishlatiladi, lokalga tushilmaydi, warn yo'q", async () => {
    pub.status = "ready";
    const adapterFetchSockets = jest.fn().mockResolvedValue([{ data: { userId: USER_A } }]);
    const io = makeIo({ localSockets: [], adapterFetchSockets });
    initSocket(io);

    const delivered = await emitToUser(USER_A, "ping", { hi: true });

    expect(delivered).toBe(true);
    expect(adapterFetchSockets).toHaveBeenCalledTimes(1);
    expect(io._localFetchSockets).not.toHaveBeenCalled();
    expect(winston.warn).not.toHaveBeenCalled();
  });
});
