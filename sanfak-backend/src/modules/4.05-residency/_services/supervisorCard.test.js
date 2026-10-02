"use strict";

const mockUserFindById = jest.fn();

jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");
  return {
    isValidObjectId: actual.isValidObjectId,
    Types: actual.Types,
    model: () => ({ findById: mockUserFindById }),
  };
});

const { buildSupervisorCard, USER_FIELDS, REF_FIELDS } = require("./supervisorCard");

const ID = "6a5a0acbd34b3c21a575d59d";

const chain = (value) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.populate = jest.fn(() => c);
  c.lean = jest.fn(() => Promise.resolve(value));
  return c;
};

const USER = {
  _id: ID,
  lastName: "Karimov",
  firstName: "Anvar",
  middleName: "Baxtiyor o'g'li",
  phone: "+998901234567",
  office: "2-bino, 305",
  workingHours: "09:00–17:00",
  academicTitle: { title: "Dotsent" },
  position: { title: "Katta o'qituvchi" },
  department: { title: "Klinik fanlar kafedrasi" },
  faculty: { title: "Davolash fakulteti" },
  division: { title: "Magistratura bo'limi" },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUserFindById.mockReturnValue(chain(USER));
});

describe("maxfiy maydonlar", () => {
  it("`select` da maxfiy maydon YO'Q", () => {
    for (const secret of ["oneIdPin", "refreshToken", "passport", "eriCertificate", "telegram"]) {
      expect(USER_FIELDS).not.toMatch(new RegExp(secret, "i"));
    }
  });

  it("javob qo'lda yig'iladi — kutilmagan kalit chiqmaydi", async () => {
    mockUserFindById.mockReturnValue(
      chain({ ...USER, oneIdPin: "12345678901234", refreshToken: "secret", email: "x@y.uz" }),
    );

    const card = await buildSupervisorCard(ID);

    expect(card).not.toHaveProperty("oneIdPin");
    expect(card).not.toHaveProperty("refreshToken");
    expect(card).not.toHaveProperty("email");
  });
});

describe("kalitlar to'plami (mahsulot qarori)", () => {
  it("AYNAN kelishilgan maydonlar — ortiq ham, kam ham emas", async () => {
    const card = await buildSupervisorCard(ID);

    expect(Object.keys(card).sort()).toEqual(
      [
        "academicTitle",
        "department",
        "division",
        "faculty",
        "fullName",
        "id",
        "office",
        "phone",
        "position",
        "workingHours",
      ].sort(),
    );
  });

  it("biriktirilgan talabalar sanog'i YO'Q", async () => {
    expect(await buildSupervisorCard(ID)).not.toHaveProperty("residents");
  });
});

describe("karta mazmuni", () => {
  it("F.I.SH familiya-ism-sharif tartibida yig'iladi", async () => {
    expect((await buildSupervisorCard(ID)).fullName).toBe("Karimov Anvar Baxtiyor o'g'li");
  });

  it("ma'lumotnoma havolalari sarlavhaga aylantiriladi", async () => {
    expect(await buildSupervisorCard(ID)).toMatchObject({
      academicTitle: "Dotsent",
      position: "Katta o'qituvchi",
      department: "Klinik fanlar kafedrasi",
      faculty: "Davolash fakulteti",
      division: "Magistratura bo'limi",
    });
  });

  it("har bir ma'lumotnoma havolasi `populate` qilinadi", async () => {
    const c = chain(USER);
    mockUserFindById.mockReturnValue(c);

    await buildSupervisorCard(ID);

    expect(c.populate).toHaveBeenCalledTimes(REF_FIELDS.length);
    expect(c.populate.mock.calls.map(([ref]) => ref).sort()).toEqual([...REF_FIELDS].sort());
    for (const [, fields] of c.populate.mock.calls) expect(fields).toBe("title");
  });

  it("bog'lanmagan ma'lumotnoma -> `null`, yiqilmaydi", async () => {
    mockUserFindById.mockReturnValue(
      chain({ _id: ID, firstName: "A", lastName: "B", academicTitle: null, department: null }),
    );

    expect(await buildSupervisorCard(ID)).toMatchObject({
      academicTitle: null,
      position: null,
      department: null,
      faculty: null,
      division: null,
      phone: null,
      office: null,
      workingHours: null,
    });
  });
});

describe("topilmagan holatlar", () => {
  it("noto'g'ri id -> null, DBga umuman borilmaydi", async () => {
    expect(await buildSupervisorCard("shunchaki-matn")).toBeNull();
    expect(mockUserFindById).not.toHaveBeenCalled();
  });

  it("foydalanuvchi yo'q -> null", async () => {
    mockUserFindById.mockReturnValue(chain(null));
    expect(await buildSupervisorCard(ID)).toBeNull();
  });
});
