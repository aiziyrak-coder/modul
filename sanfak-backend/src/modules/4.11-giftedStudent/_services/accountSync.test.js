"use strict";

const mockFindById = jest.fn();
const mockUpdateOne = jest.fn();

jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");
  return {
    isValidObjectId: actual.isValidObjectId,
    Types: actual.Types,
    model: () => ({ findById: mockFindById, updateOne: mockUpdateOne }),
  };
});

jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const { syncAccount, buildAccountPatch, DIRECT_FIELDS } = require("./accountSync");

const UID = "6a5a0acbd34b3c21a575d59d";

const USER = {
  _id: UID,
  lastName: "Karimov",
  firstName: "Anvar",
  middleName: "Baxtiyor o'g'li",
  email: "eski@fjsti.uz",
  phone: "+998901112233",
  passportSeria: "AA",
  passportNumber: "1234567",
};

const chain = (value) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.lean = jest.fn(() => Promise.resolve(value));
  return c;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFindById.mockReturnValue(chain(USER));
  mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });
});

describe("buildAccountPatch — qaysi maydon ko'chadi", () => {
  it("so'rovda YO'Q maydon tegilmaydi", () => {
    const { patch, fields } = buildAccountPatch({ phone: "+998900000000" }, USER);

    expect(fields).toEqual(["phone"]);
    expect(patch).toEqual({ phone: "+998900000000" });
    expect(patch).not.toHaveProperty("email");
    expect(patch).not.toHaveProperty("passportSeria");
  });

  it("qiymat o'zgarmagan bo'lsa patchga tushmaydi", () => {
    expect(buildAccountPatch({ email: USER.email, phone: USER.phone }, USER).fields).toEqual([]);
  });

  it("bo'sh satr -> null (yozuvdagi `clean()` bilan bir xil)", () => {
    expect(buildAccountPatch({ email: "" }, USER).patch).toEqual({ email: null });
  });

  it("bo'shliqlar tozalanadi", () => {
    expect(buildAccountPatch({ phone: "  +998911111111  " }, USER).patch).toEqual({
      phone: "+998911111111",
    });
  });

  it("🔴 `jshshir` ko'chmaydi va `oneIdPin` ga TEGILMAYDI", () => {
    const { patch, fields } = buildAccountPatch(
      { jshshir: "99999999999999", oneIdPin: "88888888888888" },
      USER,
    );

    expect(fields).toEqual([]);
    expect(patch).not.toHaveProperty("oneIdPin");
    expect(patch).not.toHaveProperty("jshshir");
    expect(DIRECT_FIELDS).not.toContain("jshshir");
    expect(DIRECT_FIELDS).not.toContain("oneIdPin");
  });
});

describe("ism", () => {
  it("o'zgarganda familiya/ism/otasining ismiga bo'linadi", () => {
    const { patch, fields, nameGuessed } = buildAccountPatch(
      { fullName: "Aliyev Sardor Botir o'g'li" },
      USER,
    );

    expect(patch).toMatchObject({
      lastName: "Aliyev",
      firstName: "Sardor",
      middleName: "Botir o'g'li",
    });
    expect(fields).toContain("fullName");
    expect(nameGuessed).toBe(true);
  });

  it("akkauntdagi qismlar allaqachon shu ismni bersa — TEGILMAYDI", () => {
    const { patch, fields } = buildAccountPatch(
      { fullName: "Karimov Anvar Baxtiyor o'g'li" },
      USER,
    );

    expect(fields).toEqual([]);
    expect(patch).not.toHaveProperty("lastName");
  });

  it("bitta so'z -> faqat familiya, qolgani bo'shaydi", () => {
    expect(buildAccountPatch({ fullName: "Aliyev" }, USER).patch).toMatchObject({
      lastName: "Aliyev",
      firstName: "",
      middleName: null,
    });
  });

  it("bo'sh `fullName` akkaunt ismini O'CHIRMAYDI", () => {
    expect(buildAccountPatch({ fullName: "   " }, USER).fields).toEqual([]);
  });
});

