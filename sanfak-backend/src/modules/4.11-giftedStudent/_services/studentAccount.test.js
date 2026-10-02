"use strict";

const mockUser = {
  findOne: jest.fn(),
  create: jest.fn(),
  findByIdAndDelete: jest.fn(),
};
const mockRole = { findOne: jest.fn(), find: jest.fn() };

jest.mock("mongoose", () => ({
  model: (name) => (name === "user" ? mockUser : mockRole),
}));

jest.mock("#shared/winston.logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

const {
  splitFullName,
  composeFullName,
  resolveNameParts,
  contactFields,
  provisionAccount,
  discardAccount,
} = require("./studentAccount");

const chain = (value) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.populate = jest.fn(() => c);
  c.lean = jest.fn(() => Promise.resolve(value));
  return c;
};

const PIN = "12345678901234";
const ROLE_ID = "6a5a0acbd34b3c21a575d111";
const USER_ID = "6a5a0acbd34b3c21a575d222";

const TALABA_ROLE = {
  title: "talaba",
  permissions: [
    { section: "studentAchievement", actionKeys: ["create", "read", "readAll"] },
    { section: "giftedStudent", actionKeys: ["read"] },
  ],
};

const BOLIM_ROLE = {
  title: "iqtidorli_bolim",
  permissions: [
    { section: "studentAchievement", actionKeys: ["create"] },
    { section: "giftedStudent", actionKeys: ["create", "readAll"] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRole.findOne.mockReturnValue(chain({ _id: ROLE_ID }));
  mockRole.find.mockReturnValue(chain([]));
});

describe("splitFullName — o'zbek rasmiy tartibi", () => {
  it("familiya · ism · otasining ismi", () => {
    expect(splitFullName("Aliyev Sardor Botir o'g'li")).toEqual({
      lastName: "Aliyev",
      firstName: "Sardor",
      middleName: "Botir o'g'li",
    });
  });

  it("ikki so'z — otasining ismi bo'sh", () => {
    expect(splitFullName("Karimova Nilufar")).toEqual({
      lastName: "Karimova",
      firstName: "Nilufar",
      middleName: "",
    });
  });

  it("bitta so'z — ism aniqlanmaydi (akkaunt ochilmaydi)", () => {
    expect(splitFullName("Aliyev")).toEqual({
      lastName: "Aliyev",
      firstName: "",
      middleName: "",
    });
  });

  it.each(["", "   ", null, undefined])("bo'sh kirish (%p)", (v) => {
    expect(splitFullName(v)).toEqual({ lastName: "", firstName: "", middleName: "" });
  });

  it("ortiqcha bo'shliqlar yutiladi", () => {
    expect(splitFullName("  Aliyev   Sardor  ").firstName).toBe("Sardor");
  });
});

describe("composeFullName", () => {
  it("bo'sh qismlar tashlab ketiladi", () => {
    expect(composeFullName({ lastName: "Aliyev", firstName: "Sardor", middleName: "" }))
      .toBe("Aliyev Sardor");
  });
});

describe("resolveNameParts", () => {
  it("aniq qismlar berilsa — TAXMIN QILINMAYDI", () => {
    const r = resolveNameParts({ lastName: "Aliyev", firstName: "Sardor" });
    expect(r.guessed).toBe(false);
    expect(r.fullName).toBe("Aliyev Sardor");
  });

  it("aniq qismlar bo'lsa, berilgan `fullName` saqlanadi", () => {
    const r = resolveNameParts({
      lastName: "Aliyev",
      firstName: "Sardor",
      fullName: "Aliyev Sardor Botir o'g'li",
    });
    expect(r.fullName).toBe("Aliyev Sardor Botir o'g'li");
  });

  it("faqat `fullName` — bo'linadi va `guessed` belgilanadi", () => {
    const r = resolveNameParts({ fullName: "Aliyev Sardor Botir o'g'li" });
    expect(r).toMatchObject({ lastName: "Aliyev", firstName: "Sardor", guessed: true });
  });

  it("faqat `lastName` berilsa ham taxminga tushadi", () => {
    expect(resolveNameParts({ lastName: "Aliyev", fullName: "X Y" }).guessed).toBe(true);
  });
});

describe("contactFields — user validatsiyasi giftedStudent'nikidan QATTIQROQ", () => {
  it("to'g'ri qiymatlar o'tadi", () => {
    const w = [];
    expect(contactFields(
      { email: "a@b.uz", phone: "+998901234567", passportSeria: "AA", passportNumber: "1234567" },
      w,
    )).toEqual({
      email: "a@b.uz",
      phone: "+998901234567",
      passportSeria: "AA",
      passportNumber: "1234567",
    });
    expect(w).toHaveLength(0);
  });

  it("7 raqamdan farqli pasport — MAYDON tashlanadi, ogohlantirish qoladi", () => {
    const w = [];
    const out = contactFields({ passportNumber: "AA123456" }, w);
    expect(out.passportNumber).toBeUndefined();
    expect(w[0]).toMatch(/7 ta raqam emas/);
  });

  it("noto'g'ri email — MAYDON tashlanadi", () => {
    const w = [];
    expect(contactFields({ email: "shunchaki-matn" }, w).email).toBeUndefined();
    expect(w[0]).toMatch(/Email formati/);
  });

  it("bo'sh qiymatlar umuman yozilmaydi (bo'sh-satr tuzog'i)", () => {
    expect(contactFields({ email: "", phone: "   ", passportNumber: "" }, [])).toEqual({});
  });
});

describe("provisionAccount — yaratmaydigan holatlar", () => {
  it.each([
    ["1234567890123", "13 raqam"],
    ["123456789012345", "15 raqam"],
    ["1234567890123A", "harf bor"],
    ["", "bo'sh"],
    [null, "null"],
  ])("PIN %p (%s) -> skipped, DBga umuman bormaydi", async (jshshir) => {
    const r = await provisionAccount({ jshshir, lastName: "A", firstName: "B" });
    expect(r).toMatchObject({ status: "skipped", userId: null, createdHere: false });
    expect(r.warnings[0]).toMatch(/JSHSHIR/);
    expect(mockUser.findOne).not.toHaveBeenCalled();
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ lastName: "Aliyev", firstName: "" }],
    [{ lastName: "", firstName: "Sardor" }],
  ])("ism yoki familiya yo'q (%p) -> skipped", async (names) => {
    const r = await provisionAccount({ jshshir: PIN, ...names });
    expect(r.status).toBe("skipped");
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it("`talaba` roli DBda yo'q va mos rol ham yo'q -> skipped", async () => {
    mockUser.findOne.mockReturnValue(chain(null));
    mockRole.findOne.mockReturnValue(chain(null));

    const r = await provisionAccount({ jshshir: PIN, lastName: "Aliyev", firstName: "Sardor" });
    expect(r.status).toBe("skipped");
    expect(r.warnings[0]).toMatch(/roli/);
    expect(mockUser.create).not.toHaveBeenCalled();
  });
});

describe("rol nomi o'zgargan bo'lsa — ruxsat profili bo'yicha zaxira", () => {
  beforeEach(() => {
    mockUser.findOne.mockReturnValue(chain(null));
    mockUser.create.mockResolvedValue({ _id: USER_ID });
    mockRole.findOne.mockReturnValue(chain(null));
  });

  it("aynan BITTA mos rol -> o'sha ishlatiladi va ogohlantiriladi", async () => {
    mockRole.find.mockReturnValue(
      chain([
        { _id: "role-yangi-nom", ...TALABA_ROLE },
        { _id: "role-bolim", ...BOLIM_ROLE },
      ]),
    );

    const r = await provisionAccount({ jshshir: PIN, lastName: "A", firstName: "B" });

    expect(r.status).toBe("created");
    expect(mockUser.create.mock.calls[0][0].role).toBe("role-yangi-nom");
    expect(r.warnings.some((w) => /ruxsati mos keladigan yagona rol/.test(w))).toBe(true);
  });

  it("bir nechta mos rol -> akkaunt YARATILMAYDI", async () => {
    mockRole.find.mockReturnValue(
      chain([
        { _id: "r1", ...TALABA_ROLE },
        { _id: "r2", ...TALABA_ROLE },
      ]),
    );

    const r = await provisionAccount({ jshshir: PIN, lastName: "A", firstName: "B" });

    expect(r.status).toBe("skipped");
    expect(r.warnings[0]).toMatch(/2 ta rol mos keldi/);
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it("kanonik nom TOPILSA zaxira yo'li umuman ishlamaydi", async () => {
    mockRole.findOne.mockReturnValue(chain({ _id: ROLE_ID }));

    const r = await provisionAccount({ jshshir: PIN, lastName: "A", firstName: "B" });

    expect(mockUser.create.mock.calls[0][0].role).toBe(ROLE_ID);
    expect(mockRole.find).not.toHaveBeenCalled();
    expect(r.warnings).toHaveLength(0);
  });
});

describe("provisionAccount — mavjud akkaunt", () => {
  it("talaba roli -> existing, HECH NARSA yangilanmaydi", async () => {
    mockUser.findOne.mockReturnValue(chain({ _id: USER_ID, role: TALABA_ROLE }));

    const r = await provisionAccount({
      jshshir: PIN,
      lastName: "Aliyev",
      firstName: "Sardor",
      contact: { email: "yangi@b.uz" },
    });

    expect(r).toMatchObject({ status: "existing", userId: USER_ID, createdHere: false });
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it("bo'lim xodimi roli -> skipped, BOG'LANMAYDI", async () => {
    mockUser.findOne.mockReturnValue(chain({ _id: USER_ID, role: BOLIM_ROLE }));

    const r = await provisionAccount({ jshshir: PIN, lastName: "A", firstName: "B" });
    expect(r).toMatchObject({ status: "skipped", userId: null });
    expect(r.warnings[0]).toMatch(/boshqa toifadagi/);
  });

  it("rolsiz akkaunt -> skipped (u baribir kira olmaydi)", async () => {
    mockUser.findOne.mockReturnValue(chain({ _id: USER_ID, role: null }));
    const r = await provisionAccount({ jshshir: PIN, lastName: "A", firstName: "B" });
    expect(r.status).toBe("skipped");
  });
});

describe("provisionAccount — yaratish", () => {
  beforeEach(() => {
    mockUser.findOne.mockReturnValue(chain(null));
    mockUser.create.mockResolvedValue({ _id: USER_ID });
  });

  it("kira oladigan akkaunt yaratadi", async () => {
    const r = await provisionAccount({
      jshshir: PIN,
      lastName: "Aliyev",
      firstName: "Sardor",
      middleName: "Botir o'g'li",
      contact: { email: "s@fjsti.uz", phone: "+998901234567" },
    });

    expect(r).toMatchObject({ status: "created", userId: USER_ID, createdHere: true });
    expect(mockUser.create).toHaveBeenCalledWith({
      lastName: "Aliyev",
      firstName: "Sardor",
      middleName: "Botir o'g'li",
      email: "s@fjsti.uz",
      phone: "+998901234567",
      oneIdPin: PIN,
      role: ROLE_ID,
      active: true,
    });
  });

  it("`oneIdPin` — AYNAN JSHSHIR (login shu bo'yicha qidiradi)", async () => {
    await provisionAccount({ jshshir: PIN, lastName: "A", firstName: "B" });
    expect(mockUser.create.mock.calls[0][0].oneIdPin).toBe(PIN);
  });

  it("`active: true` ANIQ yoziladi (model default'i `false`)", async () => {
    await provisionAccount({ jshshir: PIN, lastName: "A", firstName: "B" });
    expect(mockUser.create.mock.calls[0][0].active).toBe(true);
  });

  it("`role` serverda qo'yiladi — kirishdagi hech narsa unga ta'sir qilmaydi", async () => {
    await provisionAccount({
      jshshir: PIN,
      lastName: "A",
      firstName: "B",
      contact: { role: "6a5a0acbd34b3c21a575d999", active: false, oneIdPin: "99999999999999" },
    });
    const payload = mockUser.create.mock.calls[0][0];
    expect(payload.role).toBe(ROLE_ID);
    expect(payload.active).toBe(true);
    expect(payload.oneIdPin).toBe(PIN);
  });

  it("otasining ismi bo'sh bo'lsa maydon UMUMAN yuborilmaydi", async () => {
    await provisionAccount({ jshshir: PIN, lastName: "A", firstName: "B", middleName: "  " });
    expect(mockUser.create.mock.calls[0][0]).not.toHaveProperty("middleName");
  });

  it("E11000 poygasi -> existing (xato emas)", async () => {
    const err = new Error("dup");
    err.code = 11000;
    mockUser.create.mockRejectedValue(err);
    mockUser.findOne
      .mockReturnValueOnce(chain(null))
      .mockReturnValueOnce(chain({ _id: USER_ID }));

    const r = await provisionAccount({ jshshir: PIN, lastName: "A", firstName: "B" });
    expect(r).toMatchObject({ status: "existing", userId: USER_ID, createdHere: false });
  });

  it("boshqa xato — yutilmaydi", async () => {
    mockUser.create.mockRejectedValue(new Error("network"));
    await expect(
      provisionAccount({ jshshir: PIN, lastName: "A", firstName: "B" }),
    ).rejects.toThrow("network");
  });
});

describe("discardAccount — kompensatsiya", () => {
  it("o'chiradi", async () => {
    await discardAccount(USER_ID);
    expect(mockUser.findByIdAndDelete).toHaveBeenCalledWith(USER_ID);
  });

  it("id bo'lmasa DBga bormaydi", async () => {
    await discardAccount(null);
    expect(mockUser.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("o'chirish yiqilsa — tashlanmaydi (jurnalga tushadi)", async () => {
    mockUser.findByIdAndDelete.mockRejectedValue(new Error("db down"));
    await expect(discardAccount(USER_ID)).resolves.toBeUndefined();
  });
});
