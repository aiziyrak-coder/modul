const { certVerifyUrl } = require("./sertifikat.pdf");

describe("certVerifyUrl — QR manzili (yo'nalishi)", () => {
  const OLD = process.env.PUBLIC_BASE_URL;
  afterEach(() => {
    if (OLD === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = OLD;
  });

  it("PUBLIC_BASE_URL bo'lsa — u ustun (prod domeni)", () => {
    process.env.PUBLIC_BASE_URL = "https://malaka.fjsti.uz";
    expect(certVerifyUrl("MO00001", "https://boshqa.host")).toBe(
      "https://malaka.fjsti.uz/verify/MO00001",
    );
  });

  it("env yo'q, reqBase bor — so'rov hostiga ishora qiladi (localhost EMAS)", () => {
    delete process.env.PUBLIC_BASE_URL;
    const url = certVerifyUrl("MO00001", "https://malaka.fjsti.uz");
    expect(url).toBe("https://malaka.fjsti.uz/verify/MO00001");
    expect(url).not.toMatch(/localhost/);
  });

  it("env ham, reqBase ham yo'q — dev localhost (zaxira)", () => {
    delete process.env.PUBLIC_BASE_URL;
    expect(certVerifyUrl("MO00001")).toMatch(/^http:\/\/localhost:\d+\/verify\/MO00001$/);
  });

  it("kod manzil oxirida to'g'ri qo'shiladi", () => {
    process.env.PUBLIC_BASE_URL = "https://x.uz";
    expect(certVerifyUrl("MM12345")).toBe("https://x.uz/verify/MM12345");
  });
});
