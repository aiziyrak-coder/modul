const mongoose = require("mongoose");

const mockSavePdf = jest.fn(async () => "/files/pdfs/MO00001.pdf");
jest.mock("#modules/4.04-qualification/_pdf/sertifikat.pdf", () => ({
  saveSertifikatPdf: (...a) => mockSavePdf(...a),
  certVerifyUrl: (code, base) => `${base || "http://localhost:4000"}/verify/${code}`,
}));
const mockSaveRef = jest.fn(async (id, base) => {
  const url = `${base}/files/pdfs/MN00001.pdf`;
  // eslint-disable-next-line global-require
  await require("#modules/4.04-qualification/_shared/qualEarnedCertificate.model").updateOne(
    { _id: id },
    { $set: { file: url } },
  );
  return url;
});
jest.mock("#modules/4.04-qualification/_pdf/malumotnoma.pdf", () => ({
  saveMalumotnomaPdf: (...a) => mockSaveRef(...a),
}));

const QualEarnedCertificate = require("#modules/4.04-qualification/_shared/qualEarnedCertificate.model");
const Service = require("#modules/4.04-qualification/qualCertificate/qualCertificate.service");

const { STATUS } = Service;
const oid = () => new mongoose.Types.ObjectId();
const RECTOR = oid();

const makeCert = (over = {}) =>
  QualEarnedCertificate.create({
    course: oid(),
    listener: oid(),
    kind: 1,
    template: 1,
    number: "00001",
    regNumber: "000001",
    ...over,
  });

beforeEach(() => {
  mockSavePdf.mockClear();
  mockSaveRef.mockClear();
});

describe("Yaratilgan hujjat — boshlang'ich holat", () => {
  it("yangi yozuv KUTILMOQDA holatida tug'iladi va fayli yo'q", async () => {
    const cert = await makeCert();
    expect(cert.status).toBe(STATUS.PENDING);
    expect(cert.file).toBeFalsy();
  });

  it("tasdiqlanmagan hujjat tinglovchiga berilmaydi", async () => {
    const cert = await makeCert();
    expect(Service.isReleased(cert)).toBe(false);
  });
});

describe("Tasdiqlash", () => {
  it("statusni yozadi, kim va qachon tasdiqlaganini saqlaydi", async () => {
    const cert = await makeCert();
    const before = Date.now();

    const res = await Service.approveMany([cert._id], RECTOR, "http://x.uz");

    expect(res.approved).toEqual([String(cert._id)]);
    expect(res.failed).toEqual([]);

    const fresh = await QualEarnedCertificate.findById(cert._id).lean();
    expect(fresh.status).toBe(STATUS.APPROVED);
    expect(String(fresh.approvedBy)).toBe(String(RECTOR));
    expect(new Date(fresh.approvedAt).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("PDF AYNAN tasdiqdan keyin quriladi (sertifikat — QR bilan)", async () => {
    const cert = await makeCert();
    expect(mockSavePdf).not.toHaveBeenCalled();

    await Service.approveMany([cert._id], RECTOR, "http://x.uz");

    expect(mockSavePdf).toHaveBeenCalledTimes(1);
    expect(String(mockSavePdf.mock.calls[0][0])).toBe(String(cert._id));
    expect(mockSavePdf.mock.calls[0][1]).toBe("http://x.uz");
  });

  it("ma'lumotnoma (kind=2) o'z saqlagichi bilan quriladi", async () => {
    const cert = await makeCert({ kind: 2, number: "00001", regNumber: undefined });

    await Service.approveMany([cert._id], RECTOR, "http://x.uz");

    expect(mockSaveRef).toHaveBeenCalledTimes(1);
    expect(mockSavePdf).not.toHaveBeenCalled();
  });

  it("ma'lumotnoma havolasi ABSOLYUT saqlanadi (regressiya qulfi)", async () => {
    const cert = await makeCert({ kind: 2, number: "00001", regNumber: undefined });

    await Service.approveMany([cert._id], RECTOR, "http://x.uz");

    const fresh = await QualEarnedCertificate.findById(cert._id).lean();
    expect(fresh.file).toBe("http://x.uz/files/pdfs/MN00001.pdf");
  });

  it("sertifikat (kind=1) ma'lumotnoma saqlagichini chaqirmaydi", async () => {
    mockSavePdf.mockResolvedValueOnce("http://x.uz/files/pdfs/I00001.pdf");
    const cert = await makeCert();

    await Service.approveMany([cert._id], RECTOR, "http://x.uz");

    expect(mockSaveRef).not.toHaveBeenCalled();
  });

  it("ikki marta bosilsa xato bermaydi va PDF QAYTA qurilmaydi", async () => {
    const cert = await makeCert();
    await Service.approveMany([cert._id], RECTOR, "http://x.uz");
    mockSavePdf.mockClear();

    const res = await Service.approveMany([cert._id], RECTOR, "http://x.uz");

    expect(res.approved).toEqual([String(cert._id)]);
    expect(res.failed).toEqual([]);
    expect(mockSavePdf).not.toHaveBeenCalled();
  });

  it("bittasi yo'q bo'lsa qolganlari baribir tasdiqlanadi", async () => {
    const ok = await makeCert();
    const gone = oid();

    const res = await Service.approveMany([gone, ok._id], RECTOR, "http://x.uz");

    expect(res.approved).toEqual([String(ok._id)]);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].id).toBe(String(gone));
    const fresh = await QualEarnedCertificate.findById(ok._id).lean();
    expect(fresh.status).toBe(STATUS.APPROVED);
  });

  it("PDF qurilmasa ham TASDIQ kuchda qoladi (keyin qayta qurish mumkin)", async () => {
    const cert = await makeCert();
    mockSavePdf.mockRejectedValueOnce(new Error("disk to'lgan"));

    const res = await Service.approveMany([cert._id], RECTOR, "http://x.uz");

    expect(res.approved).toEqual([]);
    expect(res.failed[0].message).toBe("disk to'lgan");
    const fresh = await QualEarnedCertificate.findById(cert._id).lean();
    expect(fresh.status).toBe(STATUS.APPROVED);
  });
});

describe("Rad etish", () => {
  it("statusni yozadi, sababni saqlaydi va faylni O'CHIRADI", async () => {
    const cert = await makeCert();
    await Service.approveMany([cert._id], RECTOR, "http://x.uz");
    await QualEarnedCertificate.updateOne(
      { _id: cert._id },
      { $set: { file: "http://x.uz/files/pdfs/MO00001.pdf" } },
    );

    const res = await Service.rejectMany([cert._id], RECTOR, "Ism xato yozilgan");

    expect(res.rejected).toBe(1);
    const fresh = await QualEarnedCertificate.findById(cert._id).lean();
    expect(fresh.status).toBe(STATUS.REJECTED);
    expect(fresh.rejectReason).toBe("Ism xato yozilgan");
    expect(fresh.file).toBeUndefined();
    expect(Service.isReleased(fresh)).toBe(false);
  });

  it("rad etilgan hujjatni keyin tasdiqlash mumkin va sabab tozalanadi", async () => {
    const cert = await makeCert();
    await Service.rejectMany([cert._id], RECTOR, "Ism xato");

    await Service.approveMany([cert._id], RECTOR, "http://x.uz");

    const fresh = await QualEarnedCertificate.findById(cert._id).lean();
    expect(fresh.status).toBe(STATUS.APPROVED);
    expect(fresh.rejectReason).toBeUndefined();
    expect(mockSavePdf).toHaveBeenCalledTimes(1);
  });
});
