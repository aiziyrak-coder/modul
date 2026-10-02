"use strict";

const {
  resolveSignatory,
  formatUzDateQuoted,
  BLANK_DATE,
  personName,
} = require("./signatories");

const approved = (step, overrides = {}) => ({
  step,
  status: "approved",
  approvedBy: { lastName: "Boltaboyev", firstName: "Ulug'bek" },
  date: new Date(2026, 8, 3),
  ...overrides,
});

describe("resolveSignatory — ustuvorlik: manual → chain → none", () => {
  test("qo'lda blok populate qilingan bo'lsa — manual manba, ism familiya+ism", () => {
    const doc = {
      confirmation: {
        rector: { lastName: "Karimov", firstName: "R." },
        date: null,
      },
      approvalSteps: [approved("rektor")],
    };
    const sig = resolveSignatory(doc, {
      step: "rektor",
      block: "confirmation",
      personField: "rector",
    });
    expect(sig.source).toBe("manual");
    expect(sig.name).toBe("R.Karimov");
  });

  test("qo'lda blok bo'sh, zanjir bosqichi approved bo'lsa — chain manba", () => {
    const doc = {
      confirmation: {},
      approvalSteps: [approved("prorektor")],
    };
    const sig = resolveSignatory(doc, {
      step: "prorektor",
      block: "confirmation",
      personField: "viceRector",
    });
    expect(sig.source).toBe("chain");
    expect(sig.name).toBe("U.Boltaboyev");
  });

  test("qo'lda blok yo'q (block: null) — to'g'ridan-to'g'ri zanjirdan o'qiydi", () => {
    const doc = { approvalSteps: [approved("dean")] };
    const sig = resolveSignatory(doc, { step: "dean" });
    expect(sig.source).toBe("chain");
    expect(sig.name).toBe("U.Boltaboyev");
  });

  test("hech biri yo'q — none manba, ism bo'sh, sana shablon", () => {
    const doc = { confirmation: {}, approvalSteps: [] };
    const sig = resolveSignatory(doc, {
      step: "prorektor",
      block: "confirmation",
      personField: "viceRector",
    });
    expect(sig).toEqual({
      name: "",
      date: null,
      dateText: BLANK_DATE,
      source: "none",
    });
  });
});

describe("resolveSignatory — snapshot 0-manba (ADR-020, WP-B)", () => {
  test("snapshot bor step'da — manual/chain BOSIB O'TILADI (R-4.02-22 yopilish mezoni)", () => {
    const doc = {
      confirmation: {
        rector: { lastName: "Karimov", firstName: "R." },
        date: null,
      },
      approvalSteps: [approved("rektor")],
    };
    const sig = resolveSignatory(doc, {
      step: "rektor",
      block: "confirmation",
      personField: "rector",
      snapshot: [
        { step: "rektor", label: "Rektor", shortName: "U. Eski", date: new Date(2026, 0, 1) },
      ],
    });
    expect(sig.source).toBe("snapshot");
    expect(sig.name).toBe("U. Eski");
    expect(sig.name).not.toBe("R.Karimov");
    expect(sig.name).not.toBe("U.Boltaboyev");
  });

  test("snapshot berilgan, lekin shu step unda YO'Q — manual/chain zaxirasiga tushadi", () => {
    const doc = {
      confirmation: {},
      approvalSteps: [approved("prorektor")],
    };
    const sig = resolveSignatory(doc, {
      step: "prorektor",
      block: "confirmation",
      personField: "viceRector",
      snapshot: [{ step: "rektor", shortName: "Boshqa", date: new Date() }],
    });
    expect(sig.source).toBe("chain");
    expect(sig.name).toBe("U.Boltaboyev");
  });

  test("B4 (2026-09-08) — ESKI snapshot shortName (probel bilan yozilgan) o'qishda QAYTA formatlanmaydi (ADR-020 muzlatilgan)", () => {
    const doc = { approvalSteps: [] };
    const sig = resolveSignatory(doc, {
      step: "rektor",
      snapshot: [
        { step: "rektor", shortName: "U. Boltaboyev", date: new Date(2026, 7, 1) },
      ],
    });
    expect(sig.source).toBe("snapshot");
    expect(sig.name).toBe("U. Boltaboyev");
  });

  test("snapshot umuman berilmasa — xulq ANIQ ADR-019 dagidek (manual/chain/none)", () => {
    const doc = {
      confirmation: { rector: { lastName: "Karimov", firstName: "R." }, date: null },
      approvalSteps: [approved("rektor")],
    };
    const sig = resolveSignatory(doc, {
      step: "rektor",
      block: "confirmation",
      personField: "rector",
    });
    expect(sig.source).toBe("manual");
    expect(sig.name).toBe("R.Karimov");
  });

  test("snapshot yozuvida shortName bo'sh bo'lsa ham — source hamon snapshot (manual/chain bosib o'tilgan)", () => {
    const doc = {
      confirmation: { rector: { lastName: "Karimov", firstName: "R." }, date: null },
      approvalSteps: [approved("rektor")],
    };
    const sig = resolveSignatory(doc, {
      step: "rektor",
      block: "confirmation",
      personField: "rector",
      snapshot: [{ step: "rektor", shortName: "", date: null }],
    });
    expect(sig.source).toBe("snapshot");
    expect(sig.name).toBe("");
    expect(sig.dateText).toBe(BLANK_DATE);
  });
});

