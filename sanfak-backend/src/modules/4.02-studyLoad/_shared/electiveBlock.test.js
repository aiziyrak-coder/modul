const {
  isElectiveBlock,
  isPracticeEntry,
  isSupervisedPractice,
  moduleTypeLabel,
  MODULE_TYPE,
} = require("./electiveBlock");

describe("electiveBlock — jonli ma'lumot (MFI / TF2)", () => {
  test("TF2 + 'Tanlov fanlari' → tanlov", () => {
    expect(
      isElectiveBlock({ blockCode: "TF2", title: "Tanlov fanlari" }),
    ).toBe(true);
  });

  test("MFI + 'Majburiy fanlar' → majburiy", () => {
    expect(
      isElectiveBlock({ blockCode: "MFI", title: "Majburiy fanlar" }),
    ).toBe(false);
  });
});

describe("electiveBlock — generatsiya qilingan kod (BLK{N})", () => {
  test("BLK2 title'siz ham tanlov (eski startsWith('T') buni o'tkazib yuborardi)", () => {
    expect(isElectiveBlock({ blockCode: "BLK2", title: "" })).toBe(true);
  });

  test("BLK1 title'siz — majburiy", () => {
    expect(isElectiveBlock({ blockCode: "BLK1", title: "" })).toBe(false);
  });

  test("BLK3 — noma'lum blok majburiy ustunda qoladi (konservativ)", () => {
    expect(isElectiveBlock({ blockCode: "BLK3", title: null })).toBe(false);
  });

  test("kichik harf va bo'sh joy normallashtiriladi", () => {
    expect(isElectiveBlock({ blockCode: " blk2 " })).toBe(true);
    expect(isElectiveBlock({ blockCode: " tf2 " })).toBe(true);
  });
});

describe("electiveBlock — title ustunligi", () => {
  test("kod noma'lum bo'lsa ham 'Tanlov modullar' tanlov deb aniqlanadi", () => {
    expect(
      isElectiveBlock({ blockCode: "XYZ", title: "Tanlov modullar" }),
    ).toBe(true);
  });

  test("'Majburiy' title BLK2 kodidan ustun turadi", () => {
    expect(
      isElectiveBlock({ blockCode: "BLK2", title: "Majburiy fanlar" }),
    ).toBe(false);
  });
});

describe("electiveBlock — chegaraviy holatlar", () => {
  test.each([null, undefined, {}])("%p → false (xato bermaydi)", (input) => {
    expect(isElectiveBlock(input)).toBe(false);
  });

  test("legacy 'T' prefiksi saqlanadi", () => {
    expect(isElectiveBlock({ blockCode: "T1" })).toBe(true);
  });
});

describe("moduleTypeLabel — 142-son §1 'Fan/modul turi'", () => {
  test("tanlov bloki → 'Tanlov'", () => {
    expect(moduleTypeLabel({ blockCode: "TF2", title: "Tanlov fanlari" })).toBe(
      MODULE_TYPE.ELECTIVE,
    );
    expect(moduleTypeLabel({ blockCode: "BLK2" })).toBe("Tanlov");
  });

  test("majburiy blok → 'Majburiy'", () => {
    expect(moduleTypeLabel({ blockCode: "MFI", title: "Majburiy fanlar" })).toBe(
      MODULE_TYPE.MANDATORY,
    );
    expect(moduleTypeLabel({ blockCode: "BLK1" })).toBe("Majburiy");
  });

  test("blok berilmasa null — maydon to'ldirilmaydi (xato qiymat emas)", () => {
    expect(moduleTypeLabel(null)).toBeNull();
    expect(moduleTypeLabel(undefined)).toBeNull();
  });

  test("hech qachon XOM blockCode qaytarmaydi", () => {
    for (const code of ["TF2", "MFI", "BLK1", "BLK2", "XYZ"]) {
      expect(Object.values(MODULE_TYPE)).toContain(
        moduleTypeLabel({ blockCode: code }),
      );
    }
  });
});

