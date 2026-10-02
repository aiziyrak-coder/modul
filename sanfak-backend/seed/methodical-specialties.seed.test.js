const {
  SPECIALTIES,
  missingSpecialties,
  obsoleteSpecialties,
  norm,
} = require("./methodical-specialties.seed");

const asDocs = (pairs) => pairs.map(([code, name]) => ({ code, name }));

describe("Ixtisosliklar seedi — yetishmayotganini aniqlash", () => {
  it("bo'sh lug'atda hammasi qo'shiladi", () => {
    expect(missingSpecialties([])).toEqual(SPECIALTIES);
  });

  it("mavjud yozuvlar o'tkazib yuboriladi", () => {
    const res = missingSpecialties(asDocs(SPECIALTIES.slice(0, 2)));
    expect(res).toHaveLength(SPECIALTIES.length - 2);
    expect(res.map(([c]) => c)).not.toContain(SPECIALTIES[0][0]);
  });

  it("bo'shliq va registr farqi hisobga olinmaydi", () => {
    const [code, name] = SPECIALTIES[0];
    const res = missingSpecialties([{ code: ` ${code} `, name: name.toUpperCase() }]);
    expect(res.map(([c]) => c)).not.toContain(code);
  });

  it("hammasi bor bo'lsa — bo'sh", () => {
    expect(missingSpecialties(asDocs(SPECIALTIES))).toEqual([]);
  });

  it("shifri bir xil, NOMI boshqa yozuv — rasmiysi baribir qo'shiladi", () => {
    const [code] = SPECIALTIES[0];
    const res = missingSpecialties([{ code, name: "Butunlay boshqa nom" }]);
    expect(res.map(([c]) => c)).toContain(code);
  });

  it("lug'atdagi begona yozuv ro'yxatni buzmaydi", () => {
    const res = missingSpecialties([...asDocs(SPECIALTIES), { code: "99.99.99", name: "Begona" }]);
    expect(res).toEqual([]);
  });
});

describe("Ixtisosliklar seedi — eskirganini aniqlash", () => {
  it("rasmiy ro'yxatdagi yozuv eskirgan emas", () => {
    expect(obsoleteSpecialties(asDocs(SPECIALTIES.slice(0, 5)))).toEqual([]);
  });

  it("shifri bor, nomi boshqa yozuv — ESKIRGAN", () => {
    const [code] = SPECIALTIES[0];
    const doc = { code, name: "Terapiya" };
    expect(obsoleteSpecialties([doc])).toEqual([doc]);
  });

  it("ro'yxatda umuman yo'q yozuv — ESKIRGAN", () => {
    const doc = { code: "121212", name: "Medical Journal" };
    expect(obsoleteSpecialties([doc])).toEqual([doc]);
  });

  it("bo'sh lug'atda eskirgan yo'q", () => {
    expect(obsoleteSpecialties([])).toEqual([]);
  });
});

describe("OAK-2022 ro'yxatining yaxlitligi", () => {
  it("shifr takrorlanmaydi", () => {
    const codes = SPECIALTIES.map(([c]) => norm(c));
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("nom ham takrorlanmaydi — qayta ulash NOM bo'yicha ishlaydi", () => {
    const names = SPECIALTIES.map(([, n]) => norm(n));
    expect(new Set(names).size).toBe(names.length);
  });

  it("har bir yozuvda shifr NN.NN.NN ko'rinishida, nomi bo'sh emas", () => {
    SPECIALTIES.forEach(([code, name]) => {
      expect(code).toMatch(/^\d{2}\.\d{2}\.\d{2}$/);
      expect(name.length).toBeGreaterThan(2);
    });
  });

  it("guruh shifri (NN.NN.00) ro'yxatga tushmagan", () => {
    expect(SPECIALTIES.filter(([c]) => c.endsWith(".00"))).toEqual([]);
  });

  it("nomlarda kirill harflari qolmagan", () => {
    const cyrillic = SPECIALTIES.filter(([, n]) => /[А-Яа-яЎўҒғҚқҲҳЁё]/.test(n));
    expect(cyrillic).toEqual([]);
  });

  it("tibbiyot (14.xx) va farmatsevtika (15.xx) to'liq", () => {
    expect(SPECIALTIES.filter(([c]) => c.startsWith("14."))).toHaveLength(43);
    expect(SPECIALTIES.filter(([c]) => c.startsWith("15."))).toHaveLength(3);
  });
});
