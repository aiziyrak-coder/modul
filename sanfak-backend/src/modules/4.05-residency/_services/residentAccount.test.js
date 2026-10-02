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
  resolveNameParts,
  resolveResidentRole,
  contactFields,
  provisionAccount,
  discardAccount,
  ROLE_BY_PROGRAM,
} = require("./residentAccount");

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

const STUDENT_ROLE = {
  title: "rezident",
  permissions: [
    { section: "resident", actionKeys: ["read"] },
    { section: "residentDailyLog", actionKeys: ["create", "read", "readAll"] },
  ],
};

const BOLIM_ROLE = {
  title: "magistratura_bolim",
  permissions: [
    { section: "resident", actionKeys: ["create", "read", "readAll", "update"] },
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

  it("bitta so'z — ism aniqlanmaydi (akkaunt ochilmaydi)", () => {
    expect(splitFullName("Aliyev").firstName).toBe("");
  });
});

describe("resolveNameParts", () => {
  it("aniq qismlar berilsa TAXMIN QILINMAYDI", () => {
    expect(resolveNameParts({ lastName: "Aliyev", firstName: "Sardor" }).guessed).toBe(false);
  });

  it("faqat `fullName` — bo'linadi va belgilanadi", () => {
    const r = resolveNameParts({ fullName: "Aliyev Sardor Botir o'g'li" });
    expect(r).toMatchObject({ lastName: "Aliyev", firstName: "Sardor", guessed: true });
  });
});

describe("rol DASTURGA bog'liq — 4.11 dan asosiy farq", () => {
  it("xaritada aynan ikkita dastur bor", () => {
    expect(ROLE_BY_PROGRAM).toEqual({
      magistratura: "magistrant",
      ordinatura: "rezident",
    });
  });

  it.each([
    ["magistratura", "magistrant"],
    ["ordinatura", "rezident"],
  ])("%s -> `%s` roli title bo'yicha qidiriladi", async (program, title) => {
    await resolveResidentRole(program);
    expect(mockRole.findOne).toHaveBeenCalledWith({ title });
  });

  it("noma'lum dastur -> rol yo'q, DBga umuman borilmaydi", async () => {
    expect(await resolveResidentRole("qandaydir")).toEqual({ id: null, ambiguous: 0 });
    expect(mockRole.findOne).not.toHaveBeenCalled();
  });

  it("nom topilmasa va AYNAN BITTA mos rol bo'lsa — o'sha", async () => {
    mockRole.findOne.mockReturnValue(chain(null));
    mockRole.find.mockReturnValue(chain([{ _id: "yangi-nom", ...STUDENT_ROLE }]));

    expect(await resolveResidentRole("ordinatura")).toMatchObject({
      id: "yangi-nom",
      guessed: true,
    });
  });

  it("bir nechta mos rol -> tanlanmaydi", async () => {
    mockRole.findOne.mockReturnValue(chain(null));
    mockRole.find.mockReturnValue(
      chain([
        { _id: "r1", ...STUDENT_ROLE },
        { _id: "r2", ...STUDENT_ROLE, title: "magistrant" },
      ]),
    );

    expect(await resolveResidentRole("ordinatura")).toMatchObject({ id: null, ambiguous: 2 });
  });
});

