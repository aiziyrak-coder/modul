"use strict";

const {
  resolveAllowedOrigins,
  isOriginAllowed,
  isSameOrigin,
  DEV_DEFAULT_ORIGINS,
} = require("./corsOrigin");

describe("resolveAllowedOrigins", () => {
  it("ALLOWED_ORIGINS bo'sh, dev muhit -> dev default", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "dev";
    expect(resolveAllowedOrigins("")).toEqual(DEV_DEFAULT_ORIGINS);
    process.env.NODE_ENV = prev;
  });

  it("ALLOWED_ORIGINS bo'sh, production -> bo'sh ro'yxat (fail-closed)", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    expect(resolveAllowedOrigins("")).toEqual([]);
    process.env.NODE_ENV = prev;
  });

  it("ALLOWED_ORIGINS berilgan -> vergul bilan bo'linadi, trim qilinadi", () => {
    expect(resolveAllowedOrigins(" https://a.uz, https://b.uz ")).toEqual([
      "https://a.uz",
      "https://b.uz",
    ]);
  });

  it("PUBLIC_BASE_URL sozlangan -> uning origini ro'yxatga avtomatik qo'shiladi", () => {
    const prev = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = "https://test4.softlab.uz";
    expect(resolveAllowedOrigins("https://a.uz")).toEqual([
      "https://a.uz",
      "https://test4.softlab.uz",
    ]);
    if (prev === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = prev;
  });

  it("PUBLIC_BASE_URL origini allaqachon ALLOWED_ORIGINS'da bo'lsa -> dublikat qo'shilmaydi", () => {
    const prev = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = "https://a.uz/some/path";
    expect(resolveAllowedOrigins("https://a.uz")).toEqual(["https://a.uz"]);
    if (prev === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = prev;
  });
});

describe("isSameOrigin", () => {
  const mockReq = (protocol, host) => ({
    protocol,
    get: (name) => (name === "host" ? host : undefined),
  });

  it("Origin so'rovning o'z hosti bilan bir xil -> ruxsat", () => {
    expect(isSameOrigin("https://test4.softlab.uz", mockReq("https", "test4.softlab.uz"))).toBe(
      true,
    );
  });

  it("katta-kichik harf farqi hisobga olinmaydi", () => {
    expect(isSameOrigin("HTTPS://TEST4.SOFTLAB.UZ", mockReq("https", "test4.softlab.uz"))).toBe(
      true,
    );
  });

  it("Origin boshqa host -> rad", () => {
    expect(isSameOrigin("https://evil.example", mockReq("https", "test4.softlab.uz"))).toBe(
      false,
    );
  });

  it("`req` berilmagan -> rad (fail-closed)", () => {
    expect(isSameOrigin("https://test4.softlab.uz", undefined)).toBe(false);
  });
});

describe("isOriginAllowed", () => {
  it("origin yo'q (server-to-server) -> ruxsat", () => {
    expect(isOriginAllowed(undefined, ["https://a.uz"])).toBe(true);
  });

  it("ro'yxatda bor -> ruxsat", () => {
    expect(isOriginAllowed("https://a.uz", ["https://a.uz"])).toBe(true);
  });

  it("ro'yxatda yo'q -> rad", () => {
    expect(isOriginAllowed("https://evil.example", ["https://a.uz"])).toBe(false);
  });

  it("dev muhitda ham allowlist'dan tashqari origin RAD etiladi (eski xulq — WP-C bilan tuzatildi)", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "dev";
    expect(isOriginAllowed("https://evil.example", ["https://a.uz"])).toBe(false);
    process.env.NODE_ENV = prev;
  });

  const mockReq = (protocol, host) => ({
    protocol,
    get: (name) => (name === "host" ? host : undefined),
  });

  it("Origin so'rovning o'z hosti bilan bir xil (allowlist'da yo'q bo'lsa ham) -> ruxsat", () => {
    expect(
      isOriginAllowed(
        "https://test4.softlab.uz",
        ["https://boshqa.uz"],
        mockReq("https", "test4.softlab.uz"),
      ),
    ).toBe(true);
  });

  it("begona origin (na same-origin, na allowlist'da) -> rad", () => {
    expect(
      isOriginAllowed(
        "https://evil.example",
        ["https://a.uz"],
        mockReq("https", "test4.softlab.uz"),
      ),
    ).toBe(false);
  });

  it("`origin` yo'q, `req` bo'lsa ham -> ruxsat (server-to-server)", () => {
    expect(isOriginAllowed(undefined, ["https://a.uz"], mockReq("https", "test4.softlab.uz"))).toBe(
      true,
    );
  });
});
