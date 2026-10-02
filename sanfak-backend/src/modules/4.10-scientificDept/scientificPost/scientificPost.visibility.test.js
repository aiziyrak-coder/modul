const { ROLES } = require("#config/constants");
const { visibilityFilter } = require("./scientificPost.service");

const as = (title) => ({ role: { title } });

describe("scientificPost visibilityFilter", () => {
  it("Ilmiy bo'lim (yuboruvchi) hammasini ko'radi", () => {
    expect(visibilityFilter(as(ROLES.ILMIY_BOLIM))).toEqual({});
  });

  it("admin ham hammasini ko'radi", () => {
    expect(visibilityFilter(as(ROLES.SUPER_ADMIN))).toEqual({});
    expect(visibilityFilter(as(ROLES.ADMIN))).toEqual({});
  });

  it("dekan — faqat 'deans' va 'all'; 'teachers' YO'Q", () => {
    const groups = visibilityFilter(as(ROLES.DEKAN)).recipients.$in;
    expect(groups).toContain("deans");
    expect(groups).toContain("all");
    expect(groups).not.toContain("teachers");
    expect(groups).not.toContain("heads");
  });

  it("o'qituvchi — faqat 'teachers' va 'all'", () => {
    const groups = visibilityFilter(as(ROLES.OQITUVCHI)).recipients.$in;
    expect(groups.sort()).toEqual(["all", "teachers"]);
  });

  it("kafedra mudiri — faqat 'heads' va 'all'", () => {
    const groups = visibilityFilter(as(ROLES.KAFEDRA_MUDIRI)).recipients.$in;
    expect(groups.sort()).toEqual(["all", "heads"]);
  });

  it("rektor/prorektor/kotib — faqat 'all'", () => {
    [ROLES.REKTOR, ROLES.PROREKTOR, ROLES.ILMIY_KENGASH_KOTIBI].forEach((r) => {
      expect(visibilityFilter(as(r)).recipients.$in).toEqual(["all"]);
    });
  });

  it("noma'lum/rolsiz foydalanuvchi HECH NARSA ko'rmaydi (ochib qo'yilmaydi)", () => {
    expect(visibilityFilter(as("nomalum_rol")).recipients.$in).toEqual([]);
    expect(visibilityFilter(undefined).recipients.$in).toEqual([]);
  });
});