describe("resolveSignatory — xom ObjectId hech qachon chizilmaydi", () => {
  test("populate qilinmagan ObjectId (lastName/firstName yo'q) — manual deb sanalmaydi", () => {
    const rawId = { toString: () => "6a7d69082200e50d919e2b3a" };
    const doc = {
      confirmation: { rector: rawId },
      approvalSteps: [],
    };
    const sig = resolveSignatory(doc, {
      step: "rektor",
      block: "confirmation",
      personField: "rector",
    });
    expect(sig.source).toBe("none");
    expect(sig.name).toBe("");
  });

  test("qo'lda blok `date`si xom ObjectId ko'rinishida bo'lsa — qiymat sifatida qabul qilinmaydi", () => {
    const doc = {
      confirmation: {
        rector: { lastName: "Karimov", firstName: "R." },
        date: "6a7d69082200e50d919e2b3a",
      },
      approvalSteps: [],
    };
    const sig = resolveSignatory(doc, {
      step: "rektor",
      block: "confirmation",
      personField: "rector",
    });
    expect(sig.source).toBe("manual");
    expect(sig.dateText).toBe(BLANK_DATE);
  });

  test("zanjirda approvedBy populate qilinmagan bo'lsa — ism bo'sh (source hamon chain)", () => {
    const doc = {
      approvalSteps: [
        { step: "financial", status: "approved", approvedBy: null, date: new Date() },
      ],
    };
    const sig = resolveSignatory(doc, { step: "financial" });
    expect(sig.source).toBe("chain");
    expect(sig.name).toBe("");
  });
});

describe("resolveSignatory — placeholder shablon (`___`) qo'lda qiymat sifatida qabul qilinmaydi", () => {
  test("qo'lda `date` shablon matni bo'lsa (`___` bor) — BLANK_DATE ishlatiladi", () => {
    const doc = {
      confirmation: {
        rector: { lastName: "Karimov", firstName: "R." },
        date: "202__ yil “___” ________",
      },
      approvalSteps: [],
    };
    const sig = resolveSignatory(doc, {
      step: "rektor",
      block: "confirmation",
      personField: "rector",
    });
    expect(sig.dateText).toBe(BLANK_DATE);
  });

  test("qo'lda `date` haqiqiy matn bo'lsa (`___` yo'q) — o'zi ishlatiladi", () => {
    const doc = {
      confirmation: {
        rector: { lastName: "Karimov", firstName: "R." },
        date: "2026-yil 1-sentabr",
      },
      approvalSteps: [],
    };
    const sig = resolveSignatory(doc, {
      step: "rektor",
      block: "confirmation",
      personField: "rector",
    });
    expect(sig.dateText).toBe("2026-yil 1-sentabr");
  });
});

describe("resolveSignatory — pending/rejected bosqich → bo'sh (imzolanmagan hujjat imzolangandek ko'rinmaydi)", () => {
  test.each(["pending", "rejected"])("status=%s → source none", (status) => {
    const doc = {
      approvalSteps: [
        { step: "kafedra", status, approvedBy: { lastName: "X", firstName: "Y" }, date: new Date() },
      ],
    };
    const sig = resolveSignatory(doc, { step: "kafedra" });
    expect(sig.source).toBe("none");
    expect(sig.name).toBe("");
    expect(sig.dateText).toBe(BLANK_DATE);
  });

  test("bosqich umuman topilmasa (step ro'yxatda yo'q) — throw qilmaydi, none qaytadi", () => {
    const doc = { approvalSteps: [{ step: "kafedra", status: "approved" }] };
    expect(() => resolveSignatory(doc, { step: "rektor" })).not.toThrow();
    expect(resolveSignatory(doc, { step: "rektor" }).source).toBe("none");
  });
});

