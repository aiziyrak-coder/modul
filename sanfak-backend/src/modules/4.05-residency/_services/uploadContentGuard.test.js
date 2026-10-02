"use strict";

const { guardUploadContent } = require("./uploadContentGuard");

const PDF = Buffer.from("255044462d312e340a", "hex");
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const MZ = Buffer.from("4d5a90000300000004000000ffff0000", "hex");
const ELF = Buffer.from("7f454c4602010100000000000000000002", "hex");
const ZIP = Buffer.from("504b03041400", "hex");
const MP4 = Buffer.from("0000001c667479706d703432", "hex");

const reqWith = (field, name, buffer) => ({
  files: { [field]: [{ fieldname: field, originalname: name, buffer, size: buffer.length }] },
});

const run = (req) => {
  let received;
  guardUploadContent()(req, {}, (err) => {
    received = err;
  });
  return received;
};

describe("guardUploadContent — rad etiladi", () => {
  it("MZ (exe) baytli fayl `.pdf` deb nomlansa — 400 (QA D-009 hujumi)", () => {
    const err = run(reqWith("file", "hisobot.pdf", MZ));
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    expect(err.detail).toBe("ATTACHMENT_TYPE_MISMATCH");
    expect(err.message).toContain("hisobot.pdf");
  });

  it("MZ baytli fayl `.mp4` deb nomlansa ham — 400 (kengaytma jadvalda yo'q)", () => {
    const err = run(reqWith("file", "kino.mp4", MZ));
    expect(err.statusCode).toBe(400);
    expect(err.detail).toBe("ATTACHMENT_TYPE_MISMATCH");
  });

  it("ELF (Linux) baytli fayl `.docx` deb nomlansa — 400", () => {
    expect(run(reqWith("file", "buyruq.docx", ELF)).statusCode).toBe(400);
  });

  it("PNG faylni `.pdf` deb nomlash — 400 (imzo guruhi mos emas)", () => {
    expect(run(reqWith("file", "hujjat.pdf", PNG)).statusCode).toBe(400);
  });

  it("`photo` maydoni ham tekshiriladi — 400", () => {
    expect(run(reqWith("photo", "rasm.png", MZ)).statusCode).toBe(400);
  });

  it("bir nechta fayldan BITTASI buzuq bo'lsa — butun so'rov 400", () => {
    const req = {
      files: {
        file: [{ originalname: "toza.pdf", buffer: PDF, size: PDF.length }],
        planFile: [{ originalname: "buzuq.pdf", buffer: MZ, size: MZ.length }],
      },
    };
    const err = run(req);
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain("buzuq.pdf");
  });

  it("`buffer` yo'q bo'lsa — fail-closed 500 (jimgina o'tkazilmaydi)", () => {
    const err = run({ files: { file: [{ originalname: "x.pdf" }] } });
    expect(err.statusCode).toBe(500);
    expect(err.detail).toBe("ATTACHMENT_INSPECT_FAILED");
  });
});

describe("guardUploadContent — O'TADI (regressiya to'ri)", () => {
  const passes = (req) => expect(run(req)).toBeUndefined();

  it("haqiqiy PDF `.pdf` deb", () => passes(reqWith("file", "reja.pdf", PDF)));
  it("haqiqiy PNG `.png` deb", () => passes(reqWith("photo", "rasm.png", PNG)));
  it("ZIP konteyner `.docx` deb", () => passes(reqWith("file", "hujjat.docx", ZIP)));

  it("video `.mp4` — jadvalda YO'Q, ya'ni bu qatlam to'smaydi", () => {
    passes(reqWith("file", "amaliyot.mp4", MP4));
  });

  it("`.tar` — jadvalda yo'q, o'tadi", () => {
    passes(reqWith("file", "arxiv.tar", Buffer.from("hello world tar body")));
  });

  it("kengaytmasiz fayl — o'tadi (qaror yuqori qatlamniki)", () => {
    passes(reqWith("file", "README", Buffer.from("matn")));
  });

  it("fayl umuman yuborilmasa — o'tadi", () => {
    passes({});
    passes({ files: {} });
  });

  it("multer `.array()` shakli ham qo'llab-quvvatlanadi", () => {
    passes({ files: [{ originalname: "reja.pdf", buffer: PDF, size: PDF.length }] });
    expect(run({ files: [{ originalname: "reja.pdf", buffer: MZ }] }).statusCode).toBe(400);
  });
});
