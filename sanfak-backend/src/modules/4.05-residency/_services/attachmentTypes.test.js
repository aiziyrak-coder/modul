"use strict";

const { resolveType, ACCEPT_EXTENSIONS } = require("./attachmentTypes");

const header = (bytes, tail = 64) =>
  Buffer.concat([Buffer.from(bytes), Buffer.alloc(tail)]);

const PDF = header([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const ZIP = header([0x50, 0x4b, 0x03, 0x04]);
const OLE2 = header([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const PNG = header([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = header([0xff, 0xd8, 0xff, 0xe0]);
const GIF = header([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const RAR = header([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]);
const SEVENZIP = header([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);
const RTF = Buffer.from("{\\rtf1\\ansi salom}");
const TXT = Buffer.from("Assalomu alaykum,\nbu oddiy matn fayli.\n");
const CSV = Buffer.from("fio,kurs,ball\nAliyev A,1,85\n");
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
const EXE = header([0x4d, 0x5a, 0x90, 0x00]);
const ELF = header([0x7f, 0x45, 0x4c, 0x46]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
  Buffer.alloc(64),
]);

describe("resolveType — to'g'ri fayllar qabul qilinadi", () => {
  const cases = [
    ["buyruq.pdf", PDF, "application/pdf"],
    ["shartnoma.doc", OLE2, "application/msword"],
    [
      "bayonnoma.docx",
      ZIP,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ["hisobot.xls", OLE2, "application/vnd.ms-excel"],
    [
      "jadval.xlsx",
      ZIP,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    ["taqdimot.ppt", OLE2, "application/vnd.ms-powerpoint"],
    [
      "taqdimot.pptx",
      ZIP,
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    ["matn.odt", ZIP, "application/vnd.oasis.opendocument.text"],
    ["jadval.ods", ZIP, "application/vnd.oasis.opendocument.spreadsheet"],
    ["slayd.odp", ZIP, "application/vnd.oasis.opendocument.presentation"],
    ["xat.rtf", RTF, "application/rtf"],
    ["eslatma.txt", TXT, "text/plain"],
    ["royxat.csv", CSV, "text/csv"],
    ["rasm.jpg", JPEG, "image/jpeg"],
    ["rasm.jpeg", JPEG, "image/jpeg"],
    ["rasm.png", PNG, "image/png"],
    ["rasm.webp", WEBP, "image/webp"],
    ["animatsiya.gif", GIF, "image/gif"],
    ["logo.svg", SVG, "image/svg+xml"],
    ["arxiv.zip", ZIP, "application/zip"],
    ["arxiv.rar", RAR, "application/x-rar-compressed"],
    ["arxiv.7z", SEVENZIP, "application/x-7z-compressed"],
  ];

  it.each(cases)("%s qabul qilinadi", (name, buf, mime) => {
    const res = resolveType(name, buf);
    expect(res.ok).toBe(true);
    expect(res.type.mime).toBe(mime);
  });

  it("barcha ALLOWED_TYPES kengaytmalari sinovdan o'tgan", () => {
    const tested = new Set(cases.map(([name]) => name.slice(name.lastIndexOf("."))));
    expect([...ACCEPT_EXTENSIONS].sort()).toEqual([...tested].sort());
  });

  it("kengaytma katta harfda bo'lsa ham qabul qilinadi", () => {
    expect(resolveType("BUYRUQ.PDF", PDF).ok).toBe(true);
  });
});

describe("resolveType — ruxsat etilmagan kengaytma", () => {
  it.each([
    ["virus.exe", EXE],
    ["skript.sh", TXT],
    ["video.mp4", header([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])],
    ["kengaytmasiz", PDF],
  ])("%s rad etiladi", (name, buf) => {
    const res = resolveType(name, buf);
    expect(res.ok).toBe(false);
    expect(res.code).toBe("ATTACHMENT_TYPE_NOT_ALLOWED");
  });
});

describe("resolveType — SOXTA kengaytma (magic byte mos emas)", () => {
  it("exe faylni .pdf deb nomlash rad etiladi", () => {
    const res = resolveType("hisobot.pdf", EXE);
    expect(res.ok).toBe(false);
    expect(res.code).toBe("ATTACHMENT_TYPE_MISMATCH");
  });

  it("ELF binarni .docx deb nomlash rad etiladi", () => {
    expect(resolveType("bayonnoma.docx", ELF).code).toBe(
      "ATTACHMENT_TYPE_MISMATCH",
    );
  });

  it("PDF faylni .png deb nomlash rad etiladi", () => {
    expect(resolveType("rasm.png", PDF).code).toBe("ATTACHMENT_TYPE_MISMATCH");
  });

  it("PNG faylni .txt deb nomlash rad etiladi (binar)", () => {
    expect(resolveType("eslatma.txt", PNG).code).toBe(
      "ATTACHMENT_TYPE_MISMATCH",
    );
  });

  it("exe faylni .txt deb nomlash rad etiladi (xavfli imzo)", () => {
    expect(resolveType("eslatma.txt", EXE).code).toBe(
      "ATTACHMENT_TYPE_MISMATCH",
    );
  });

  it("HTML/skriptli kontent .csv sifatida rad etiladi", () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    expect(resolveType("royxat.csv", html).code).toBe(
      "ATTACHMENT_TYPE_MISMATCH",
    );
  });

  it("NUL baytli kontent .txt sifatida rad etiladi", () => {
    const binary = Buffer.from([0x41, 0x42, 0x00, 0x43]);
    expect(resolveType("eslatma.txt", binary).code).toBe(
      "ATTACHMENT_TYPE_MISMATCH",
    );
  });

  it("SVG bo'lmagan matn .svg sifatida rad etiladi", () => {
    expect(resolveType("logo.svg", TXT).code).toBe("ATTACHMENT_TYPE_MISMATCH");
  });

  it("bo'sh header rad etiladi", () => {
    expect(resolveType("buyruq.pdf", Buffer.alloc(0)).code).toBe(
      "ATTACHMENT_TYPE_MISMATCH",
    );
  });
});

describe("resolveType — ma'lum cheklov (hujjatlashtirilgan)", () => {
  it("zip faylni .docx deb nomlash O'TADI — ZIP oilasi ajratilmaydi", () => {
    expect(resolveType("bayonnoma.docx", ZIP).ok).toBe(true);
  });
});