describe("resolveSignatory — hech qachon throw qilmaydi", () => {
  test("doc null/undefined bo'lsa ham xato otilmaydi", () => {
    expect(() => resolveSignatory(null, { step: "rektor" })).not.toThrow();
    expect(() => resolveSignatory(undefined, { step: "rektor" })).not.toThrow();
    expect(resolveSignatory(null, { step: "rektor" }).source).toBe("none");
  });

  test("opts berilmasa ham xato otilmaydi", () => {
    expect(() => resolveSignatory({ approvalSteps: [] })).not.toThrow();
  });

  test("approvalSteps massiv bo'lmasa (buzilgan hujjat) ham xato otilmaydi", () => {
    const doc = { approvalSteps: "buzilgan" };
    expect(() => resolveSignatory(doc, { step: "rektor" })).not.toThrow();
    expect(resolveSignatory(doc, { step: "rektor" }).source).toBe("none");
  });
});

describe("resolveSignatory — opts.steps override (B2-2, 2026-09-08, additiv)", () => {
  test("steps berilsa — doc.approvalSteps E'TIBORGA OLINMAYDI, steps massivi ishlatiladi", () => {
    const doc = {
      approvalSteps: [approved("prorektor", { approvedBy: { lastName: "Eski" } })],
    };
    const sig = resolveSignatory(doc, {
      step: "prorektor",
      steps: [approved("prorektor", { approvedBy: { lastName: "Yangi" } })],
    });
    expect(sig.source).toBe("chain");
    expect(sig.name).toBe("Yangi");
  });

  test("steps berilmasa (mavjud barcha chaqiruvchi) — doc.approvalSteps ishlatiladi (xulq o'zgarmaydi)", () => {
    const doc = { approvalSteps: [approved("rektor")] };
    const sig = resolveSignatory(doc, { step: "rektor" });
    expect(sig.source).toBe("chain");
    expect(sig.name).toBe("U.Boltaboyev");
  });

  test("steps massiv emas (masalan undefined) — doc.approvalSteps zaxirasiga tushadi", () => {
    const doc = { approvalSteps: [approved("dean")] };
    const sig = resolveSignatory(doc, { step: "dean", steps: undefined });
    expect(sig.source).toBe("chain");
  });

  test("workingSchedule naqshi: doc.approvalSteps YO'Q, faqat steps orqali (approvalHistory simulyatsiyasi)", () => {
    const doc = {};
    const sig = resolveSignatory(doc, {
      step: "methodical",
      steps: [approved("methodical", { approvedBy: { lastName: "Nodirov", firstName: "A." } })],
    });
    expect(sig.source).toBe("chain");
    expect(sig.name).toBe("A.Nodirov");
  });
});

describe("resolveSignatory — opts.compact (B2-2 2026-09-08 qo'shildi; B4 2026-09-08 dan buyon NO-OP — personName() defaulti allaqachon compact)", () => {
  test("compact:true — manual manbada ism probelsiz initsial+familiya", () => {
    const doc = {
      confirmation: {
        rector: { firstName: "Ravshan", middleName: "Qodir", lastName: "Aliyev" },
        date: null,
      },
    };
    const sig = resolveSignatory(doc, {
      step: "rektor",
      block: "confirmation",
      personField: "rector",
      compact: true,
    });
    expect(sig.source).toBe("manual");
    expect(sig.name).toBe("R.Q.Aliyev");
  });

  test("compact:true — chain manbada ham compact format", () => {
    const doc = {
      approvalSteps: [approved("dean")],
    };
    const sig = resolveSignatory(doc, { step: "dean", compact: true });
    expect(sig.source).toBe("chain");
    expect(sig.name).toBe("U.Boltaboyev");
  });

  test("B4: compact berilmasa/true/false — hammasi BIR XIL natija (opts.compact endi no-op)", () => {
    const doc = { approvalSteps: [approved("dean")] };
    const withoutOpt = resolveSignatory(doc, { step: "dean" }).name;
    const withTrue = resolveSignatory(doc, { step: "dean", compact: true }).name;
    const withFalse = resolveSignatory(doc, { step: "dean", compact: false }).name;
    expect(withoutOpt).toBe("U.Boltaboyev");
    expect(withTrue).toBe("U.Boltaboyev");
    expect(withFalse).toBe("U.Boltaboyev");
  });

  test("compact snapshot manbasiga TA'SIR QILMAYDI — entry.shortName DB'da muzlatilgan tayyor matn", () => {
    const doc = { approvalSteps: [] };
    const sig = resolveSignatory(doc, {
      step: "rektor",
      compact: true,
      snapshot: [{ step: "rektor", shortName: "R. Aliyev", date: new Date() }],
    });
    expect(sig.source).toBe("snapshot");
    expect(sig.name).toBe("R. Aliyev");
  });
});

