"use strict";

process.env.FILE_URL_SECRET = "test-secret-for-signed-paths";

const {
  SIGNED_PATH_PREFIXES,
  isPublicImageExt,
  isSignedPath,
  requiresSignature,
  appendSignature,
  signQuery,
  verifySignature,
} = require("./fileAccess");

describe("isSignedPath", () => {
  test.each([
    ["images/public/17854076667660.jpg", true],
    ["/images/public/1.jpg", true, "boshidagi slash ahamiyatsiz"],
    ["images/public/nested/deep.png", true],
    ["images/tasks/17854076667660.jpg", false, "vazifa ilovasi — avatar sinfida"],
    ["images/publicity/1.jpg", false, "prefiks TO'LIQ segment bo'yicha mos kelishi kerak"],
    ["residency-announcements/2026/08/uuid.png", false],
    ["", false],
  ])("%s -> %s", (p, expected) => {
    expect(isSignedPath(p)).toBe(expected);
  });

  test("Windows teskari slashlari ham normallashadi", () => {
    expect(isSignedPath("images\\public\\1.jpg")).toBe(true);
  });
});

describe("requiresSignature — guard/limiter/jurnal uchun YAGONA qaror", () => {
  test("🔴 maxfiy yo'ldagi RASM — imzo TALAB QILADI", () => {
    expect(requiresSignature("images/public/1.jpg", ".jpg")).toBe(true);
    expect(requiresSignature("images/public/1.png", ".png")).toBe(true);
  });

  test("oddiy rasm — OCHIQ qoladi (avatar/logo buzilmasin)", () => {
    expect(requiresSignature("images/tasks/1.jpg", ".jpg")).toBe(false);
    expect(requiresSignature("photo/countries/1.png", ".png")).toBe(false);
  });

  test("hujjat — har doim imzo (yo'ldan qat'i nazar)", () => {
    expect(requiresSignature("images/public/1.pdf", ".pdf")).toBe(true);
    expect(requiresSignature("file/resources/1.docx", ".docx")).toBe(true);
    expect(requiresSignature("bachelor/1.pdf", ".pdf")).toBe(true);
  });

  test("kengaytmasiz fayl — hujjat deb qaraladi", () => {
    expect(requiresSignature("file/x/noext", "")).toBe(true);
  });

  test("`isPublicImageExt` O'ZGARMADI — u faqat kengaytma haqida", () => {
    expect(isPublicImageExt(".jpg")).toBe(true);
    expect(isPublicImageExt(".pdf")).toBe(false);
  });

  test("🔴 WP-C: `.svg` endi RASM EMAS — imzo talab qiladi (XML/skript xavfi)", () => {
    expect(isPublicImageExt(".svg")).toBe(false);
    expect(requiresSignature("images/tasks/1.svg", ".svg")).toBe(true);
    expect(requiresSignature("photo/countries/1.svg", ".svg")).toBe(true);
  });
});

describe("appendSignature — guard bilan MOS bo'lishi shart", () => {
  test("maxfiy yo'ldagi rasm IMZOLANADI", () => {
    const url = appendSignature("http://h/files/images/public/1.jpg");
    expect(url).toMatch(/[?&]t=/);
    expect(url).toMatch(/[?&]e=/);
  });

  test("oddiy rasm imzolanmaydi (o'zgarishsiz)", () => {
    const url = "http://h/files/images/tasks/1.jpg";
    expect(appendSignature(url)).toBe(url);
  });

  test("imzolangan URL guard tekshiruvidan O'TADI", () => {
    const rel = "images/public/17854076667660.jpg";
    const q = new URLSearchParams(signQuery(rel));
    expect(verifySignature(rel, q.get("t"), q.get("e")).valid).toBe(true);
  });

  test("BOSHQA fayl uchun imzo bu faylga YARAMAYDI", () => {
    const q = new URLSearchParams(signQuery("images/public/a.jpg"));
    expect(verifySignature("images/public/b.jpg", q.get("t"), q.get("e")).valid).toBe(false);
  });

  test("imzosiz so'rov RAD etiladi", () => {
    expect(verifySignature("images/public/1.jpg", undefined, undefined).valid).toBe(false);
  });
});

describe("qamrov — ATAYLAB tor", () => {
  test("hozircha faqat `images/public/`", () => {
    expect(SIGNED_PATH_PREFIXES).toEqual(["images/public/"]);
  });

  test("diplom papkalari QAMROVDA EMAS (mavjud havolalar buzilmasin)", () => {
    expect(isSignedPath("bachelor/1.jpg")).toBe(false);
    expect(isSignedPath("master/1.jpg")).toBe(false);
    expect(isSignedPath("scientific/1.jpg")).toBe(false);
  });
});
