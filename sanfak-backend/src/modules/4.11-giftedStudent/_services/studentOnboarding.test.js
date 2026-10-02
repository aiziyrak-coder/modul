"use strict";

const mockSave = jest.fn();
const mockCtorArg = { value: null };

function MockStudentModel(doc) {
  mockCtorArg.value = doc;
  this.save = mockSave;
}
MockStudentModel.findOne = jest.fn();
MockStudentModel.updateOne = jest.fn();

jest.mock(
  "#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model",
  () => MockStudentModel,
);

const mockCheckGroupDirection = jest.fn();
jest.mock("./hierarchyCheck", () => ({
  checkGroupDirection: mockCheckGroupDirection,
}));

const mockProvisionAccount = jest.fn();
const mockDiscardAccount = jest.fn();
jest.mock("./studentAccount", () => ({
  ...jest.requireActual("./studentAccount"),
  provisionAccount: mockProvisionAccount,
  discardAccount: mockDiscardAccount,
}));

const mockFillAccountGaps = jest.fn();
jest.mock("./accountSync", () => ({ fillAccountGaps: mockFillAccountGaps }));

jest.mock("#shared/winston.logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

const { onboardStudent, duplicateQuery } = require("./studentOnboarding");

const PIN = "12345678901234";
const USER_A = "6a5a0acbd34b3c21a575daaa";
const USER_B = "6a5a0acbd34b3c21a575dbbb";
const STUDENT_ID = "6a5a0acbd34b3c21a575d111";

const chain = (value) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.lean = jest.fn(() => Promise.resolve(value));
  return c;
};

const BODY = {
  fullName: "Aliyev Sardor Botir o'g'li",
  jshshir: PIN,
  faculty: "Farmatsiya fakulteti",
};

const account = (over = {}) => ({
  userId: USER_A,
  status: "created",
  createdHere: true,
  warnings: [],
  ...over,
});

beforeEach(() => {
  mockFillAccountGaps.mockResolvedValue({
    status: "unchanged",
    filled: [],
    conflicts: [],
    warnings: [],
  });
  jest.clearAllMocks();
  mockCtorArg.value = null;
  mockCheckGroupDirection.mockResolvedValue(null);
  MockStudentModel.findOne.mockReturnValue(chain(null));
  MockStudentModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
  mockSave.mockResolvedValue({ _id: STUDENT_ID });
  mockProvisionAccount.mockResolvedValue(account());
});

describe("dublikat izlash sharti", () => {
  it("uchala kalit ham — modeldagi uchta partial-unique indeks bilan bir xil", () => {
    expect(
      duplicateQuery({
        userId: USER_A,
        jshshir: PIN,
        passportSeria: "AA",
        passportNumber: "1234567",
      }),
    ).toEqual({
      $or: [
        { user: USER_A },
        { jshshir: PIN },
        { passportSeria: "AA", passportNumber: "1234567" },
      ],
    });
  });

  it("pasportning bir qismi yetishmasa — juftlik shartga kirmaydi", () => {
    expect(duplicateQuery({ jshshir: PIN, passportSeria: "AA" })).toEqual({
      $or: [{ jshshir: PIN }],
    });
  });

  it("hech qanday kalit yo'q -> null (butun ro'yxatni skanerlash YO'Q)", () => {
    expect(duplicateQuery({})).toBeNull();
  });
});

describe("1. akkaunt yo'q · talaba yo'q -> ikkalasi YARATILADI", () => {
  it("holatlar", async () => {
    const r = await onboardStudent(BODY);
    expect(r.ok).toBe(true);
    expect(r.account).toMatchObject({ status: "created", userId: USER_A });
    expect(r.student).toMatchObject({ status: "created", id: STUDENT_ID });
  });

  it("talaba yozuviga akkaunt bog'lanadi", async () => {
    await onboardStudent(BODY);
    expect(mockCtorArg.value.user).toBe(USER_A);
  });

  it("`fullName` normallashtirilgan holda yoziladi", async () => {
    await onboardStudent({ ...BODY, lastName: "Aliyev", firstName: "Sardor", fullName: "" });
    expect(mockCtorArg.value.fullName).toBe("Aliyev Sardor");
  });
});

describe("2. akkaunt BOR · talaba yo'q", () => {
  it("existing + created, yangi akkaunt ochilmaydi", async () => {
    mockProvisionAccount.mockResolvedValue(
      account({ status: "existing", createdHere: false }),
    );

    const r = await onboardStudent(BODY);
    expect(r.account.status).toBe("existing");
    expect(r.student.status).toBe("created");
    expect(mockDiscardAccount).not.toHaveBeenCalled();
  });
});

