jest.mock("./loginLock.model", () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
}));

const crypto = require("crypto");
const LoginLockModel = require("./loginLock.model");
const service = require("./loginLock.service");

const PIN = "31234567890123";
const IP = "203.0.113.44";
const OTHER_IP = "198.51.100.7";

const keyFor = (ip, pin) =>
  crypto.createHash("sha256").update(`loginLock:v2:${ip}|${pin}`).digest("hex");

const EXPECTED_KEY = keyFor(IP, PIN);

const NOW = new Date("2026-08-21T10:00:00.000Z");

const mockFindOne = (doc) => {
  LoginLockModel.findOne.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      }),
    }),
  });
};

const mockIncResult = (failedCount) => {
  LoginLockModel.findOneAndUpdate.mockReturnValue({
    exec: jest.fn().mockResolvedValue({ failedCount }),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  LoginLockModel.updateOne.mockReturnValue({
    exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  });
  LoginLockModel.deleteOne.mockReturnValue({
    exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("loginLock.service — registerFailure (chegara 8 / 15 daqiqa)", () => {
  test("7-chi xato urinishda hisob HALI qulflanmaydi", async () => {
    mockIncResult(7);

    const result = await service.registerFailure(IP, PIN);

    expect(result.locked).toBe(false);
    expect(result.justLocked).toBe(false);
    expect(result.remaining).toBe(1);
    expect(LoginLockModel.updateOne).toHaveBeenCalledTimes(1);
  });

  test("8-chi xato urinishdan keyin qulf yoziladi — 30 daqiqaga", async () => {
    mockIncResult(8);

    const result = await service.registerFailure(IP, PIN);

    expect(result.locked).toBe(true);
    expect(result.justLocked).toBe(true);
    expect(result.lockedUntil.getTime()).toBe(NOW.getTime() + 30 * 60 * 1000);

    expect(LoginLockModel.updateOne).toHaveBeenCalledTimes(2);
    const [filter, update] = LoginLockModel.updateOne.mock.calls[1];
    expect(filter).toEqual({ pinHash: EXPECTED_KEY });
    expect(update.$set.lockedUntil.getTime()).toBe(
      NOW.getTime() + 30 * 60 * 1000,
    );
    expect(update.$set.failedCount).toBe(0);
    expect(update.$inc).toEqual({ lockCount: 1 });
  });

  test("eskirgan 15 daqiqalik oyna sanoqni shartli ravishda nolga qaytaradi", async () => {
    mockIncResult(1);

    await service.registerFailure(IP, PIN);

    const [filter, update] = LoginLockModel.updateOne.mock.calls[0];
    expect(filter.pinHash).toBe(EXPECTED_KEY);
    expect(filter.windowStartAt.$lt.getTime()).toBe(
      NOW.getTime() - 15 * 60 * 1000,
    );
    expect(update.$set.failedCount).toBe(0);
  });

  test("TTL nishoni (`expiresAt`) har urinishda oldinga suriladi", async () => {
    mockIncResult(3);

    await service.registerFailure(IP, PIN);

    const [, update] = LoginLockModel.findOneAndUpdate.mock.calls[0];
    expect(update.$inc).toEqual({ failedCount: 1 });
    expect(update.$set.expiresAt.getTime()).toBeGreaterThan(NOW.getTime());
  });
});

describe("loginLock.service — checkLock (avtomatik ochilish)", () => {
  test("qulflangan juftlik → locked + qachon ochilishi qaytadi", async () => {
    const lockedUntil = new Date(NOW.getTime() + 30 * 60 * 1000);
    mockFindOne({ lockedUntil });

    const state = await service.checkLock(IP, PIN);

    expect(state.locked).toBe(true);
    expect(state.retryAfterSeconds).toBe(30 * 60);
    expect(state.retryAfterMinutes).toBe(30);
  });

  test("30 daqiqa o'tgach qulf AVTOMATIK ochiladi (yozuv hali DB'da bo'lsa ham)", async () => {
    const lockedUntil = new Date(NOW.getTime() + 30 * 60 * 1000);
    mockFindOne({ lockedUntil });

    jest.setSystemTime(new Date(lockedUntil.getTime() + 1000));

    const state = await service.checkLock(IP, PIN);

    expect(state.locked).toBe(false);
  });

  test("yozuv umuman bo'lmasa qulf yo'q", async () => {
    mockFindOne(null);

    expect((await service.checkLock(IP, PIN)).locked).toBe(false);
  });
});

describe("loginLock.service — clearFailures (muvaffaqiyatli login)", () => {
  test("muvaffaqiyatli login hisoblagichni tozalaydi", async () => {
    await service.clearFailures(IP, PIN);

    expect(LoginLockModel.deleteOne).toHaveBeenCalledWith({
      pinHash: EXPECTED_KEY,
    });
  });
});

describe("loginLock.service — kalit (IP + PIN) HASH, ochiq qiymat emas", () => {
  test("hech bir DB so'rovida ochiq PIN ham, ochiq IP ham yo'q", async () => {
    mockIncResult(2);
    mockFindOne(null);

    await service.registerFailure(IP, PIN);
    await service.checkLock(IP, PIN);
    await service.clearFailures(IP, PIN);

    const allArgs = JSON.stringify([
      LoginLockModel.updateOne.mock.calls,
      LoginLockModel.findOneAndUpdate.mock.calls,
      LoginLockModel.findOne.mock.calls,
      LoginLockModel.deleteOne.mock.calls,
    ]);

    expect(allArgs).not.toContain(PIN);
    expect(allArgs).not.toContain(IP);
    expect(allArgs).toContain(EXPECTED_KEY);
    expect(EXPECTED_KEY).toMatch(/^[0-9a-f]{64}$/);
  });

  test("HISOB-QULFLASH DoS yopiq: boshqa IP dan bir xil PIN — BOSHQA kalit", () => {
    expect(service.hashKey(OTHER_IP, PIN)).not.toBe(service.hashKey(IP, PIN));
    expect(service.hashKey(OTHER_IP, PIN)).toBe(keyFor(OTHER_IP, PIN));
  });

  test("IPv4-mapped IPv6 tekislanadi — `::ffff:` bilan qulfdan qochib bo'lmaydi", () => {
    expect(service.hashKey("::ffff:203.0.113.44", PIN)).toBe(EXPECTED_KEY);
  });

  test("IPv6 /56 gacha maskalanadi — bitta prefiks ichida IP almashtirish yordam bermaydi", () => {
    const a = service.hashKey("2001:db8:1234:5678:1111:1111:1111:1111", PIN);
    const b = service.hashKey("2001:db8:1234:56ff:2222:2222:2222:2222", PIN);

    expect(a).toBe(b);
  });

  test("kalit versiyasi v2 — eski (faqat PIN) v1 yozuvlari bilan aralashmaydi", () => {
    const v1 = crypto
      .createHash("sha256")
      .update(`loginLock:v1:${PIN}`)
      .digest("hex");

    expect(service.hashKey(IP, PIN)).not.toBe(v1);
  });
});