describe("provisionAccount — yaratmaydigan holatlar", () => {
  it.each([["1234567890123"], ["123456789012345"], ["1234567890123A"], [""], [null]])(
    "PIN %p -> skipped, DBga bormaydi",
    async (jshshir) => {
      const r = await provisionAccount({
        jshshir,
        program: "ordinatura",
        lastName: "A",
        firstName: "B",
      });
      expect(r).toMatchObject({ status: "skipped", userId: null });
      expect(mockUser.findOne).not.toHaveBeenCalled();
    },
  );

  it("ism yoki familiya yo'q -> skipped", async () => {
    const r = await provisionAccount({ jshshir: PIN, program: "ordinatura", lastName: "A" });
    expect(r.status).toBe("skipped");
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it("dastur yo'q -> rol aniqlanmaydi -> skipped", async () => {
    mockUser.findOne.mockReturnValue(chain(null));
    const r = await provisionAccount({ jshshir: PIN, lastName: "A", firstName: "B" });
    expect(r.status).toBe("skipped");
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it("rol DBda yo'q -> skipped (yaroqsiz akkaunt yaratilmaydi)", async () => {
    mockUser.findOne.mockReturnValue(chain(null));
    mockRole.findOne.mockReturnValue(chain(null));

    const r = await provisionAccount({
      jshshir: PIN,
      program: "ordinatura",
      lastName: "A",
      firstName: "B",
    });
    expect(r.status).toBe("skipped");
    expect(r.warnings[0]).toMatch(/rezident/);
  });
});

describe("provisionAccount — mavjud akkaunt", () => {
  it("talaba roli -> existing, hech narsa yangilanmaydi", async () => {
    mockUser.findOne.mockReturnValue(chain({ _id: USER_ID, role: STUDENT_ROLE }));

    const r = await provisionAccount({
      jshshir: PIN,
      program: "ordinatura",
      lastName: "A",
      firstName: "B",
      contact: { email: "yangi@b.uz" },
    });

    expect(r).toMatchObject({ status: "existing", userId: USER_ID, createdHere: false });
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it("bo'lim xodimi roli -> BOG'LANMAYDI", async () => {
    mockUser.findOne.mockReturnValue(chain({ _id: USER_ID, role: BOLIM_ROLE }));

    const r = await provisionAccount({
      jshshir: PIN,
      program: "ordinatura",
      lastName: "A",
      firstName: "B",
    });
    expect(r).toMatchObject({ status: "skipped", userId: null });
    expect(r.warnings[0]).toMatch(/boshqa toifadagi/);
  });

  it("rolsiz akkaunt -> skipped (u baribir kira olmaydi)", async () => {
    mockUser.findOne.mockReturnValue(chain({ _id: USER_ID, role: null }));
    const r = await provisionAccount({
      jshshir: PIN,
      program: "ordinatura",
      lastName: "A",
      firstName: "B",
    });
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
      program: "magistratura",
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

  it("`role` serverda qo'yiladi — kirishdagi hech narsa unga ta'sir qilmaydi", async () => {
    await provisionAccount({
      jshshir: PIN,
      program: "ordinatura",
      lastName: "A",
      firstName: "B",
      contact: { role: "6a5a0acbd34b3c21a575d999", active: false, oneIdPin: "99999999999999" },
    });
    const payload = mockUser.create.mock.calls[0][0];
    expect(payload.role).toBe(ROLE_ID);
    expect(payload.active).toBe(true);
    expect(payload.oneIdPin).toBe(PIN);
  });

  it("E11000 poygasi -> existing (xato emas)", async () => {
    const err = new Error("dup");
    err.code = 11000;
    mockUser.create.mockRejectedValue(err);
    mockUser.findOne
      .mockReturnValueOnce(chain(null))
      .mockReturnValueOnce(chain({ _id: USER_ID }));

    const r = await provisionAccount({
      jshshir: PIN,
      program: "ordinatura",
      lastName: "A",
      firstName: "B",
    });
    expect(r).toMatchObject({ status: "existing", userId: USER_ID });
  });

  it("dryRun — hech narsa yozilmaydi, lekin qaror BIR XIL", async () => {
    const r = await provisionAccount({
      jshshir: PIN,
      program: "ordinatura",
      lastName: "A",
      firstName: "B",
      dryRun: true,
    });

    expect(r).toMatchObject({ status: "created", userId: null, createdHere: false });
    expect(mockUser.create).not.toHaveBeenCalled();
  });
});

describe("contactFields — user validatsiyasi resident'nikidan QATTIQROQ", () => {
  it("7 raqamdan farqli pasport — MAYDON tashlanadi", () => {
    const w = [];
    expect(contactFields({ passportNumber: "AA123456" }, w).passportNumber).toBeUndefined();
    expect(w[0]).toMatch(/7 ta raqam emas/);
  });

  it("noto'g'ri email — MAYDON tashlanadi", () => {
    const w = [];
    expect(contactFields({ email: "shunchaki-matn" }, w).email).toBeUndefined();
  });

  it("bo'sh qiymatlar umuman yozilmaydi", () => {
    expect(contactFields({ email: "", phone: "  ", passportNumber: "" }, [])).toEqual({});
  });
});

describe("discardAccount — kompensatsiya", () => {
  it("o'chiradi", async () => {
    await discardAccount(USER_ID);
    expect(mockUser.findByIdAndDelete).toHaveBeenCalledWith(USER_ID);
  });

  it("o'chirish yiqilsa — tashlanmaydi (jurnalga tushadi)", async () => {
    mockUser.findByIdAndDelete.mockRejectedValue(new Error("db down"));
    await expect(discardAccount(USER_ID)).resolves.toBeUndefined();
  });
});
