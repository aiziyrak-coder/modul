"use strict";

const mockUserFindById = jest.fn();
const mockUserUpdateOne = jest.fn();
const mockRoleFindOne = jest.fn();
const mockRoleFind = jest.fn();

jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");
  return {
    isValidObjectId: actual.isValidObjectId,
    Types: actual.Types,
    model: (name) =>
      name === "role"
        ? { findOne: mockRoleFindOne, find: mockRoleFind }
        : { findById: mockUserFindById, updateOne: mockUserUpdateOne },
  };
});

jest.mock("#shared/winston.logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const { syncAccountRole } = require("./accountSync");

const UID = "6a5a0acbd34b3c21a575d59d";
const MAGISTRANT_ROLE = "6a5a0acbd34b3c21a575d001";
const REZIDENT_ROLE = "6a5a0acbd34b3c21a575d002";
const BOLIM_ROLE = "6a5a0acbd34b3c21a575d003";

const studentPerms = [{ section: "resident", actionKeys: ["read"] }];
const staffPerms = [{ section: "resident", actionKeys: ["read", "readAll"] }];

const userChain = (value) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.populate = jest.fn(() => c);
  c.lean = jest.fn(() => Promise.resolve(value));
  return c;
};

const roleChain = (value) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.lean = jest.fn(() => Promise.resolve(value));
  return c;
};

const account = (role) => ({ _id: UID, role });

beforeEach(() => {
  jest.clearAllMocks();
  mockUserUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  mockRoleFind.mockReturnValue(roleChain([]));
});

describe("rol qayta hisoblanadi", () => {
  it("magistratura -> ordinatura: `magistrant` roli `rezident` ga almashadi", async () => {
    mockUserFindById.mockReturnValue(
      userChain(
        account({ _id: MAGISTRANT_ROLE, title: "magistrant", permissions: studentPerms }),
      ),
    );
    mockRoleFindOne.mockReturnValue(roleChain({ _id: REZIDENT_ROLE }));

    const out = await syncAccountRole(UID, "ordinatura");

    expect(out).toMatchObject({ status: "synced", from: "magistrant", to: "rezident" });
    expect(mockRoleFindOne).toHaveBeenCalledWith({ title: "rezident" });
    expect(mockUserUpdateOne).toHaveBeenCalledWith(
      { _id: UID },
      { $set: { role: REZIDENT_ROLE } },
    );
  });

  it("rol allaqachon to'g'ri — yozuvga TEGILMAYDI", async () => {
    mockUserFindById.mockReturnValue(
      userChain(
        account({ _id: REZIDENT_ROLE, title: "rezident", permissions: studentPerms }),
      ),
    );
    mockRoleFindOne.mockReturnValue(roleChain({ _id: REZIDENT_ROLE }));

    expect(await syncAccountRole(UID, "ordinatura")).toMatchObject({ status: "unchanged" });
    expect(mockUserUpdateOne).not.toHaveBeenCalled();
  });
});

describe("🔴 fail-closed — talaba bo'lmagan akkauntga tegilmaydi", () => {
  it("xodim/ustoz roli saqlanib qoladi", async () => {
    mockUserFindById.mockReturnValue(
      userChain(
        account({ _id: BOLIM_ROLE, title: "magistratura_bolim", permissions: staffPerms }),
      ),
    );

    const out = await syncAccountRole(UID, "ordinatura");

    expect(out.status).toBe("blocked");
    expect(out.reason).toContain("magistratura_bolim");
    expect(mockUserUpdateOne).not.toHaveBeenCalled();
    expect(mockRoleFindOne).not.toHaveBeenCalled();
  });

  it("rolsiz akkaunt ham tegilmaydi", async () => {
    mockUserFindById.mockReturnValue(userChain(account(null)));

    expect(await syncAccountRole(UID, "ordinatura")).toMatchObject({ status: "blocked" });
    expect(mockUserUpdateOne).not.toHaveBeenCalled();
  });
});

describe("akkaunt yo'q", () => {
  it("`user` biriktirilmagan — hech narsa qilinmaydi", async () => {
    expect(await syncAccountRole(null, "ordinatura")).toEqual({ status: "skipped" });
    expect(mockUserFindById).not.toHaveBeenCalled();
  });

  it("ObjectId shaklida bo'lmagan id", async () => {
    expect(await syncAccountRole("salom", "ordinatura")).toEqual({ status: "skipped" });
  });

  it("id bor, lekin akkaunt topilmadi", async () => {
    mockUserFindById.mockReturnValue(userChain(null));
    expect(await syncAccountRole(UID, "ordinatura")).toMatchObject({ status: "skipped" });
  });
});

describe("rol aniqlanmasa xato KO'RINADI", () => {
  beforeEach(() => {
    mockUserFindById.mockReturnValue(
      userChain(
        account({ _id: MAGISTRANT_ROLE, title: "magistrant", permissions: studentPerms }),
      ),
    );
    mockRoleFindOne.mockReturnValue(roleChain(null));
  });

  it("rol bazada yo'q -> seed eslatiladi", async () => {
    const out = await syncAccountRole(UID, "ordinatura");
    expect(out.status).toBe("failed");
    expect(out.reason).toContain("seed");
    expect(mockUserUpdateOne).not.toHaveBeenCalled();
  });

  it("ruxsat profiliga bir nechta rol mos kelsa -> noaniq", async () => {
    mockRoleFind.mockReturnValue(
      roleChain([
        { _id: MAGISTRANT_ROLE, permissions: studentPerms },
        { _id: REZIDENT_ROLE, permissions: studentPerms },
      ]),
    );

    const out = await syncAccountRole(UID, "ordinatura");
    expect(out.status).toBe("failed");
    expect(out.reason).toContain("2 ta rol");
    expect(mockUserUpdateOne).not.toHaveBeenCalled();
  });

  it("noma'lum dastur -> rol nomi yo'q", async () => {
    const out = await syncAccountRole(UID, "doktorantura");
    expect(out.status).toBe("failed");
    expect(mockUserUpdateOne).not.toHaveBeenCalled();
  });
});

describe("yozishdagi xato yozuvni yiqitmaydi", () => {
  it("`updateOne` yiqilsa `failed` qaytadi (throw QILMAYDI)", async () => {
    mockUserFindById.mockReturnValue(
      userChain(
        account({ _id: MAGISTRANT_ROLE, title: "magistrant", permissions: studentPerms }),
      ),
    );
    mockRoleFindOne.mockReturnValue(roleChain({ _id: REZIDENT_ROLE }));
    mockUserUpdateOne.mockRejectedValue(new Error("mongo tushdi"));

    expect(await syncAccountRole(UID, "ordinatura")).toMatchObject({
      status: "failed",
      reason: "mongo tushdi",
    });
  });
});