describe("3. talaba BOR, lekin BOG'LANMAGAN -> LINKED", () => {
  beforeEach(() => {
    MockStudentModel.findOne.mockReturnValue(chain({ _id: STUDENT_ID, user: null }));
  });

  it("faqat `user` maydoni yoziladi — boshqa hech narsa emas", async () => {
    const r = await onboardStudent(BODY);

    expect(r.student).toMatchObject({ status: "linked", id: STUDENT_ID });
    expect(MockStudentModel.updateOne).toHaveBeenCalledWith(
      { _id: STUDENT_ID },
      { $set: { user: USER_A } },
    );
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("akkaunt ham skipped bo'lsa — bog'lanmaydi, yozuv EXISTING qoladi", async () => {
    mockProvisionAccount.mockResolvedValue(
      account({ status: "skipped", userId: null, createdHere: false }),
    );

    const r = await onboardStudent(BODY);
    expect(r.student.status).toBe("existing");
    expect(MockStudentModel.updateOne).not.toHaveBeenCalled();
  });
});

describe("4. ikkalasi ham BOR va bir-biriga bog'langan", () => {
  it("existing + existing, hech narsa yozilmaydi", async () => {
    MockStudentModel.findOne.mockReturnValue(chain({ _id: STUDENT_ID, user: USER_A }));
    mockProvisionAccount.mockResolvedValue(
      account({ status: "existing", createdHere: false }),
    );

    const r = await onboardStudent(BODY);
    expect(r.account.status).toBe("existing");
    expect(r.student.status).toBe("existing");
    expect(mockSave).not.toHaveBeenCalled();
    expect(MockStudentModel.updateOne).not.toHaveBeenCalled();
    expect(mockDiscardAccount).not.toHaveBeenCalled();
  });
});

describe("5. talaba BOSHQA akkauntga bog'langan -> yangi akkaunt QAYTARIB OLINADI", () => {
  beforeEach(() => {
    MockStudentModel.findOne.mockReturnValue(chain({ _id: STUDENT_ID, user: USER_B }));
  });

  it("shu so'rovda ochilgan akkaunt o'chiriladi", async () => {
    const r = await onboardStudent(BODY);

    expect(mockDiscardAccount).toHaveBeenCalledWith(USER_A);
    expect(r.student.status).toBe("existing");
    expect(r.account).toMatchObject({ status: "skipped", userId: null });
    expect(r.warnings.some((w) => /BOSHQA platforma akkauntiga/.test(w))).toBe(true);
  });

  it("akkaunt mavjud bo'lgan (biz ochmagan) bo'lsa — o'chirilmaydi", async () => {
    mockProvisionAccount.mockResolvedValue(
      account({ status: "existing", createdHere: false }),
    );

    await onboardStudent(BODY);
    expect(mockDiscardAccount).not.toHaveBeenCalled();
  });
});

describe("6. talaba yozuvi yiqildi -> kompensatsiya va xato yuqoriga uzatiladi", () => {
  it("akkaunt o'chiriladi, xato yutilmaydi", async () => {
    const err = new Error("E11000 duplicate key");
    err.code = 11000;
    mockSave.mockRejectedValue(err);

    await expect(onboardStudent(BODY)).rejects.toThrow("E11000");
    expect(mockDiscardAccount).toHaveBeenCalledWith(USER_A);
  });

  it("akkaunt mavjud bo'lgan bo'lsa — o'chirilmaydi", async () => {
    mockProvisionAccount.mockResolvedValue(
      account({ status: "existing", createdHere: false }),
    );
    mockSave.mockRejectedValue(new Error("boom"));

    await expect(onboardStudent(BODY)).rejects.toThrow("boom");
    expect(mockDiscardAccount).not.toHaveBeenCalled();
  });
});

describe("yozishdan OLDINGI to'siqlar", () => {
  it("guruh↔yo'nalish ziddiyati -> hech narsa yozilmaydi", async () => {
    mockCheckGroupDirection.mockResolvedValue({ message: "Guruh mos emas" });

    const r = await onboardStudent(BODY);
    expect(r).toMatchObject({ ok: false, errors: ["Guruh mos emas"] });
    expect(mockProvisionAccount).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("F.I.SH bo'sh -> rad etiladi", async () => {
    const r = await onboardStudent({ jshshir: PIN });
    expect(r.ok).toBe(false);
    expect(mockProvisionAccount).not.toHaveBeenCalled();
  });
});

describe("mijoz `user` ni ANIQ bergan bo'lsa (eski piker yo'li)", () => {
  it("akkaunt ta'minlanmaydi, berilgani hurmat qilinadi", async () => {
    const r = await onboardStudent({ ...BODY, user: USER_B });

    expect(mockProvisionAccount).not.toHaveBeenCalled();
    expect(r.account).toMatchObject({ status: "skipped", userId: USER_B });
    expect(mockCtorArg.value.user).toBe(USER_B);
  });
});

describe("ogohlantirishlar yuqoriga chiqadi", () => {
  it("akkaunt ta'minlashdagi ogohlantirish javobda qoladi", async () => {
    mockProvisionAccount.mockResolvedValue(
      account({ status: "skipped", userId: null, createdHere: false, warnings: ["PIN yo'q"] }),
    );

    const r = await onboardStudent(BODY);
    expect(r.warnings).toContain("PIN yo'q");
    expect(r.student.status).toBe("created");
  });

  it("F.I.SH taxminan bo'lingani ogohlantiriladi", async () => {
    const r = await onboardStudent(BODY);
    expect(r.warnings.some((w) => /avtomatik bo'lindi/.test(w))).toBe(true);
  });

  it("aniq qismlar berilsa ogohlantirish YO'Q", async () => {
    const r = await onboardStudent({ ...BODY, lastName: "Aliyev", firstName: "Sardor" });
    expect(r.warnings.some((w) => /avtomatik bo'lindi/.test(w))).toBe(false);
  });
});

describe("6. mavjud akkaunt · bo'shni to'ldirish", () => {
  beforeEach(() => {
    mockProvisionAccount.mockResolvedValue({
      userId: USER_A,
      status: "existing",
      createdHere: false,
      warnings: [],
    });
    MockStudentModel.findOne.mockReturnValue(chain(null));
    mockSave.mockResolvedValue({ _id: STUDENT_ID });
  });

  it("`existing` bo'lsa to'ldirish CHAQIRILADI — ism qismlari va aloqa bilan", async () => {
    await onboardStudent({
      fullName: "Aliyev Sardor Botir o'g'li",
      jshshir: PIN,
      email: "s@fjsti.uz",
      phone: "+998901112233",
      passportSeria: "AA",
      passportNumber: "1234567",
    });

    expect(mockFillAccountGaps).toHaveBeenCalledTimes(1);
    const [userId, incoming] = mockFillAccountGaps.mock.calls[0];
    expect(userId).toBe(USER_A);
    expect(incoming).toEqual({
      lastName: "Aliyev",
      firstName: "Sardor",
      middleName: "Botir o'g'li",
      email: "s@fjsti.uz",
      phone: "+998901112233",
      passportSeria: "AA",
      passportNumber: "1234567",
    });
  });

  it("akkaunt YANGI yaratilgan bo'lsa to'ldirish chaqirilmaydi", async () => {
    mockProvisionAccount.mockResolvedValue({
      userId: USER_A,
      status: "created",
      createdHere: true,
      warnings: [],
    });

    await onboardStudent({ fullName: "Aliyev Sardor", jshshir: PIN });

    expect(mockFillAccountGaps).not.toHaveBeenCalled();
  });

  it("dryRun to'ldirishga ham uzatiladi", async () => {
    await onboardStudent(
      { fullName: "Aliyev Sardor", jshshir: PIN },
      { dryRun: true },
    );

    expect(mockFillAccountGaps.mock.calls[0][2]).toEqual({ dryRun: true });
  });

  it("ziddiyat ogohlantirishi javobga chiqadi", async () => {
    mockFillAccountGaps.mockResolvedValue({
      status: "unchanged",
      filled: [],
      conflicts: [{ field: "email", account: "a@x.uz", incoming: "b@x.uz" }],
      warnings: ["Email: akkauntda \"a@x.uz\", ro'yxatda \"b@x.uz\" — akkaunt TEGILMADI"],
    });

    const out = await onboardStudent({
      fullName: "Aliyev Sardor",
      jshshir: PIN,
    });

    expect(out.warnings.join(" ")).toMatch(/akkaunt TEGILMADI/);
    expect(out.account.gaps.conflicts).toHaveLength(1);
  });

  it("mijoz `user` ni ANIQ bergan bo'lsa — akkauntga umuman tegilmaydi", async () => {
    await onboardStudent({
      user: USER_B,
      fullName: "Aliyev Sardor",
      jshshir: PIN,
    });

    expect(mockProvisionAccount).not.toHaveBeenCalled();
    expect(mockFillAccountGaps).not.toHaveBeenCalled();
  });
});

describe("shaxs kalitlari — probe va insert AYNI satrni ko'radi", () => {
  it("bo'shliqlar kesib YOZILADI (probe bilan bir xil)", async () => {
    await onboardStudent({
      fullName: "Aliyev Sardor",
      jshshir: `  ${PIN}  `,
      passportSeria: " AA ",
      passportNumber: " 1234567 ",
    });

    const probe = MockStudentModel.findOne.mock.calls[0][0].$or;
    expect(probe).toContainEqual({ jshshir: PIN });
    expect(mockCtorArg.value.jshshir).toBe(PIN);
    expect(mockCtorArg.value.passportSeria).toBe("AA");
    expect(mockCtorArg.value.passportNumber).toBe("1234567");
  });

  it("akkaunt provisioning ham KESILGAN jshshir oladi (oneIdPin = jshshir)", async () => {
    await onboardStudent({ fullName: "Aliyev Sardor", jshshir: ` ${PIN} ` });

    expect(mockProvisionAccount.mock.calls[0][0].jshshir).toBe(PIN);
  });

  it("faqat bo'shliqdan iborat qiymat `null` bo'ladi, \"\" EMAS", async () => {
    await onboardStudent({
      fullName: "Aliyev Sardor",
      jshshir: PIN,
      passportSeria: "   ",
      passportNumber: "",
    });

    expect(mockCtorArg.value.passportSeria).toBeNull();
    expect(mockCtorArg.value.passportNumber).toBeNull();
  });
});

describe("D-52 — yakka yaratishda ziddiyat", () => {
  const EXISTING = {
    _id: STUDENT_ID,
    user: null,
    fullName: "Aliyev Alisher Baxtiyor o'g'li",
    jshshir: PIN,
    passportSeria: "AA",
    passportNumber: "1234567",
  };

  it("bog'lanmagan mavjud yozuv endi BOG'LANMAYDI, xato qaytadi", async () => {
    MockStudentModel.findOne.mockReturnValue(chain(EXISTING));

    const r = await onboardStudent(BODY, { conflictIsError: true });

    expect(r.ok).toBe(false);
    expect(r.student).toBeNull();
    expect(MockStudentModel.updateOne).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("🔴 shu so'rovda ochilgan akkaunt QAYTARIB OLINADI", async () => {
    MockStudentModel.findOne.mockReturnValue(chain(EXISTING));

    await onboardStudent(BODY, { conflictIsError: true });

    expect(mockDiscardAccount).toHaveBeenCalledWith(USER_A);
  });

  it("xodim TANLAGAN mavjud akkaunt TEGILMAYDI", async () => {
    MockStudentModel.findOne.mockReturnValue(chain(EXISTING));
    mockProvisionAccount.mockResolvedValue(
      account({ status: "existing", createdHere: false }),
    );

    const r = await onboardStudent(BODY, { conflictIsError: true });

    expect(r.ok).toBe(false);
    expect(mockDiscardAccount).not.toHaveBeenCalled();
  });

  it("xabar QAYSI maydon takrorlanganini va KIMNIKI ekanini aytadi — JSHSHIR", async () => {
    MockStudentModel.findOne.mockReturnValue(chain(EXISTING));

    const r = await onboardStudent(BODY, { conflictIsError: true });

    expect(r.errors[0]).toContain("JSHSHIR");
    expect(r.errors[0]).toContain("Aliyev Alisher Baxtiyor o'g'li");
  });

  it("xabar pasport ziddiyatini JSHSHIR dan AJRATADI", async () => {
    MockStudentModel.findOne.mockReturnValue(
      chain({ ...EXISTING, jshshir: "99999999999999" }),
    );

    const r = await onboardStudent(
      { ...BODY, passportSeria: "AA", passportNumber: "1234567" },
      { conflictIsError: true },
    );

    expect(r.errors[0]).toContain("pasport");
    expect(r.errors[0]).not.toContain("JSHSHIR");
  });

  it("nomsiz yozuv ham xabar beradi (bo'sh satr o'rniga o'qiladigan matn)", async () => {
    MockStudentModel.findOne.mockReturnValue(chain({ ...EXISTING, fullName: "" }));

    const r = await onboardStudent(BODY, { conflictIsError: true });

    expect(r.errors[0]).toContain("nomsiz yozuv");
  });

  it("🔴 IMPORT yo'li (bayroqsiz) O'ZGARMAGAN — hamon `linked` qaytaradi", async () => {
    MockStudentModel.findOne.mockReturnValue(chain(EXISTING));

    const r = await onboardStudent(BODY);

    expect(r.ok).toBe(true);
    expect(r.student.status).toBe("linked");
    expect(MockStudentModel.updateOne).toHaveBeenCalled();
    expect(mockDiscardAccount).not.toHaveBeenCalled();
  });

  it("ziddiyat YO'Q bo'lsa bayroq hech narsani o'zgartirmaydi", async () => {
    const r = await onboardStudent(BODY, { conflictIsError: true });

    expect(r.ok).toBe(true);
    expect(r.student.status).toBe("created");
  });
});
