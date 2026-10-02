"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");

const files = require("./announcementFiles");

let ROOT;
const ORIGINAL_ENV = process.env.RESIDENCY_ANNOUNCEMENT_FILES_DIR;

beforeEach(async () => {
  ROOT = await fsp.mkdtemp(path.join(os.tmpdir(), "resann-"));
  process.env.RESIDENCY_ANNOUNCEMENT_FILES_DIR = ROOT;
  await files.ensureTmpDir();
});

afterEach(async () => {
  await fsp.rm(ROOT, { recursive: true, force: true });
  if (ORIGINAL_ENV === undefined) {
    delete process.env.RESIDENCY_ANNOUNCEMENT_FILES_DIR;
  } else {
    process.env.RESIDENCY_ANNOUNCEMENT_FILES_DIR = ORIGINAL_ENV;
  }
});

describe("Saqlash joyi — `uploads/` ichida, lekin `/files` havolasisiz", () => {
  it("default ildiz `uploads/residency-announcements` — boshqa modullar bilan izchil", () => {
    delete process.env.RESIDENCY_ANNOUNCEMENT_FILES_DIR;
    const root = files.resolveRoot().replace(/\\/g, "/");
    expect(root.endsWith("uploads/residency-announcements")).toBe(true);
  });

  it("env bilan ustidan yozish mumkin", () => {
    process.env.RESIDENCY_ANNOUNCEMENT_FILES_DIR = "/tmp/boshqa-joy";
    expect(files.resolveRoot()).toBe("/tmp/boshqa-joy");
  });

  it("modul `/files` URL yasamaydi va `appendSignature` ni import qilmaydi", () => {
    const src = fs.readFileSync(require.resolve("./announcementFiles"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/appendSignature/);
    expect(code).not.toMatch(/["'`][^"'`]*\/files\//);
  });

  it("kalit UUIDv4 — taxmin qilib bo'lmaydigan nom (himoyaning asosi)", () => {
    const key = files.buildStorageKey(".svg");
    expect(key).toMatch(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.svg$/,
    );
  });
});

describe("sanitizeFilename", () => {
  it("oddiy nomni o'zgartirmaydi", () => {
    expect(files.sanitizeFilename("buyruq.pdf", ".pdf")).toBe("buyruq.pdf");
  });

  it("papka qismini olib tashlaydi (unix va windows)", () => {
    expect(files.sanitizeFilename("../../etc/passwd.pdf", ".pdf")).toBe(
      "passwd.pdf",
    );
    expect(files.sanitizeFilename("C:\\Windows\\system32\\x.pdf", ".pdf")).toBe(
      "x.pdf",
    );
  });

  it("faqat nuqtalardan iborat nomni xavfsiz nomga aylantiradi", () => {
    expect(files.sanitizeFilename("...", ".pdf")).toBe("fayl.pdf");
    expect(files.sanitizeFilename("", ".pdf")).toBe("fayl.pdf");
  });

  it("taqiqlangan belgilarni olib tashlaydi", () => {
    expect(files.sanitizeFilename('he"llo<>:|?*.pdf', ".pdf")).toBe("hello.pdf");
  });

  it("boshqaruv baytlarini olib tashlaydi", () => {
    expect(files.sanitizeFilename("a\u0000b\u001fc.pdf", ".pdf")).toBe("abc.pdf");
  });

  it("kengaytmani bir marta qo'yadi (dublikat qilmaydi)", () => {
    expect(files.sanitizeFilename("hisobot.pdf", ".pdf")).toBe("hisobot.pdf");
    expect(files.sanitizeFilename("hisobot.PDF", ".pdf")).toBe("hisobot.pdf");
  });

  it("kengaytmasi yo'q nomga kengaytma qo'shadi", () => {
    expect(files.sanitizeFilename("hisobot", ".pdf")).toBe("hisobot.pdf");
  });

  it("juda uzun nomni qisqartiradi, kengaytmani saqlaydi", () => {
    const out = files.sanitizeFilename(`${"a".repeat(500)}.pdf`, ".pdf");
    expect(out.endsWith(".pdf")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(204);
  });

  it("kirill/o'zbek harflarini saqlaydi", () => {
    expect(files.sanitizeFilename("Buyruq № 12 — o'zgartirish.pdf", ".pdf")).toBe(
      "Buyruq № 12 — o'zgartirish.pdf",
    );
  });
});

describe("buildStorageKey", () => {
  it("sana bo'yicha shardlangan UUID kalit qaytaradi", () => {
    const key = files.buildStorageKey(".pdf");
    expect(key).toMatch(
      /^\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/,
    );
  });

  it("har chaqiruvda boshqa kalit beradi", () => {
    const keys = new Set(Array.from({ length: 50 }, () => files.buildStorageKey(".pdf")));
    expect(keys.size).toBe(50);
  });
});

describe("resolveAbsolute — path traversal himoyasi", () => {
  it("normal kalitni ildiz ostida yechadi", () => {
    const abs = files.resolveAbsolute("2026/08/x.pdf");
    expect(abs.startsWith(path.resolve(ROOT))).toBe(true);
  });

  it.each([
    "../../etc/passwd",
    "../outside.pdf",
    "2026/../../../secret.pdf",
  ])("ildizdan tashqariga chiqishni bloklaydi: %s", (key) => {
    expect(() => files.resolveAbsolute(key)).toThrow(/Yaroqsiz storageKey/);
  });
});

describe("inspect — oqim bilan checksum va header", () => {
  it("sha256, header va hajmni to'g'ri qaytaradi", async () => {
    const tmp = files.createTmpPath();
    await fsp.mkdir(path.dirname(tmp), { recursive: true });
    const body = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(10_000, 7)]);
    await fsp.writeFile(tmp, body);

    const res = await files.inspect(tmp);

    expect(res.size).toBe(body.length);
    expect(res.header.length).toBe(4096);
    expect(res.header.subarray(0, 4).toString()).toBe("%PDF");
    const crypto = require("crypto");
    expect(res.checksum).toBe(crypto.createHash("sha256").update(body).digest("hex"));
  });

  it("4 KB dan kichik faylda header butun fayl bo'ladi", async () => {
    const tmp = files.createTmpPath();
    await fsp.mkdir(path.dirname(tmp), { recursive: true });
    await fsp.writeFile(tmp, "kichik");
    const res = await files.inspect(tmp);
    expect(res.header.toString()).toBe("kichik");
    expect(res.size).toBe(6);
  });
});

describe("commit / createReadStream / remove", () => {
  const writeTmp = async (content) => {
    const tmp = files.createTmpPath();
    await fsp.mkdir(path.dirname(tmp), { recursive: true });
    await fsp.writeFile(tmp, content);
    return tmp;
  };

  it("tmp faylni yakuniy joyiga ko'chiradi", async () => {
    const tmp = await writeTmp("salom");
    const key = files.buildStorageKey(".txt");

    const abs = await files.commit(tmp, key);

    expect(fs.existsSync(abs)).toBe(true);
    expect(fs.existsSync(tmp)).toBe(false);
    expect(await fsp.readFile(abs, "utf8")).toBe("salom");
  });

  it("o'qish oqimi kontentni qaytaradi", async () => {
    const tmp = await writeTmp("kontent");
    const key = files.buildStorageKey(".txt");
    await files.commit(tmp, key);

    const chunks = [];
    for await (const c of files.createReadStream(key)) chunks.push(c);
    expect(Buffer.concat(chunks).toString()).toBe("kontent");
  });

  it("remove blobni o'chiradi", async () => {
    const tmp = await writeTmp("x");
    const key = files.buildStorageKey(".txt");
    const abs = await files.commit(tmp, key);

    expect(await files.remove(key)).toBe(true);
    expect(fs.existsSync(abs)).toBe(false);
  });

  it("remove mavjud bo'lmagan blobda ham true qaytaradi (idempotent)", async () => {
    expect(await files.remove(files.buildStorageKey(".txt"))).toBe(true);
  });

  it("remove yaroqsiz kalitda ATMAYDI, false qaytaradi", async () => {
    await expect(files.remove("../../qochib-ketdi.pdf")).resolves.toBe(false);
  });

  it("removeMany bir nechta blobni o'chiradi", async () => {
    const keys = [];
    for (const body of ["a", "b", "c"]) {
      const tmp = await writeTmp(body);
      const key = files.buildStorageKey(".txt");
      await files.commit(tmp, key);
      keys.push(key);
    }

    expect(await files.removeMany(keys)).toBe(3);
    for (const key of keys) expect(await files.stat(key)).toBeNull();
  });

  it("discardMany yakunlanmagan tmp fayllarni tozalaydi", async () => {
    const tmps = await Promise.all([writeTmp("1"), writeTmp("2")]);
    await files.discardMany(tmps);
    tmps.forEach((t) => expect(fs.existsSync(t)).toBe(false));
  });

  it("stat mavjud faylning hajmini qaytaradi", async () => {
    const tmp = await writeTmp("12345");
    const key = files.buildStorageKey(".txt");
    await files.commit(tmp, key);

    const st = await files.stat(key);
    expect(st.size).toBe(5);
  });
});

describe("scan — antivirus kengaytma nuqtasi", () => {
  it("hozircha har doim clean qaytaradi (no-op)", async () => {
    await expect(files.scan("/istalgan/yol")).resolves.toEqual({ clean: true });
  });
});

const makePart = async (name, ageMs = 0, size = 16) => {
  const abs = path.join(files.resolveTmpRoot(), name);
  await fsp.writeFile(abs, Buffer.alloc(size, 1));
  if (ageMs > 0) {
    const when = new Date(Date.now() - ageMs);
    await fsp.utimes(abs, when, when);
  }
  return abs;
};

const HOUR = 60 * 60 * 1000;

describe("sweepTmp — uzilgan yuklashdan qolgan yetim fayllar", () => {
  it("eski `.part` faylni o'chiradi", async () => {
    const abs = await makePart("eski.part", 2 * HOUR);
    expect(await files.sweepTmp(HOUR)).toBe(1);
    expect(fs.existsSync(abs)).toBe(false);
  });

  it("HALI OQIB TURGAN yosh faylga tegmaydi", async () => {
    const abs = await makePart("yangi.part", 0);
    expect(await files.sweepTmp(HOUR)).toBe(0);
    expect(fs.existsSync(abs)).toBe(true);
  });

  it("`.part` bo'lmagan faylga tegmaydi", async () => {
    const abs = path.join(files.resolveTmpRoot(), "izoh.txt");
    await fsp.writeFile(abs, "x");
    await fsp.utimes(abs, new Date(Date.now() - 5 * HOUR), new Date(Date.now() - 5 * HOUR));
    expect(await files.sweepTmp(HOUR)).toBe(0);
    expect(fs.existsSync(abs)).toBe(true);
  });

  it("bir nechta eskisini birdan supuradi, yoshini qoldiradi", async () => {
    await makePart("a.part", 3 * HOUR);
    await makePart("b.part", 3 * HOUR);
    const yosh = await makePart("c.part", 0);
    expect(await files.sweepTmp(HOUR)).toBe(2);
    expect(fs.existsSync(yosh)).toBe(true);
  });

  it("`.tmp` papkasi yo'q bo'lsa YIQILMAYDI", async () => {
    await fsp.rm(files.resolveTmpRoot(), { recursive: true, force: true });
    await expect(files.sweepTmp(HOUR)).resolves.toBe(0);
  });

  it("commit qilingan bloblarga TEGMAYDI (faqat `.tmp` ichini ko'radi)", async () => {
    const tmp = files.createTmpPath();
    await fsp.writeFile(tmp, "kontent");
    const key = files.buildStorageKey("hujjat.pdf");
    await files.commit(tmp, key);
    await files.sweepTmp(0);
    expect(fs.existsSync(files.resolveAbsolute(key))).toBe(true);
  });
});

describe("startTmpSweeper — davriy supurish", () => {
  afterEach(() => files.stopTmpSweeper());

  it("darhol bir marta supuradi va taymer qaytaradi", async () => {
    const abs = await makePart("boshlangich.part", 5 * HOUR);
    const timer = files.startTmpSweeper(60 * 60 * 1000);
    expect(timer).toBeTruthy();
    for (let i = 0; i < 100 && fs.existsSync(abs); i += 1) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(fs.existsSync(abs)).toBe(false);
  });

  it("ikki marta chaqirilsa ikkinchi taymer yaratmaydi (idempotent)", () => {
    const a = files.startTmpSweeper(60 * 60 * 1000);
    const b = files.startTmpSweeper(60 * 60 * 1000);
    expect(b).toBe(a);
  });

  it("taymer jarayonni tirik ushlamaydi (`unref`)", () => {
    const timer = files.startTmpSweeper(60 * 60 * 1000);
    expect(typeof timer.hasRef === "function" ? timer.hasRef() : false).toBe(false);
  });
});
