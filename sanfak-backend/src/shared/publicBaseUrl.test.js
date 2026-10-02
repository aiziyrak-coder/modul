"use strict";

const fresh = () => {
  jest.resetModules();
  return require("./publicBaseUrl");
};

const mockReq = (host, protocol = "https") => ({
  protocol,
  get: (h) => (h.toLowerCase() === "host" ? host : undefined),
});

describe("resolvePublicBaseUrl", () => {
  const ORIG_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIG_ENV };
  });

  it("PUBLIC_BASE_URL bo'lsa — u ustun, oxirgi `/` olib tashlanadi", () => {
    process.env.PUBLIC_BASE_URL = "https://example.uz/";
    const { resolvePublicBaseUrl } = fresh();
    expect(resolvePublicBaseUrl(mockReq("boshqa.host"))).toBe("https://example.uz");
  });

  it("PUBLIC_BASE_URL atrofidagi bo'sh joy trim qilinadi", () => {
    process.env.PUBLIC_BASE_URL = "  https://example.uz  ";
    const { resolvePublicBaseUrl } = fresh();
    expect(resolvePublicBaseUrl(mockReq("boshqa.host"))).toBe("https://example.uz");
  });

  it("env yo'q, Host ALLOWED_ORIGINS'da — shu hostdan quriladi", () => {
    delete process.env.PUBLIC_BASE_URL;
    process.env.ALLOWED_ORIGINS = "https://api.institut.uz";
    const { resolvePublicBaseUrl } = fresh();
    expect(resolvePublicBaseUrl(mockReq("api.institut.uz"))).toBe(
      "https://api.institut.uz",
    );
  });

  it("env yo'q, Host allowlist'da EMAS — `null` (Host injection himoyasi)", () => {
    delete process.env.PUBLIC_BASE_URL;
    process.env.ALLOWED_ORIGINS = "https://api.institut.uz";
    process.env.NODE_ENV = "production";
    const { resolvePublicBaseUrl } = fresh();
    expect(resolvePublicBaseUrl(mockReq("evil.example"))).toBeNull();
  });

  it("dev muhitda localhost (istalgan port) — allowlist'siz ham ruxsat", () => {
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.ALLOWED_ORIGINS;
    process.env.NODE_ENV = "dev";
    const { resolvePublicBaseUrl } = fresh();
    expect(resolvePublicBaseUrl(mockReq("localhost:4000"))).toBe(
      "https://localhost:4000",
    );
    expect(resolvePublicBaseUrl(mockReq("127.0.0.1:4000"))).toBe(
      "https://127.0.0.1:4000",
    );
  });

  it("production'da localhost ham RAD etiladi (dev-only zaxira)", () => {
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.ALLOWED_ORIGINS;
    process.env.NODE_ENV = "production";
    const { resolvePublicBaseUrl } = fresh();
    expect(resolvePublicBaseUrl(mockReq("localhost:4000"))).toBeNull();
  });

  it("env ham, Host ham yo'q — `null`", () => {
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.ALLOWED_ORIGINS;
    process.env.NODE_ENV = "production";
    const { resolvePublicBaseUrl } = fresh();
    expect(resolvePublicBaseUrl(mockReq(undefined))).toBeNull();
  });
});

describe("isHostAllowed", () => {
  const ORIG_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIG_ENV };
  });

  it("PUBLIC_BASE_URL hosti ruxsat etiladi", () => {
    process.env.PUBLIC_BASE_URL = "https://api.institut.uz";
    const { isHostAllowed } = fresh();
    expect(isHostAllowed("api.institut.uz")).toBe(true);
  });

  it("registrga sezgir emas", () => {
    process.env.PUBLIC_BASE_URL = "https://Api.Institut.uz";
    const { isHostAllowed } = fresh();
    expect(isHostAllowed("api.institut.uz")).toBe(true);
  });

  it("noma'lum host RAD etiladi", () => {
    process.env.PUBLIC_BASE_URL = "https://api.institut.uz";
    const { isHostAllowed } = fresh();
    expect(isHostAllowed("evil.example")).toBe(false);
  });

  it("host bo'sh/yo'q — RAD etiladi", () => {
    const { isHostAllowed } = fresh();
    expect(isHostAllowed("")).toBe(false);
    expect(isHostAllowed(undefined)).toBe(false);
  });
});