describe("isElectiveBlock — amaliyot/attestatsiya bloki (2026-08-21)", () => {
  test("nomi 'Amaliyot va attestatsiya', kodi TF2 → TANLOV EMAS", () => {
    expect(
      isElectiveBlock({ blockCode: "TF2", title: "Amaliyot va attestatsiya" }),
    ).toBe(false);
  });

  test("nomida 'amaliyot' bo'lsa kod TF/T bilan boshlansa ham tanlov emas", () => {
    for (const code of ["TF2", "TF3", "T1", "TX"]) {
      expect(
        isElectiveBlock({ blockCode: code, title: "Malakaviy amaliyot" }),
      ).toBe(false);
    }
  });

  test("nomida 'attestatsiya' bo'lsa ham tanlov emas", () => {
    expect(
      isElectiveBlock({ blockCode: "TF2", title: "Yakuniy davlat attestatsiyasi" }),
    ).toBe(false);
  });

  test("ochiq 'Tanlov' yorlig'i USTUN — aralash nomda tanlov qoladi", () => {
    expect(
      isElectiveBlock({ blockCode: "AM2", title: "Tanlov fanlari (amaliyot)" }),
    ).toBe(true);
  });

  test("REGRESSIYA: haqiqiy tanlov bloki hamon TANLOV", () => {
    expect(isElectiveBlock({ blockCode: "TF3", title: "Tanlov fanlari" })).toBe(true);
    expect(isElectiveBlock({ blockCode: "TF2", title: "Tanlov fanlari" })).toBe(true);
    expect(isElectiveBlock({ blockCode: "BLK2", title: "" })).toBe(true);
  });

  test("REGRESSIYA: majburiy blok hamon MAJBURIY", () => {
    expect(isElectiveBlock({ blockCode: "MFI", title: "Majburiy fanlar" })).toBe(false);
  });

  test("moduleTypeLabel ham amaliyot blokida 'Majburiy' beradi", () => {
    expect(
      moduleTypeLabel({ blockCode: "TF2", title: "Amaliyot va attestatsiya" }),
    ).toBe(MODULE_TYPE.MANDATORY);
  });
});

describe("isPracticeEntry — jonli amaliyot kodlari (institute-demo, 2026-08-20 o'lchovi)", () => {
  test.each([
    "MM2-520",
    "TM104",
    "ICHM204",
    "ICHM206",
    "ICHM304",
    "ICHM404",
    "ICHM505",
    "BOM504",
    "BOM604",
    "BAKYDA604",
  ])("kod '%s' + oddiy nom -> amaliyot (true)", (code) => {
    expect(isPracticeEntry({ code, title: "Fan nomi" })).toBe(true);
  });

  test("scienceCode maydoni ham qabul qilinadi (code o'rniga)", () => {
    expect(isPracticeEntry({ scienceCode: "MM2-520" })).toBe(true);
  });

  test("code USTUN turadi — ikkalasi ham bo'lsa code ishlatiladi", () => {
    expect(isPracticeEntry({ code: "TM104", scienceCode: "FA1002" })).toBe(true);
  });

  test("kod kichik harfda ham ishlaydi (regex /i)", () => {
    expect(isPracticeEntry({ code: "mm2-520" })).toBe(true);
    expect(isPracticeEntry({ code: "bakyda604" })).toBe(true);
  });
});

describe("isPracticeEntry — nomi bo'yicha, kod yo'q/nomaʼlum", () => {
  test.each([
    "Malakaviy amaliyot",
    "Ishlab chiqarish amaliyoti",
    "Tanishuv amaliyoti",
    "Bitiruv oldi amaliyoti",
    "Yakuniy davlat attestatsiyasi",
  ])("nomi '%s', kodi yo'q -> amaliyot (true)", (title) => {
    expect(isPracticeEntry({ title })).toBe(true);
  });

  test("nom ustuvor — kod naqshga mos kelmasa ham nomdagi 'amaliyot' yetarli", () => {
    expect(isPracticeEntry({ code: "XYZ999", title: "Malakaviy amaliyot" })).toBe(
      true,
    );
  });
});

