const DIR_A = "69df7a8f94bda50c83a1d4a1";
const DIR_B = "69df7a8f94bda50c83a1d4a3";
const GRP = "69df7a8f94bda50c83a1d4ab";

let mockGroup = null;
jest.mock("#references/group/group.model", () => ({
  findById: () => ({ select: () => ({ lean: async () => mockGroup }) }),
}));

const { checkGroupDirection } = require("./hierarchyCheck");

beforeEach(() => {
  mockGroup = { _id: GRP, title: "Farm-201", direction: DIR_A };
});

describe("checkGroupDirection", () => {
  test("guruh tanlangan yo'nalishga tegishli — o'tadi", async () => {
    await expect(checkGroupDirection({ groupId: GRP, directionId: DIR_A })).resolves.toBeNull();
  });

  test("guruh BOSHQA yo'nalishniki — rad etiladi, guruh nomi bilan", async () => {
    const r = await checkGroupDirection({ groupId: GRP, directionId: DIR_B });
    expect(r).not.toBeNull();
    expect(r.message).toContain("Farm-201");
    expect(r.message).toMatch(/tegishli emas/);
  });

  describe("TEKSHIRIB BO'LMAYDIGAN holatlar — bloklamaydi", () => {
    test("guruh tanlanmagan", async () => {
      await expect(checkGroupDirection({ directionId: DIR_A })).resolves.toBeNull();
    });

    test("yo'nalish tanlanmagan", async () => {
      await expect(checkGroupDirection({ groupId: GRP })).resolves.toBeNull();
    });

    test("ikkalasi ham yo'q (eski, faqat sarlavhali yozuv)", async () => {
      await expect(checkGroupDirection({})).resolves.toBeNull();
    });

    test("guruh ma'lumotnomada topilmadi", async () => {
      mockGroup = null;
      await expect(checkGroupDirection({ groupId: GRP, directionId: DIR_B })).resolves.toBeNull();
    });

    test("ma'lumotnomadagi guruh yo'nalishsiz", async () => {
      mockGroup = { _id: GRP, title: "Farm-201", direction: null };
      await expect(checkGroupDirection({ groupId: GRP, directionId: DIR_B })).resolves.toBeNull();
    });
  });

  test("ObjectId va satr solishtiruvi ishlaydi", async () => {
    mockGroup = { _id: GRP, title: "Farm-201", direction: { toString: () => DIR_A } };
    await expect(checkGroupDirection({ groupId: GRP, directionId: DIR_A })).resolves.toBeNull();
  });
});
