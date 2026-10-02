const QualEarnedCertificate = require("#modules/4.04-qualification/_shared/qualEarnedCertificate.model");
const QualCourse = require("#modules/4.04-qualification/qualCourse/qualCourse.model");
const QualListener = require("#modules/4.04-qualification/_shared/qualListener.model");
const QualCourseType = require("#modules/4.04-qualification/qualCourseType/qualCourseType.model");
const {
  verifyCertificateByCode,
} = require("#modules/4.04-qualification/_verify/certificateVerify.service");

const STATUS = { PENDING: 1, APPROVED: 2, REJECTED: 3 };

let course;
let listener;

const CODE = "I77701";

beforeEach(async () => {
  const courseType = await QualCourseType.create({
    title: "Malaka oshirish (72 soat)",
    kind: 1,
    template: 1,
  });
  course = await QualCourse.create({
    title: "Test kursi",
    courseType: courseType._id,
    creditHours: 72,
    form: 1,
    price: 1000000,
    listenersLimit: 30,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-02-01"),
  });
  listener = await QualListener.create({
    fullName: "Testov Test",
    passport: "AA1234567",
  });
});

const makeCert = (over = {}) =>
  QualEarnedCertificate.create({
    course: course._id,
    listener: listener._id,
    kind: 1,
    template: 1,
    number: "77701",
    regNumber: "777001",
    ...over,
  });

describe("QR tekshiruvi — hujjat holati", () => {
  it("TASDIQLANGAN hujjat haqiqiy deb topiladi", async () => {
    await makeCert({ status: STATUS.APPROVED });

    const res = await verifyCertificateByCode(CODE);

    expect(res).not.toBeNull();
    expect(res.code).toBe(CODE);
    expect(res.fullName).toBe("Testov Test");
  });

  it("TASDIQ KUTAYOTGAN hujjat topilmaydi (404 bo'ladi)", async () => {
    await makeCert({ status: STATUS.PENDING });

    expect(await verifyCertificateByCode(CODE)).toBeNull();
  });

  it("RAD ETILGAN hujjat topilmaydi — bosma nusxa ham tasdiqlanmaydi", async () => {
    await makeCert({ status: STATUS.REJECTED, rejectReason: "Ism xato" });

    expect(await verifyCertificateByCode(CODE)).toBeNull();
  });

  it("ESKI yozuv (`status` maydonisiz) haqiqiy deb qoladi", async () => {
    const cert = await makeCert({ status: STATUS.APPROVED });
    await QualEarnedCertificate.updateOne({ _id: cert._id }, { $unset: { status: "" } });

    const res = await verifyCertificateByCode(CODE);

    expect(res).not.toBeNull();
    expect(res.code).toBe(CODE);
  });

  it("tasdiqlangandan rad etilganga o'tsa, tekshiruv DARHOL to'xtaydi", async () => {
    const cert = await makeCert({ status: STATUS.APPROVED });
    expect(await verifyCertificateByCode(CODE)).not.toBeNull();

    await QualEarnedCertificate.updateOne(
      { _id: cert._id },
      { $set: { status: STATUS.REJECTED } },
    );

    expect(await verifyCertificateByCode(CODE)).toBeNull();
  });
});
