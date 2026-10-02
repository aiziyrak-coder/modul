const path = require("path");
const { createMockReq, createMockRes, createMockNext } = require("../helpers/mockResponse");

const { appendSignature, signQuery, verifySignature } = require("#shared/fileAccess");
const createFileAccessGuard = require("#shared/fileAccessGuard");

describe("appendSignature", () => {
  test("rasm URL (jpg) — o'zgarishsiz qaytadi", () => {
    const url = "http://host/files/photo/users/123.jpg";
    expect(appendSignature(url)).toBe(url);
  });

  test("hujjat URL (pdf) — ?t=&e= qo'shiladi", () => {
    const url = "http://host/files/pdfs/fan-dasturi-1.pdf";
    const signed = appendSignature(url);
    expect(signed).toMatch(/^http:\/\/host\/files\/pdfs\/fan-dasturi-1\.pdf\?t=[a-f0-9]{32}&e=\d+$/);
  });

  test("/files/ ichida bo'lmagan qiymat — o'zgarishsiz qaytadi", () => {
    expect(appendSignature("not-a-file-url")).toBe("not-a-file-url");
  });

  test("null/undefined — xatosiz o'zi qaytadi", () => {
    expect(appendSignature(null)).toBeNull();
    expect(appendSignature(undefined)).toBeUndefined();
  });
});

describe("verifySignature", () => {
  test("to'g'ri imzo — valid: true", () => {
    const { t, e } = Object.fromEntries(
      signQuery("bachelor/x.pdf").split("&").map((p) => p.split("=")),
    );
    const result = verifySignature("bachelor/x.pdf", t, e);
    expect(result.valid).toBe(true);
  });

  test("imzo yo'q — rad etiladi", () => {
    const result = verifySignature("bachelor/x.pdf", undefined, undefined);
    expect(result.valid).toBe(false);
  });

  test("soxta imzo — rad etiladi", () => {
    const [, e] = signQuery("bachelor/x.pdf").split("&")[1].split("=");
    const result = verifySignature("bachelor/x.pdf", "0".repeat(32), e);
    expect(result.valid).toBe(false);
  });

  test("muddati tugagan — rad etiladi", () => {
    const query = signQuery("bachelor/x.pdf", -10);
    const { t, e } = Object.fromEntries(query.split("&").map((p) => p.split("=")));
    const result = verifySignature("bachelor/x.pdf", t, e);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("muddati tugagan");
  });

  test("boshqa yo'l uchun imzo — mos kelmaydi (rad etiladi)", () => {
    const { t, e } = Object.fromEntries(
      signQuery("bachelor/x.pdf").split("&").map((p) => p.split("=")),
    );
    const result = verifySignature("bachelor/y.pdf", t, e);
    expect(result.valid).toBe(false);
  });
});

describe("fileAccessGuard middleware", () => {
  const uploadsRoot = path.join(__dirname, "../../uploads");
  const guard = createFileAccessGuard(uploadsRoot);

  const run = (req) => {
    const res = createMockRes();
    const next = createMockNext();
    guard(req, res, next);
    return { res, next };
  };

  test("rasm (jpg) — imzosiz next() chaqiriladi", () => {
    const req = createMockReq({ path: "/photo/users/1.jpg", query: {} });
    const { next, res } = run(req);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("hujjat (pdf) — imzosiz 403", () => {
    const req = createMockReq({ path: "/pdfs/fan-dasturi-1.pdf", query: {} });
    const { next, res } = run(req);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("hujjat (pdf) rasm papkasida — imzosiz baribir 403 (kengaytma bo'yicha)", () => {
    const req = createMockReq({ path: "/photo/users/leaked.pdf", query: {} });
    const { next, res } = run(req);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("hujjat (pdf) — to'g'ri imzo bilan next() chaqiriladi", () => {
    const query = signQuery("pdfs/fan-dasturi-1.pdf");
    const { t, e } = Object.fromEntries(query.split("&").map((p) => p.split("=")));
    const req = createMockReq({ path: "/pdfs/fan-dasturi-1.pdf", query: { t, e } });
    const { next, res } = run(req);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("path traversal (../.env) — 403", () => {
    const req = createMockReq({ path: "/../.env", query: {} });
    const { next, res } = run(req);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
