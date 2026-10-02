const { approveTeacherLeaveSchema, createTeacherLeaveSchema } = require("./teacherLeave.validation");

const TEMP_ERI_SIGNATURE = "TEMP_ERI_PLACEHOLDER";

describe("teacherLeave.validation — approveTeacherLeaveSchema", () => {
  test("frontend'ning haqiqiy payload'i (signature + comment) qabul qilinadi", () => {
    const { error } = approveTeacherLeaveSchema.validate({
      signature: TEMP_ERI_SIGNATURE,
      comment: "Roziman",
    });
    expect(error).toBeUndefined();
  });

  test("faqat signature (comment yo'q) — qabul qilinadi", () => {
    const { error } = approveTeacherLeaveSchema.validate({
      signature: TEMP_ERI_SIGNATURE,
    });
    expect(error).toBeUndefined();
  });

  test("bo'sh body — qabul qilinadi (hammasi ixtiyoriy)", () => {
    const { error } = approveTeacherLeaveSchema.validate({});
    expect(error).toBeUndefined();
  });

  test("D-122: distribution (ObjectId) — tasdiqlovchi 409 javobidan keyin qayta yuborishi mumkin", () => {
    const { error, value } = approveTeacherLeaveSchema.validate({
      signature: TEMP_ERI_SIGNATURE,
      distribution: "64b2f0c2a1b2c3d4e5f60718",
    });
    expect(error).toBeUndefined();
    expect(value.distribution).toBe("64b2f0c2a1b2c3d4e5f60718");
  });

  test("distribution bo'sh string — null'ga aylanadi (xato bermaydi)", () => {
    const { error, value } = approveTeacherLeaveSchema.validate({
      distribution: "",
    });
    expect(error).toBeUndefined();
    expect(value.distribution).toBeNull();
  });

  test("noma'lum qo'shimcha maydon — rad etiladi (strict, lekin haqiqiy frontend maydonlari qamrab olingan)", () => {
    const { error } = approveTeacherLeaveSchema.validate({
      unexpectedField: "x",
    });
    expect(error).toBeDefined();
  });
});

describe("teacherLeave.validation — createTeacherLeaveSchema (P-32)", () => {
  const FROM = "2026-10-01T00:00:00.000Z";
  const TO = "2026-10-14T00:00:00.000Z";
  const validate = (body) => createTeacherLeaveSchema.validate(body, { abortEarly: false });

  test("faqat type (Enter bilan yuborilgan bo'sh forma) → RAD: sabab + boshlanish sanasi", () => {
    const { error } = validate({ type: "leave" });
    expect(error).toBeDefined();
    const msgs = error.details.map((d) => d.message);
    expect(msgs).toEqual(expect.arrayContaining(["Sabab majburiy", "Boshlanish sanasi majburiy"]));
  });

  test("leave: to'liq payload (FE toISOString) → qabul, sanalar Date'ga aylanadi", () => {
    const { error, value } = validate({ type: "leave", reason: "Mehnat ta'tili", fromDate: FROM, toDate: TO });
    expect(error).toBeUndefined();
    expect(value.fromDate).toBeInstanceOf(Date);
    expect(value.toDate).toBeInstanceOf(Date);
  });

  test("leave: toDate yo'q → RAD (ta'til uchun majburiy)", () => {
    const { error } = validate({ type: "leave", reason: "Mehnat ta'tili", fromDate: FROM });
    expect(error.details.map((d) => d.message)).toContain("Ta'til uchun tugash sanasi majburiy");
  });

  test("leave: toDate < fromDate → RAD", () => {
    const { error } = validate({ type: "leave", reason: "Mehnat ta'tili", fromDate: TO, toDate: FROM });
    expect(error.details.map((d) => d.message)).toContain(
      "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas",
    );
  });

  test("resignation / transfer: toDate ixtiyoriy, fromDate + reason majburiy", () => {
    expect(validate({ type: "resignation", reason: "Boshqa ishga o'tish", fromDate: FROM }).error).toBeUndefined();
    expect(validate({ type: "transfer", reason: "Kafedra almashish", fromDate: FROM, toDate: null }).error).toBeUndefined();
    expect(validate({ type: "resignation", fromDate: FROM }).error).toBeDefined();
    expect(validate({ type: "transfer", reason: "Kafedra almashish" }).error).toBeDefined();
  });

  test("reason bo'sh / juda qisqa → RAD", () => {
    expect(validate({ type: "leave", reason: "", fromDate: FROM, toDate: TO }).error.details.map((d) => d.message)).toContain("Sabab majburiy");
    expect(validate({ type: "leave", reason: "ab", fromDate: FROM, toDate: TO }).error.details.map((d) => d.message)).toContain(
      "Sabab kamida 3 ta belgi bo'lishi kerak",
    );
  });

  test("noto'g'ri sana formati → RAD", () => {
    const { error } = validate({ type: "leave", reason: "Mehnat ta'tili", fromDate: "01.10.2026", toDate: TO });
    expect(error).toBeDefined();
  });

  test("ixtiyoriy ref maydonlar (teacher, distribution, teacherEntryId) avvalgidek qabul", () => {
    const { error } = validate({
      type: "leave", reason: "Mehnat ta'tili", fromDate: FROM, toDate: TO,
      teacher: "6a7da70157df92f4847a95a5", distribution: "", teacherEntryId: null,
    });
    expect(error).toBeUndefined();
  });
});