describe("formatUzDateQuoted — sana formati (ADR-019 §7: tire bilan, KANONIK)", () => {
  test("yil-oy-kun to'g'ri chiqadi", () => {
    expect(formatUzDateQuoted(new Date(2026, 8, 3))).toBe(
      "2026-yil “ 3 ” sentabr",
    );
  });

  test("boshqa oy — to'g'ri nom", () => {
    expect(formatUzDateQuoted(new Date(2026, 0, 15))).toBe(
      "2026-yil “ 15 ” yanvar",
    );
  });
});

describe("personName — blanka F.I.O shakli, DEFAULT endi compact (B4, 2026-09-08 qaror — blanka: `U.A.Boltaboyev`, `A.A.Sidikov`)", () => {
  test("ism + familiya (middleName yo'q) — bosh harf+nuqta+familiya, probelsiz", () => {
    expect(personName({ firstName: "Shahnoza", lastName: "Qodirova" })).toBe(
      "S.Qodirova",
    );
  });

  test("ism + otasining ismi + familiya — ikkala bosh harf, probelsiz", () => {
    expect(
      personName({ firstName: "Anvar", middleName: "Qodir", lastName: "Sidiqov" }),
    ).toBe("A.Q.Sidiqov");
  });

  test("faqat familiya — o'zi qaytadi", () => {
    expect(personName({ lastName: "Qodirova" })).toBe("Qodirova");
  });

  test("faqat ism (familiya yo'q) — to'liq ism qaytadi, qisqartirilmaydi", () => {
    expect(personName({ firstName: "Anvar" })).toBe("Anvar");
  });

  test("ikkalasi ham bo'sh — bo'sh string", () => {
    expect(personName({})).toBe("");
  });

  test("apostrofli/digrafli ism — faqat BIRINCHI belgi olinadi", () => {
    expect(personName({ firstName: "O'tkir", lastName: "Rashidov" })).toBe(
      "O.Rashidov",
    );
    expect(personName({ firstName: "Shahzod", lastName: "Ergashev" })).toBe(
      "S.Ergashev",
    );
  });

  test("B4: `opts.compact` HAR QANDAY qiymatda (berilmasa/true/false) — bir xil (compact) natija (backward-compat no-op)", () => {
    const v = { firstName: "Anvar", middleName: "Qodir", lastName: "Sidiqov" };
    expect(personName(v)).toBe("A.Q.Sidiqov");
    expect(personName(v, {})).toBe("A.Q.Sidiqov");
    expect(personName(v, { compact: false })).toBe("A.Q.Sidiqov");
    expect(personName(v, { compact: true })).toBe("A.Q.Sidiqov");
  });
});

describe("personName — `compact:true` shakli `A.A.Sidikov` (2026-09-08 qaror, endi = DEFAULT bilan bir xil, B4)", () => {
  test("ism + otasining ismi + familiya — probelsiz, ikkala bosh harf", () => {
    expect(
      personName(
        { firstName: "Anvar", middleName: "Qodir", lastName: "Sidiqov" },
        { compact: true },
      ),
    ).toBe("A.Q.Sidiqov");
  });

  test("otasining ismi yo'q — `A.Sidikov` (bitta bosh harf, probelsiz)", () => {
    expect(
      personName({ firstName: "Anvar", lastName: "Sidiqov" }, { compact: true }),
    ).toBe("A.Sidiqov");
  });

  test("otasining ismi bo'sh string — `middleName` yo'qdek", () => {
    expect(
      personName(
        { firstName: "Anvar", middleName: "", lastName: "Sidiqov" },
        { compact: true },
      ),
    ).toBe("A.Sidiqov");
  });

  test("faqat familiya — o'zi qaytadi (compact ta'sir qilmaydi)", () => {
    expect(personName({ lastName: "Qodirova" }, { compact: true })).toBe(
      "Qodirova",
    );
  });

  test("faqat ism (familiya yo'q) — to'liq ism qaytadi", () => {
    expect(personName({ firstName: "Anvar" }, { compact: true })).toBe("Anvar");
  });

  test("ikkalasi ham bo'sh — bo'sh string", () => {
    expect(personName({}, { compact: true })).toBe("");
  });

  test("apostrofli otasining ismi — faqat BIRINCHI belgi olinadi", () => {
    expect(
      personName(
        { firstName: "Anvar", middleName: "O'tkir", lastName: "Sidiqov" },
        { compact: true },
      ),
    ).toBe("A.O.Sidiqov");
  });
});
