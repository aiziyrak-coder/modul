const mongoose = require("mongoose");
const QualEarnedCertificate = require("#modules/4.04-qualification/_shared/qualEarnedCertificate.model");
const {
  nextSeriesNumber,
  nextRegNumber,
  createNumberedCertificate,
} = require("#modules/4.04-qualification/_shared/qualCertificateNumber");

const oid = () => new mongoose.Types.ObjectId();
const COURSE = oid();

const make = (template = 1, listener = oid()) =>
  createNumberedCertificate({ course: COURSE, listener, kind: 1, template });

describe("qualCertificateNumber — real Mongo semantikasi", () => {
  beforeEach(async () => {
    await QualEarnedCertificate.init();
  });

  test("unikal indekslar yaratiladi (regNumber va template+number)", async () => {
    const idx = await QualEarnedCertificate.collection.indexes();
    const reg = idx.find((i) => i.key && i.key.regNumber === 1);
    const num = idx.find((i) => i.key && i.key.template === 1 && i.key.number === 1);
    expect(reg).toBeDefined();
    expect(reg.unique).toBe(true);
    expect(num).toBeDefined();
    expect(num.unique).toBe(true);
  });

  test("qayd raqami butun reyestr bo'yicha uzluksiz — seriyaga bo'linmaydi", async () => {
    const a = await make(1);
    const b = await make(2);
    const c = await make(1);
    expect([a.regNumber, b.regNumber, c.regNumber]).toEqual([
      "000001",
      "000002",
      "000003",
    ]);
  });

  test("seriya raqami HAR shablon uchun mustaqil, 1 dan boshlanadi", async () => {
    const a = await make(1);
    const b = await make(2);
    const c = await make(1);
    expect(a.number).toBe("00001");
    expect(b.number).toBe("00001");
    expect(c.number).toBe("00002");
  });

  test("PARALLEL yaratishda raqamlar TAKRORLANMAYDI", async () => {
    const certs = await Promise.all(
      Array.from({ length: 8 }, () => make(1)),
    );
    const regs = certs.map((c) => c.regNumber);
    const nums = certs.map((c) => c.number);
    expect(new Set(regs).size).toBe(8);
    expect(new Set(nums).size).toBe(8);
    expect(regs.slice().sort()).toEqual([
      "000001", "000002", "000003", "000004",
      "000005", "000006", "000007", "000008",
    ]);
  });

  test("yozuv o'chirilsa raqam QAYTA ISHLATILMAYDI (maksimumdan hisoblanadi)", async () => {
    const a = await make(1);
    const b = await make(1);
    await QualEarnedCertificate.deleteOne({ _id: b._id });
    const c = await make(1);
    expect(a.regNumber).toBe("000001");
    expect(b.regNumber).toBe("000002");
    expect(c.regNumber).toBe("000003");
  });

  test("ma'lumotnoma (kind=2) O'Z seriyasidan raqam oladi, qayd raqamisiz", async () => {
    const doc = await createNumberedCertificate({
      course: COURSE,
      listener: oid(),
      kind: 2,
      template: 1,
    });
    expect(doc.number).toMatch(/^\d{5}$/);
    expect(doc.regNumber).toBeUndefined();
    expect(doc.template).toBeUndefined();
  });

  test("ma'lumotnoma raqamlari SERTIFIKAT raqamlaridan mustaqil", async () => {
    const ref1 = await createNumberedCertificate({ course: COURSE, listener: oid(), kind: 2 });
    const cert = await createNumberedCertificate({
      course: COURSE, listener: oid(), kind: 1, template: 1,
    });
    const ref2 = await createNumberedCertificate({ course: COURSE, listener: oid(), kind: 2 });

    expect(Number(ref2.number)).toBe(Number(ref1.number) + 1);
    expect(cert.number).toBeDefined();
  });

  test("ma'lumotnomalar unikal indeksni bloklamaydi (partial filtr)", async () => {
    const mk = () =>
      createNumberedCertificate({
        course: COURSE,
        listener: oid(),
        kind: 2,
        template: 1,
      });
    await expect(Promise.all([mk(), mk(), mk()])).resolves.toHaveLength(3);
  });

  test("bo'sh bazada keyingi raqamlar 1 dan boshlanadi", async () => {
    await expect(nextRegNumber()).resolves.toBe("000001");
    await expect(nextSeriesNumber(3)).resolves.toBe("00001");
  });
});