describe("isPracticeEntry — oddiy fanlar (amaliyot EMAS)", () => {
  test("FA1002 + 'Kommunal gigiyena' -> false", () => {
    expect(
      isPracticeEntry({ code: "FA1002", title: "Kommunal gigiyena" }),
    ).toBe(false);
  });

  test("AN11-312 + 'Odam anatomiyasi' -> false", () => {
    expect(
      isPracticeEntry({ code: "AN11-312", title: "Odam anatomiyasi" }),
    ).toBe(false);
  });

  test("kod ham, nom ham amaliyot naqshiga mos kelmasa -> false", () => {
    expect(isPracticeEntry({ code: "BLK2", title: "Tanlov fanlari" })).toBe(
      false,
    );
  });
});

describe("isPracticeEntry — chegaraviy holatlar (xato bermaydi)", () => {
  test.each([null, undefined, {}])("%p -> false", (input) => {
    expect(isPracticeEntry(input)).toBe(false);
  });

  test("bo'sh code va title -> false", () => {
    expect(isPracticeEntry({ code: "", title: "" })).toBe(false);
  });

  test("code/title bo'sh joy bilan o'ralgan bo'lsa ham to'g'ri aniqlanadi", () => {
    expect(isPracticeEntry({ code: "  MM2-520  " })).toBe(true);
    expect(isPracticeEntry({ title: "  Malakaviy amaliyot  " })).toBe(true);
  });
});

describe("isSupervisedPractice — attestatsiya amaliyotdan ajratiladi", () => {
  test.each([
    ["Malakaviy amaliyot", "MM2-520"],
    ["Tanishuv amaliyoti", "TM104"],
    ["Ishlab chiqarish amaliyoti", "ICHM204"],
    ["Bitiruv oldi amaliyoti", "BOM504"],
  ])("amaliyot: %s (%s) -> true", (title, code) => {
    expect(isSupervisedPractice({ title, code })).toBe(true);
  });

  test("attestatsiya nomi bo'yicha -> false (soat yig'ilmaydi)", () => {
    const entry = {
      title: "Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi",
      code: "BAKYDA604",
    };
    expect(isPracticeEntry(entry)).toBe(true);
    expect(isSupervisedPractice(entry)).toBe(false);
  });

  test("nomi bo'lmasa BAKYDA kodi bo'yicha -> false", () => {
    expect(isPracticeEntry({ code: "BAKYDA604" })).toBe(true);
    expect(isSupervisedPractice({ code: "BAKYDA604" })).toBe(false);
  });

  test("oddiy fan -> false (umuman amaliyot emas)", () => {
    expect(isSupervisedPractice({ title: "Odam anatomiyasi", code: "AN11-312" })).toBe(
      false,
    );
  });

  test.each([null, undefined, {}])("%p -> false", (input) => {
    expect(isSupervisedPractice(input)).toBe(false);
  });
});

describe("isElectiveSlotRow — amaliyot tanlov bloki ichida ham TANLOV EMAS", () => {
  const { isElectiveSlotRow } = require("./electiveBlock");
  const TF2 = { blockCode: "TF2", title: "Tanlov fanlar" };
  const MF1 = { blockCode: "MF1", title: "Majburiy fanlar" };

  test.each([
    ["TM104", "Tanishuv amaliyoti"],
    ["ICHM206", "Ishlab chiqarish amaliyoti"],
    ["BOM604", "Bitiruv oldi amaliyoti"],
    ["BAKYDA604", "Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi"],
  ])("TF2 ichidagi %s (%s) — tanlov sloti EMAS", (code, title) => {
    expect(isElectiveSlotRow(TF2, { code, title })).toBe(false);
  });

  test("TF2 ichidagi HAQIQIY fan — tanlov sloti", () => {
    expect(isElectiveSlotRow(TF2, { code: "TN1104", title: "Bioetika" })).toBe(
      true,
    );
  });

  test("MAJBURIY blokdagi fan hech qachon tanlov sloti emas", () => {
    expect(isElectiveSlotRow(MF1, { code: "FS1104", title: "Falsafa" })).toBe(
      false,
    );
  });

  test("qator yo'q bo'lsa — blok qaroriga qaytadi (mavjud xulq)", () => {
    expect(isElectiveSlotRow(TF2, null)).toBe(true);
    expect(isElectiveSlotRow(MF1, null)).toBe(false);
  });
});
