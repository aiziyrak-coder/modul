"use strict";

const mockSave = jest.fn();
const mockCtorArg = { value: null };

function MockResidentModel(doc) {
  mockCtorArg.value = doc;
  this.save = mockSave;
}
MockResidentModel.findOne = jest.fn();
MockResidentModel.updateOne = jest.fn();

jest.mock(
  "#modules/4.05-residency/resident/resident.model",
  () => MockResidentModel,
);

const mockProvisionAccount = jest.fn();
const mockDiscardAccount = jest.fn();
jest.mock("./residentAccount", () => ({
  ...jest.requireActual("./residentAccount"),
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

const { onboardResident, duplicateQuery } = require("./residentOnboarding");

const PIN = "12345678901234";
const USER_A = "6a5a0acbd34b3c21a575daaa";
const USER_B = "6a5a0acbd34b3c21a575dbbb";
const RESIDENT_ID = "6a5a0acbd34b3c21a575d111";

const chain = (value) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.lean = jest.fn(() => Promise.resolve(value));
  return c;
};

const BODY = {
  fullName: "Aliyev Sardor Botir o'g'li",
  program: "ordinatura",
  jshshir: PIN,
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
  MockResidentModel.findOne.mockReturnValue(chain(null));
  MockResidentModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
  mockSave.mockResolvedValue({ _id: RESIDENT_ID });
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

describe("1. akkaunt yo'q · yozuv yo'q -> ikkalasi YARATILADI", () => {
  it("holatlar va bog'lanish", async () => {
    const r = await onboardResident(BODY);

    expect(r.ok).toBe(true);
    expect(r.account).toMatchObject({ status: "created", userId: USER_A });
    expect(r.resident).toMatchObject({ status: "created", id: RESIDENT_ID });
    expect(mockCtorArg.value.user).toBe(USER_A);
  });

  it("dastur akkaunt ta'minlashga UZATILADI (rolni u belgilaydi)", async () => {
    await onboardResident({ ...BODY, program: "magistratura" });
    expect(mockProvisionAccount.mock.calls[0][0].program).toBe("magistratura");
  });
});

describe("2. akkaunt BOR · yozuv yo'q", () => {
  it("existing + created, yangi akkaunt ochilmaydi", async () => {
    mockProvisionAccount.mockResolvedValue(account({ status: "existing", createdHere: false }));

    const r = await onboardResident(BODY);
    expect(r.account.status).toBe("existing");
    expect(r.resident.status).toBe("created");
    expect(mockDiscardAccount).not.toHaveBeenCalled();
  });
});

describe("3. yozuv BOR, lekin BOG'LANMAGAN -> LINKED", () => {
  beforeEach(() => {
    MockResidentModel.findOne.mockReturnValue(chain({ _id: RESIDENT_ID, user: null }));
  });

  it("faqat `user` maydoni yoziladi — boshqa hech narsa emas", async () => {
    const r = await onboardResident(BODY);

    expect(r.resident).toMatchObject({ status: "linked", id: RESIDENT_ID });
    expect(MockResidentModel.updateOne).toHaveBeenCalledWith(
      { _id: RESIDENT_ID },
      { $set: { user: USER_A } },
    );
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("akkaunt skipped bo'lsa — bog'lanmaydi, yozuv EXISTING qoladi", async () => {
    mockProvisionAccount.mockResolvedValue(
      account({ status: "skipped", userId: null, createdHere: false }),
    );

    const r = await onboardResident(BODY);
    expect(r.resident.status).toBe("existing");
    expect(MockResidentModel.updateOne).not.toHaveBeenCalled();
  });
});

describe("4. ikkalasi ham BOR va bir-biriga bog'langan", () => {
  it("existing + existing, hech narsa yozilmaydi", async () => {
    MockResidentModel.findOne.mockReturnValue(chain({ _id: RESIDENT_ID, user: USER_A }));
    mockProvisionAccount.mockResolvedValue(account({ status: "existing", createdHere: false }));

    const r = await onboardResident(BODY);
    expect(r.resident.status).toBe("existing");
    expect(mockSave).not.toHaveBeenCalled();
    expect(MockResidentModel.updateOne).not.toHaveBeenCalled();
    expect(mockDiscardAccount).not.toHaveBeenCalled();
  });
});

describe("5. yozuv BOSHQA akkauntga bog'langan -> yangi akkaunt QAYTARIB OLINADI", () => {
  beforeEach(() => {
    MockResidentModel.findOne.mockReturnValue(chain({ _id: RESIDENT_ID, user: USER_B }));
  });

  it("shu so'rovda ochilgan akkaunt o'chiriladi", async () => {
    const r = await onboardResident(BODY);

    expect(mockDiscardAccount).toHaveBeenCalledWith(USER_A);
    expect(r.resident.status).toBe("existing");
    expect(r.account).toMatchObject({ status: "skipped", userId: null });
  });

  it("akkaunt mavjud bo'lgan (biz ochmagan) bo'lsa — o'chirilmaydi", async () => {
    mockProvisionAccount.mockResolvedValue(account({ status: "existing", createdHere: false }));

    await onboardResident(BODY);
    expect(mockDiscardAccount).not.toHaveBeenCalled();
  });
});

describe("6. yozuv yiqildi -> kompensatsiya va xato yuqoriga uzatiladi", () => {
  it("akkaunt o'chiriladi, xato yutilmaydi", async () => {
    const err = new Error("E11000 duplicate key");
    err.code = 11000;
    mockSave.mockRejectedValue(err);

    await expect(onboardResident(BODY)).rejects.toThrow("E11000");
    expect(mockDiscardAccount).toHaveBeenCalledWith(USER_A);
  });
});

describe("yozishdan OLDINGI to'siqlar", () => {
  it("F.I.SH bo'sh -> rad etiladi", async () => {
    const r = await onboardResident({ program: "ordinatura", jshshir: PIN });
    expect(r.ok).toBe(false);
    expect(mockProvisionAccount).not.toHaveBeenCalled();
  });

  it("dastur yo'q -> rad etiladi", async () => {
    const r = await onboardResident({ fullName: "Aliyev Sardor", jshshir: PIN });
    expect(r).toMatchObject({ ok: false });
    expect(r.errors[0]).toMatch(/Ta'lim yo'nalishi/);
    expect(mockProvisionAccount).not.toHaveBeenCalled();
  });
});

describe("mijoz `user` ni ANIQ bergan bo'lsa (eski piker yo'li)", () => {
  it("akkaunt ta'minlanmaydi, berilgani hurmat qilinadi", async () => {
    const r = await onboardResident({ ...BODY, user: USER_B });

    expect(mockProvisionAccount).not.toHaveBeenCalled();
    expect(r.account).toMatchObject({ status: "skipped", userId: USER_B });
    expect(mockCtorArg.value.user).toBe(USER_B);
  });
});

describe("dryRun", () => {
  it("hech narsa yozilmaydi", async () => {
    const r = await onboardResident(BODY, { dryRun: true });

    expect(mockSave).not.toHaveBeenCalled();
    expect(MockResidentModel.updateOne).not.toHaveBeenCalled();
    expect(r.resident).toMatchObject({ status: "created", id: null });
    expect(mockProvisionAccount.mock.calls[0][0].dryRun).toBe(true);
  });

  it("bog'lanmagan yozuv dryRun'da ham `linked` deb ko'rsatiladi", async () => {
    MockResidentModel.findOne.mockReturnValue(chain({ _id: RESIDENT_ID, user: null }));
    mockProvisionAccount.mockResolvedValue(
      account({ status: "created", userId: null, createdHere: false }),
    );

    const r = await onboardResident(BODY, { dryRun: true });
    expect(r.resident.status).toBe("linked");
    expect(MockResidentModel.updateOne).not.toHaveBeenCalled();
  });
});

describe("ogohlantirishlar yuqoriga chiqadi", () => {
  it("akkaunt ta'minlashdagi ogohlantirish javobda qoladi", async () => {
    mockProvisionAccount.mockResolvedValue(
      account({ status: "skipped", userId: null, createdHere: false, warnings: ["PIN yo'q"] }),
    );

    const r = await onboardResident(BODY);
    expect(r.warnings).toContain("PIN yo'q");
    expect(r.resident.status).toBe("created");
  });

  it("F.I.SH taxminan bo'lingani ogohlantiriladi", async () => {
    const r = await onboardResident(BODY);
    expect(r.warnings.some((w) => /avtomatik bo'lindi/.test(w))).toBe(true);
  });

  it("aniq qismlar berilsa ogohlantirish YO'Q", async () => {
    const r = await onboardResident({ ...BODY, lastName: "Aliyev", firstName: "Sardor" });
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
    MockResidentModel.findOne.mockReturnValue(chain(null));
    mockSave.mockResolvedValue({ _id: RESIDENT_ID });
  });

  it("`existing` bo'lsa to'ldirish CHAQIRILADI — ism qismlari va aloqa bilan", async () => {
    await onboardResident({
      fullName: "Aliyev Sardor Botir o'g'li",
      program: "magistratura",
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

    await onboardResident({ fullName: "Aliyev Sardor", program: "magistratura", jshshir: PIN });

    expect(mockFillAccountGaps).not.toHaveBeenCalled();
  });

  it("dryRun to'ldirishga ham uzatiladi", async () => {
    await onboardResident(
      { fullName: "Aliyev Sardor", program: "magistratura", jshshir: PIN },
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

    const out = await onboardResident({
      fullName: "Aliyev Sardor",
      program: "magistratura",
      jshshir: PIN,
    });

    expect(out.warnings.join(" ")).toMatch(/akkaunt TEGILMADI/);
    expect(out.account.gaps.conflicts).toHaveLength(1);
  });

  it("mijoz `user` ni ANIQ bergan bo'lsa — akkauntga umuman tegilmaydi", async () => {
    await onboardResident({
      user: USER_B,
      fullName: "Aliyev Sardor",
      program: "magistratura",
      jshshir: PIN,
    });

    expect(mockProvisionAccount).not.toHaveBeenCalled();
    expect(mockFillAccountGaps).not.toHaveBeenCalled();
  });
});
