jest.mock("./loginLock.service", () => ({
  checkLock: jest.fn(),
}));

const service = require("./loginLock.service");
const guard = require("./loginLock.guard");
const {
  createMockReq,
  createMockRes,
  createMockNext,
} = require("../../../../test/helpers/mockResponse");

const PIN = "31234567890123";
const IP = "203.0.113.44";

const run = async (req, res) => {
  const next = createMockNext();
  await guard(req, res, next);
  return { next, arg: next.mock.calls[0]?.[0] };
};

const reqWithPin = (pin = PIN) =>
  createMockReq({ body: { oneIdPin: pin }, user: undefined, ip: IP });

const resWithHeader = () => {
  const res = createMockRes();
  res.setHeader = jest.fn();
  return res;
};

const LOCKED_STATE = {
  locked: true,
  lockedUntil: new Date("2026-08-21T10:30:00.000Z"),
  retryAfterSeconds: 1800,
  retryAfterMinutes: 30,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("loginLock.guard", () => {
  test("qulf yo'q — so'rov Controller tomon o'tadi", async () => {
    service.checkLock.mockResolvedValue({ locked: false });

    const { next, arg } = await run(reqWithPin(), resWithHeader());

    expect(next).toHaveBeenCalledTimes(1);
    expect(arg).toBeUndefined();
  });

  test("kalit (IP + PIN) juftligidan quriladi — `req.ip` uzatiladi", async () => {
    service.checkLock.mockResolvedValue({ locked: false });

    await run(reqWithPin(), resWithHeader());

    expect(service.checkLock).toHaveBeenCalledWith(IP, PIN);
  });

  test("qulflangan juftlik → 429 va zanjir TO'XTAYDI (PIN tekshiruvi ishlamaydi)", async () => {
    service.checkLock.mockResolvedValue(LOCKED_STATE);

    const res = resWithHeader();
    const { arg } = await run(reqWithPin(), res);

    expect(arg).toBeDefined();
    expect(arg.statusCode).toBe(429);
    expect(arg.message).toContain("30 daqiqa");
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "1800");
  });

  test("qulf hodisasi mavjud audit oqimiga tushadi — PIN MASKALANGAN", async () => {
    service.checkLock.mockResolvedValue(LOCKED_STATE);

    const req = reqWithPin();
    await run(req, resWithHeader());

    expect(req.auditUser).toBeDefined();
    expect(req.auditUser.name).toContain("****0123");
    expect(req.auditUser.name).not.toContain(PIN);
  });

  test("PIN bo'lmagan so'rovga tegilmaydi (limiterlar/validator o'z ishini qiladi)", async () => {
    const { arg } = await run(
      createMockReq({ body: {}, user: undefined, ip: IP }),
      resWithHeader(),
    );

    expect(service.checkLock).not.toHaveBeenCalled();
    expect(arg).toBeUndefined();
  });

  test("FAIL-CLOSED: Mongo nosozligida login RAD ETILADI (503), o'tkazilmaydi", async () => {
    service.checkLock.mockRejectedValue(new Error("Mongo topilmadi"));

    const { arg } = await run(reqWithPin(), resWithHeader());

    expect(arg).toBeDefined();
    expect(arg.statusCode).toBe(503);
    expect(arg.statusCode).not.toBe(429);
  });

  test("FAIL-CLOSED xabari PIN ni oshkor qilmaydi", async () => {
    service.checkLock.mockRejectedValue(new Error("Mongo topilmadi"));

    const { arg } = await run(reqWithPin(), resWithHeader());

    expect(`${arg.message} ${arg.detail}`).not.toContain(PIN);
  });
});
