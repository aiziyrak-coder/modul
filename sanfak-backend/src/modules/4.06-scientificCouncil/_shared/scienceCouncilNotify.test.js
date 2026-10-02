jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#modules/4.01-auth/role/role.model");
jest.mock("#shared/winston.logger", () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }));

const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");
const { ROLES } = require("#config/constants");
const { provisionExternalResearcherAccount } = require("./scienceCouncilNotify");

const makeWork = (overrides = {}) => ({
  _id: "workId1",
  authorType: "external",
  externalAuthor: { name: "Anvar Yusupov", pinfl: "12345678901234" },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("scienceCouncilNotify — provisionExternalResearcherAccount", () => {
  test("authorType='internal' — no-op, null qaytadi", async () => {
    const result = await provisionExternalResearcherAccount(
      makeWork({ authorType: "internal" }),
    );

    expect(result).toBeNull();
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test("allaqachon provisionedUserId bor — qayta yaratmasdan o'shani qaytaradi", async () => {
    const result = await provisionExternalResearcherAccount(
      makeWork({ externalAuthor: { name: "X", pinfl: "1", provisionedUserId: "existingId1" } }),
    );

    expect(result).toBe("existingId1");
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test("PINFL yo'q — akkaunt yaratilmaydi, null qaytadi (xato EMAS)", async () => {
    const result = await provisionExternalResearcherAccount(
      makeWork({ externalAuthor: { name: "Anvar Yusupov", pinfl: "" } }),
    );

    expect(result).toBeNull();
    expect(User.create).not.toHaveBeenCalled();
  });

  test("PINFL bo'yicha MAVJUD user topilsa — qayta ishlatiladi, roli TEGILMAYDI", async () => {
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: "foundUserId" }),
    });

    const result = await provisionExternalResearcherAccount(makeWork());

    expect(result).toBe("foundUserId");
    expect(User.create).not.toHaveBeenCalled();
    expect(Role.findOne).not.toHaveBeenCalled();
  });

  test("mavjud emas + rol DBda bor — yangi user yaratiladi (ism ikkiga bo'linadi, active=true)", async () => {
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    Role.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: "roleId1" }),
    });
    User.create = jest.fn().mockResolvedValue({ _id: "newUserId" });

    const result = await provisionExternalResearcherAccount(makeWork());

    expect(result).toBe("newUserId");
    expect(Role.findOne).toHaveBeenCalledWith({ title: ROLES.TASHQI_TADQIQOTCHI });
    expect(User.create).toHaveBeenCalledWith({
      firstName: "Anvar",
      lastName: "Yusupov",
      oneIdPin: "12345678901234",
      role: "roleId1",
      active: true,
    });
  });

  test("bitta so'zli ism — lastName '—' bilan to'ldiriladi (majburiy maydon)", async () => {
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    Role.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: "roleId1" }),
    });
    User.create = jest.fn().mockResolvedValue({ _id: "newUserId" });

    await provisionExternalResearcherAccount(
      makeWork({ externalAuthor: { name: "Anvar", pinfl: "111" } }),
    );

    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "Anvar", lastName: "—" }),
    );
  });

  test("TASHQI_TADQIQOTCHI roli DBda topilmasa (seed ishlatilmagan) — akkaunt yaratilmaydi, null", async () => {
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    Role.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    const result = await provisionExternalResearcherAccount(makeWork());

    expect(result).toBeNull();
    expect(User.create).not.toHaveBeenCalled();
  });

  test("kutilmagan xato (masalan DB) — throw qilmaydi, null qaytadi", async () => {
    User.findOne = jest.fn().mockImplementation(() => {
      throw new Error("DB xato");
    });

    const result = await provisionExternalResearcherAccount(makeWork());

    expect(result).toBeNull();
  });
});
