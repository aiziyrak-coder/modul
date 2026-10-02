"use strict";

const PATH = "file/resources/test.pdf";

const withSecret = (secret, fn) => {
  jest.resetModules();
  const prev = process.env.FILE_URL_SECRET;
  process.env.FILE_URL_SECRET = secret;
  try {
    return fn(require("./fileAccess"));
  } finally {
    if (prev === undefined) delete process.env.FILE_URL_SECRET;
    else process.env.FILE_URL_SECRET = prev;
  }
};

const sign = (secret) =>
  withSecret(secret, (m) => {
    const url = m.appendSignature(`http://x/files/${PATH}`);
    const q = Object.fromEntries(new URL(url).searchParams);
    return { t: q.t, e: q.e };
  });

describe("fileAccess — sir rotatsiyasi imzolarni bekor qiladi (MD-10)", () => {
  it("O'SHA sir bilan imzo YAROQLI", () => {
    const s = sign("SIR-A");
    expect(withSecret("SIR-A", (m) => m.verifySignature(PATH, s.t, s.e))).toEqual({ valid: true });
  });

  it("🔴 sir ALMASHTIRILSA o'sha imzo YAROQSIZ — ya'ni bekor qilish MAVJUD", () => {
    const s = sign("SIR-A");
    expect(withSecret("SIR-B", (m) => m.verifySignature(PATH, s.t, s.e))).toEqual({
      valid: false,
      reason: "imzo mos emas",
    });
  });

  it("boshqa FAYL yo'li uchun imzo ishlamaydi (yo'l imzoga kiradi)", () => {
    const s = sign("SIR-A");
    expect(
      withSecret("SIR-A", (m) => m.verifySignature("file/resources/boshqa.pdf", s.t, s.e)),
    ).toMatchObject({ valid: false });
  });

  it("muddati o'tgan imzo rad etiladi", () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    expect(withSecret("SIR-A", (m) => m.verifySignature(PATH, "x".repeat(32), past))).toEqual({
      valid: false,
      reason: "muddati tugagan",
    });
  });

  it("RASM imzolanmaydi (ochiq qoladi) — TTL/rotatsiya ularga ta'sir qilmaydi", () => {
    const url = withSecret("SIR-A", (m) => m.appendSignature("http://x/files/photo/a.jpg"));
    expect(url).toBe("http://x/files/photo/a.jpg");
  });
});