describe("syncAccount", () => {
  it("akkaunt biriktirilmagan -> skipped, DBga borilmaydi", async () => {
    expect(await syncAccount(null, { phone: "+998900000000" })).toEqual({ status: "skipped" });
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("noto'g'ri id -> skipped", async () => {
    expect(await syncAccount("shunchaki-matn", { phone: "x" })).toEqual({ status: "skipped" });
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("akkaunt topilmadi -> skipped, yozilmaydi", async () => {
    mockFindById.mockReturnValue(chain(null));
    expect((await syncAccount(UID, { phone: "+998900000000" })).status).toBe("skipped");
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it("o'zgarish yo'q -> unchanged, yozilmaydi", async () => {
    expect(await syncAccount(UID, { email: USER.email })).toEqual({ status: "unchanged" });
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it("o'zgarish bor -> synced va AYNAN o'sha maydonlar yoziladi", async () => {
    const out = await syncAccount(UID, { phone: "+998900000000", email: "yangi@fjsti.uz" });

    expect(out.status).toBe("synced");
    expect(out.fields.sort()).toEqual(["email", "phone"]);
    const [[filter, update]] = mockUpdateOne.mock.calls;
    expect(String(filter._id)).toBe(UID);
    expect(update.$set).toEqual({ phone: "+998900000000", email: "yangi@fjsti.uz" });
  });

  it("akkaunt yozuvi yiqilsa -> failed (istisno tashlanmaydi)", async () => {
    mockUpdateOne.mockRejectedValue(new Error("E11000 duplicate key"));

    const out = await syncAccount(UID, { phone: "+998900000000" });

    expect(out.status).toBe("failed");
    expect(out.reason).toMatch(/E11000/);
  });

  it("akkauntdan maxfiy maydon O'QILMAYDI", async () => {
    const c = chain(USER);
    mockFindById.mockReturnValue(c);

    await syncAccount(UID, { phone: "+998900000000" });

    const [selected] = c.select.mock.calls[0];
    for (const secret of ["oneIdPin", "refreshToken", "eriCertificate"]) {
      expect(selected).not.toMatch(new RegExp(secret, "i"));
    }
  });
});

const { buildGapPatch, fillAccountGaps, GAP_FIELDS } = require("./accountSync");

const ACCOUNT = {
  _id: UID,
  lastName: "Karimov",
  firstName: "Anvar",
  middleName: null,
  email: "eski@fjsti.uz",
  phone: null,
  passportSeria: "AA",
  passportNumber: "1234567",
};

describe("buildGapPatch", () => {
  it("faqat BO'SH maydon to'ldiriladi", () => {
    const { patch, filled } = buildGapPatch(
      { middleName: "Baxtiyor o'g'li", phone: "+998901112233" },
      ACCOUNT,
    );

    expect(filled.sort()).toEqual(["middleName", "phone"]);
    expect(patch).toEqual({ middleName: "Baxtiyor o'g'li", phone: "+998901112233" });
  });

  it("to'lgan maydon TEGILMAYDI — ziddiyat sifatida qaytadi", () => {
    const { patch, filled, conflicts } = buildGapPatch({ email: "yangi@fjsti.uz" }, ACCOUNT);

    expect(patch).toEqual({});
    expect(filled).toEqual([]);
    expect(conflicts).toEqual([
      { field: "email", account: "eski@fjsti.uz", incoming: "yangi@fjsti.uz" },
    ]);
  });

  it("kelgan qiymat BO'SH bo'lsa akkaunt maydoni O'CHIRILMAYDI", () => {
    const { patch, filled, conflicts } = buildGapPatch(
      { email: null, phone: "", passportSeria: "   ", passportNumber: undefined },
      ACCOUNT,
    );

    expect(patch).toEqual({});
    expect(filled).toEqual([]);
    expect(conflicts).toEqual([]);
  });

  it("bir xil qiymat — ziddiyat ham, yozuv ham yo'q", () => {
    expect(buildGapPatch({ email: "eski@fjsti.uz" }, ACCOUNT)).toMatchObject({
      patch: {},
      filled: [],
      conflicts: [],
    });
  });

  it("🔴 `oneIdPin`/`jshshir` to'ldiriladigan maydonlar ro'yxatida YO'Q", () => {
    expect(GAP_FIELDS).not.toContain("oneIdPin");
    expect(GAP_FIELDS).not.toContain("jshshir");
    expect(buildGapPatch({ oneIdPin: "99999999999999", jshshir: "99999999999999" }, ACCOUNT).patch)
      .toEqual({});
  });
});

describe("fillAccountGaps", () => {
  beforeEach(() => {
    mockFindById.mockReturnValue(chain(ACCOUNT));
  });

  it("to'ldiradi va AYNAN o'sha maydonlarni yozadi", async () => {
    const out = await fillAccountGaps(UID, { middleName: "Baxtiyor o'g'li" });

    expect(out.status).toBe("filled");
    expect(out.filled).toEqual(["middleName"]);
    const [[, update]] = mockUpdateOne.mock.calls;
    expect(update.$set).toEqual({ middleName: "Baxtiyor o'g'li" });
  });

  it("dryRun — qaror bir xil, lekin YOZILMAYDI", async () => {
    const out = await fillAccountGaps(UID, { middleName: "Baxtiyor o'g'li" }, { dryRun: true });

    expect(out.status).toBe("filled");
    expect(out.filled).toEqual(["middleName"]);
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it("ziddiyat ogohlantirishga aylanadi va hech narsa yozilmaydi", async () => {
    const out = await fillAccountGaps(UID, { email: "yangi@fjsti.uz" });

    expect(out.status).toBe("unchanged");
    expect(out.conflicts).toHaveLength(1);
    expect(out.warnings[0]).toMatch(/Email.*eski@fjsti\.uz.*yangi@fjsti\.uz/);
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it("akkaunt yo'q / id noto'g'ri -> skipped", async () => {
    expect((await fillAccountGaps(null, { phone: "x" })).status).toBe("skipped");
    mockFindById.mockReturnValue(chain(null));
    expect((await fillAccountGaps(UID, { phone: "x" })).status).toBe("skipped");
  });

  it("yozuv yiqilsa -> failed, istisno tashlanmaydi", async () => {
    mockUpdateOne.mockRejectedValue(new Error("mongo down"));
    const out = await fillAccountGaps(UID, { middleName: "X" });
    expect(out.status).toBe("failed");
  });
});
