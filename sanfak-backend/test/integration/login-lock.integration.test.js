const mongoose = require("mongoose");
const LoginLockModel = require("#modules/4.01-auth/_loginLock/loginLock.model");
const service = require("#modules/4.01-auth/_loginLock/loginLock.service");

const PIN = "31234567890123";
const IP = "203.0.113.44";
const OTHER_IP = "198.51.100.7";
const { MAX_FAILED_ATTEMPTS, WINDOW_MS, LOCK_MS } = service.LOCK_POLICY;

const readDoc = (ip = IP) =>
  LoginLockModel.findOne({ pinHash: service.hashKey(ip, PIN) }).lean();

const failNTimes = async (n, ip = IP) => {
  let last;
  for (let i = 0; i < n; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    last = await service.registerFailure(ip, PIN);
  }
  return last;
};

describe("loginLock — real Mongo semantikasi", () => {
  test("indekslar yaratiladi: `pinHash` unique + `expiresAt` TTL", async () => {
    await LoginLockModel.init();
    const indexes = await LoginLockModel.collection.indexes();

    const unique = indexes.find((i) => i.key && i.key.pinHash === 1);
    expect(unique).toBeDefined();
    expect(unique.unique).toBe(true);

    const ttl = indexes.find((i) => i.key && i.key.expiresAt === 1);
    expect(ttl).toBeDefined();
    expect(ttl.expireAfterSeconds).toBe(0);
  });

  test(`${MAX_FAILED_ATTEMPTS - 1} ta xato urinish — qulf YO'Q`, async () => {
    const result = await failNTimes(MAX_FAILED_ATTEMPTS - 1);

    expect(result.locked).toBe(false);
    expect(result.failedCount).toBe(MAX_FAILED_ATTEMPTS - 1);
    expect((await service.checkLock(IP, PIN)).locked).toBe(false);
  });

  test(`${MAX_FAILED_ATTEMPTS}-chi xato urinishdan keyin juftlik qulflanadi`, async () => {
    const result = await failNTimes(MAX_FAILED_ATTEMPTS);

    expect(result.justLocked).toBe(true);

    const state = await service.checkLock(IP, PIN);
    expect(state.locked).toBe(true);
    expect(state.retryAfterMinutes).toBe(LOCK_MS / 60000);
  });

  test("qulf muddati tugagach AVTOMATIK ochiladi (TTL kutilmaydi)", async () => {
    await failNTimes(MAX_FAILED_ATTEMPTS);
    expect((await service.checkLock(IP, PIN)).locked).toBe(true);

    await LoginLockModel.updateOne(
      { pinHash: service.hashKey(IP, PIN) },
      { $set: { lockedUntil: new Date(Date.now() - 1000) } },
    );

    expect((await service.checkLock(IP, PIN)).locked).toBe(false);
  });

  test("oyna eskirsa sanoq noldan boshlanadi (15 daqiqa)", async () => {
    await failNTimes(MAX_FAILED_ATTEMPTS - 1);

    await LoginLockModel.updateOne(
      { pinHash: service.hashKey(IP, PIN) },
      { $set: { windowStartAt: new Date(Date.now() - WINDOW_MS - 1000) } },
    );

    const result = await service.registerFailure(IP, PIN);
    expect(result.failedCount).toBe(1);
    expect(result.locked).toBe(false);
  });

  test("muvaffaqiyatli login yozuvni butunlay tozalaydi", async () => {
    await failNTimes(3);
    expect(await readDoc()).not.toBeNull();

    await service.clearFailures(IP, PIN);

    expect(await readDoc()).toBeNull();
  });

  test("yozuvda OCHIQ PIN ham, OCHIQ IP ham yo'q — faqat sha256 kalit", async () => {
    await failNTimes(2);
    const doc = await readDoc();

    const raw = JSON.stringify(doc);
    expect(raw).not.toContain(PIN);
    expect(raw).not.toContain(IP);
    expect(doc.pinHash).toMatch(/^[0-9a-f]{64}$/);
    expect(doc.user).toBeUndefined();
    expect(doc.ip).toBeUndefined();
  });

  test("qulf yozilgach sanoq nolga qaytadi (ochilgandan keyin to'liq oyna)", async () => {
    await failNTimes(MAX_FAILED_ATTEMPTS);
    const doc = await readDoc();

    expect(doc.failedCount).toBe(0);
    expect(doc.lockCount).toBe(1);
    expect(doc.expiresAt.getTime()).toBeGreaterThan(doc.lockedUntil.getTime());
  });

  test("boshqa IP dan qilingan hujum QURBONNI qulflamaydi", async () => {
    const attacker = await failNTimes(MAX_FAILED_ATTEMPTS, OTHER_IP);
    expect(attacker.justLocked).toBe(true);

    expect((await service.checkLock(OTHER_IP, PIN)).locked).toBe(true);
    expect((await service.checkLock(IP, PIN)).locked).toBe(false);
    expect(await readDoc(IP)).toBeNull();
  });

  test("har juftlik uchun ALOHIDA yozuv (kalit to'qnashmaydi)", async () => {
    await failNTimes(2, IP);
    await failNTimes(3, OTHER_IP);

    expect((await readDoc(IP)).failedCount).toBe(2);
    expect((await readDoc(OTHER_IP)).failedCount).toBe(3);
    expect(await LoginLockModel.countDocuments()).toBe(2);
  });
});

afterAll(async () => {
  if (mongoose.models.loginLock) {
    await LoginLockModel.collection.drop().catch(() => {});
  }
});
