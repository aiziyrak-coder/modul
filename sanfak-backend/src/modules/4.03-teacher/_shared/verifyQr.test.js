const QRCode = require("qrcode");
const { prepareVerifyQr, buildVerifyUrl, QR_MAX_URL_BYTES, QR_SIZE } = require("./verifyQr");

const TOKEN = "f".repeat(32);
const plan = (over = {}) => ({ _id: "p1", status: "approved", verify: { token: TOKEN, revokedAt: null }, ...over });

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
  jest.restoreAllMocks();
});

describe("prepareVerifyQr — darvoza", () => {
  test.each([["submitted"], ["approved"], ["completed"]])("%s + token — URL `/verify/plan/<token>` va PNG", async (status) => {
    const qr = await prepareVerifyQr(plan({ status }));
    expect(qr.url).toMatch(new RegExp(`/verify/plan/${TOKEN}$`));
    expect(Buffer.isBuffer(qr.image)).toBe(true);
  });

  test.each([
    ["qoralama", plan({ status: "draft" })],
    ["rad etilgan", plan({ status: "rejected" })],
    ["token yo'q", plan({ verify: {} })],
    ["bekor qilingan", plan({ verify: { token: TOKEN, revokedAt: new Date() } })],
    ["reja yo'q", null],
  ])("%s — null", async (_n, p) => {
    await expect(prepareVerifyQr(p)).resolves.toBeNull();
  });

  test.each([["production"], ["prod"], [undefined]])("NODE_ENV=%p + PUBLIC_BASE_URL yo'q — URL yo'q", (env) => {
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
    delete process.env.PUBLIC_BASE_URL;
    expect(buildVerifyUrl(TOKEN)).toBeNull();
  });

  test("prod + PUBLIC_BASE_URL yo'q — null (localhost'li QR bosilmaydi)", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.PUBLIC_BASE_URL;
    expect(buildVerifyUrl(TOKEN)).toBeNull();
    await expect(prepareVerifyQr(plan())).resolves.toBeNull();
  });

  test("QR opsiyalari 4.02 bilan bir xil; o'lcham 44pt", async () => {
    const spy = jest.spyOn(QRCode, "toBuffer");
    await prepareVerifyQr(plan());
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ errorCorrectionLevel: "M", margin: 1, scale: 8 }),
    );
    expect(QR_SIZE).toBe(44);
  });

  test("odatiy prod host bilan URL v5-M sig'imida (≤ 84 bayt)", () => {
    process.env.PUBLIC_BASE_URL = "https://test4.softlab.uz";
    expect(Buffer.byteLength(buildVerifyUrl(TOKEN))).toBeLessThanOrEqual(QR_MAX_URL_BYTES);
  });
});
