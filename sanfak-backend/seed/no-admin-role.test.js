const { loadAll } = require("./_role-seed-inventory");
const { ROLES } = require("../src/config/constants");

describe("Hech bir seed `admin` roliga tegmaydi (F-1, B-1 regressiya)", () => {
  const { grants, titles } = loadAll();

  test("skanerlangan inventar bo'sh emas (sanity)", () => {
    expect(grants.length).toBeGreaterThan(0);
  });

  test("`admin` roli hech bir seedning rol-nomlari ro'yxatida yo'q (yaratilmaydi)", () => {
    expect(titles.has(ROLES.ADMIN)).toBe(false);
  });

  test("`admin` roliga hech qanday (section, action) granti yo'q", () => {
    const adminGrants = grants.filter((g) => g.title === ROLES.ADMIN);
    expect(adminGrants).toEqual([]);
  });

  test("ilgari `admin`da bo'lgan 4.13/4.07 grantlari endi `moderator`da (ko'chirilgan, yo'qolmagan)", () => {
    const moderatorSections = new Set(
      grants.filter((g) => g.title === ROLES.MODERATOR).map((g) => g.section),
    );
    ["orgType", "province", "region", "academicYear", "course", "task", "taskCategory"].forEach(
      (section) => {
        expect(moderatorSections.has(section)).toBe(true);
      },
    );
  });
});
