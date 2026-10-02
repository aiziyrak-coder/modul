const {
  collectRefs,
  collectDirections,
  assertSeasonAllows,
} = require("./public.service");

const dir = (id, title) => ({ _id: id, titleUz: title });
const SEASON = {
  items: [
    {
      direction: dir("d1", "Davolash ishi"),
      educationForms: [dir("f1", "Kunduzgi"), dir("f2", "Sirtqi")],
      educationLanguages: [dir("l1", "Ingliz"), dir("l2", "Rus")],
    },
    {
      direction: dir("d2", "Stomatologiya"),
      educationForms: [dir("f1", "Kunduzgi")],
      educationLanguages: [dir("l2", "Rus")],
    },
    { direction: null, educationForms: [dir("f9", "Kechki")], educationLanguages: [] },
  ],
};

describe("4.8 public — dropdownlar ochiq mavsum bo'yicha", () => {
  it("yo'nalishlar faqat mavsumdagilar (o'chirilgani tushib qoladi)", () => {
    const items = SEASON.items.filter((i) => i.direction);
    expect(collectDirections(items).map((d) => d.titleUz)).toEqual([
      "Davolash ishi",
      "Stomatologiya",
    ]);
  });

  it("yo'nalish berilmasa — shakllar birlashmasi, dublikatsiz", () => {
    const items = SEASON.items.filter((i) => i.direction);
    expect(collectRefs(items, "educationForms").map((d) => d.titleUz)).toEqual([
      "Kunduzgi",
      "Sirtqi",
    ]);
  });

  it("yo'nalish berilsa — faqat o'shanga ruxsat etilgani", () => {
    const items = SEASON.items.filter((i) => i.direction);
    expect(collectRefs(items, "educationForms", "d2").map((d) => d.titleUz)).toEqual([
      "Kunduzgi",
    ]);
    expect(collectRefs(items, "educationLanguages", "d2").map((d) => d.titleUz)).toEqual([
      "Rus",
    ]);
  });

  it("mavsumda yo'q yo'nalish uchun ro'yxat bo'sh", () => {
    const items = SEASON.items.filter((i) => i.direction);
    expect(collectRefs(items, "educationForms", "d9")).toEqual([]);
  });

  it("mavsum bo'sh bo'lsa ro'yxatlar ham bo'sh", () => {
    expect(collectDirections([])).toEqual([]);
    expect(collectRefs([], "educationLanguages")).toEqual([]);
  });
});

describe("4.8 public — ariza mavsum shartlariga mos keladimi", () => {
  const ok = { direction: "d1", educationForm: "f2", educationLanguage: "l1" };

  it("mos ariza o'tadi", () => {
    expect(() => assertSeasonAllows(SEASON, ok)).not.toThrow();
  });

  it("shakl/til berilmasa ham o'tadi (ular ixtiyoriy)", () => {
    expect(() => assertSeasonAllows(SEASON, { direction: "d2" })).not.toThrow();
  });

  it("mavsumga kiritilmagan yo'nalish rad etiladi", () => {
    expect(() => assertSeasonAllows(SEASON, { direction: "d9" })).toThrow(
      /qabul e'lon qilinmagan/,
    );
  });

  it("yo'nalishga ruxsat etilmagan ta'lim shakli rad etiladi", () => {
    expect(() => assertSeasonAllows(SEASON, { direction: "d2", educationForm: "f2" })).toThrow(
      /ta'lim shakli/,
    );
  });

  it("yo'nalishga ruxsat etilmagan til rad etiladi", () => {
    expect(() =>
      assertSeasonAllows(SEASON, { direction: "d2", educationLanguage: "l1" }),
    ).toThrow(/ta'lim tili/);
  });

  it("mavsum bo'sh bo'lsa har qanday yo'nalish rad etiladi", () => {
    expect(() => assertSeasonAllows({ items: [] }, ok)).toThrow(/qabul e'lon qilinmagan/);
  });
});
