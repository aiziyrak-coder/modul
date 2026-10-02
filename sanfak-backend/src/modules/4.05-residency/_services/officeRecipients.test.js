"use strict";

const mockRoleFindOne = jest.fn();
const mockUserFind = jest.fn();

jest.mock("mongoose", () => ({
  model: (name) =>
    name === "role" ? { findOne: mockRoleFindOne } : { find: mockUserFind },
}));

jest.mock("#shared/winston.logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const { officeUserIds } = require("./officeRecipients");
const { ROLES } = require("#config/constants");

const chain = (value) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.lean = jest.fn(() => Promise.resolve(value));
  return c;
};

beforeEach(() => jest.clearAllMocks());

describe("officeUserIds", () => {
  it("bo'lim xodimlarining id lari qaytadi", async () => {
    mockRoleFindOne.mockReturnValue(chain({ _id: "role1" }));
    mockUserFind.mockReturnValue(chain([{ _id: "u1" }, { _id: "u2" }]));

    expect(await officeUserIds()).toEqual(["u1", "u2"]);
  });

  it("rol KANONIK NOM bo'yicha qidiriladi", async () => {
    mockRoleFindOne.mockReturnValue(chain({ _id: "role1" }));
    mockUserFind.mockReturnValue(chain([]));

    await officeUserIds();
    expect(mockRoleFindOne).toHaveBeenCalledWith({
      title: ROLES.MAGISTRATURA_BOLIM,
    });
  });

  it("nofaol akkauntlar chetlanadi", async () => {
    mockRoleFindOne.mockReturnValue(chain({ _id: "role1" }));
    mockUserFind.mockReturnValue(chain([]));

    await officeUserIds();
    expect(mockUserFind).toHaveBeenCalledWith({
      role: "role1",
      active: { $ne: false },
    });
  });

  it("rol topilmasa BO'SH massiv (istisno emas)", async () => {
    mockRoleFindOne.mockReturnValue(chain(null));

    await expect(officeUserIds()).resolves.toEqual([]);
    expect(mockUserFind).not.toHaveBeenCalled();
  });

  it("xodim topilmasa ham BO'SH massiv", async () => {
    mockRoleFindOne.mockReturnValue(chain({ _id: "role1" }));
    mockUserFind.mockReturnValue(chain([]));

    await expect(officeUserIds()).resolves.toEqual([]);
  });
});
