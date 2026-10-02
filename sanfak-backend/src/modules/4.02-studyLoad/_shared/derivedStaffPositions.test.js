const { deriveStaffPositions, NORM_TO_TABLE_SLUG } = require("./derivedStaffPositions");

describe("NORM_TO_TABLE_SLUG — xarita", () => {
  test("5 norma slugi → staff-table (teachingStaff) slugiga mos", () => {
    expect(NORM_TO_TABLE_SLUG).toEqual({
      professor: "professor",
      docent: "docent",
      senior_teacher: "seniorTeacher",
      assistant: "assistant",
      trainee: "trainee",
    });
  });
});

describe("deriveStaffPositions — blanka sonlari (5-bet)", () => {
  const teachers = [
    { position: "docent", stavka: 0.5, blocks: [{ totalHour: 325 }] },
    { position: "senior_teacher", stavka: 1, blocks: [{ totalHour: 750 }] },
    { position: "assistant", stavka: 33, blocks: [{ totalHour: 14000 }] },
    { position: "assistant", stavka: 0.5, blocks: [{ totalHour: 14608 }] },
  ];
  const positionNorms = { docent: 650, senior_teacher: 750, assistant: 850 };

  test("har slug uchun positions/load/totalHours to'g'ri", () => {
    const sp = deriveStaffPositions({ teachers, positionNorms });
    const byLug = Object.fromEntries(sp.items.map((it) => [it.slug, it]));

    expect(byLug.docent).toMatchObject({
      category: "teachingStaff",
      positions: 0.5,
      load: 650,
      totalHours: 325,
    });
    expect(byLug.seniorTeacher).toMatchObject({
      category: "teachingStaff",
      positions: 1,
      load: 750,
      totalHours: 750,
    });
    expect(byLug.assistant).toMatchObject({
      category: "teachingStaff",
      positions: 33.5,
      load: 850,
      totalHours: 28608,
    });
    expect(byLug.professor).toBeUndefined();
  });

  test("totalPositions = 35 (Kengash #1 — floor(hours/base) EMAS)", () => {
    const sp = deriveStaffPositions({ teachers, positionNorms });
    expect(sp.totalPositions).toBe(35);
  });

  test("Jami soat yig'indisi = 29683 (325+750+28608, asosiy jadval JAMI bilan mos)", () => {
    const sp = deriveStaffPositions({ teachers, positionNorms });
    const totalHours = sp.items.reduce((s, it) => s + it.totalHours, 0);
    expect(totalHours).toBe(29683);
  });
});

describe("deriveStaffPositions — Kengash #3: lavozimi noma'lum o'qituvchi", () => {
  test("unclassified'ga tushadi, 'assistant'ga QO'SHIB YUBORILMAYDI, item yaratilmaydi", () => {
    const teachers = [
      { position: "assistant", stavka: 1, blocks: [{ totalHour: 400 }] },
      { position: null, stavka: 0.75, blocks: [{ totalHour: 200 }] },
      { stavka: 0.25, blocks: [{ totalHour: 50 }] },
      { position: "noma'lum_lavozim", stavka: 0.5, blocks: [{ totalHour: 80 }] },
    ];
    const sp = deriveStaffPositions({ teachers, positionNorms: { assistant: 400 } });

    const assistantItem = sp.items.find((it) => it.slug === "assistant");
    expect(assistantItem.positions).toBe(1);
    expect(assistantItem.totalHours).toBe(400);

    expect(sp.meta.unclassified.positions).toBe(1.5);
    expect(sp.meta.unclassified.totalHours).toBe(330);

    expect(sp.totalPositions).toBe(1);
  });
});

describe("deriveStaffPositions — Kengash #4: vakant", () => {
  test("ish o'rniga kirmaydi, lekin soati meta.vacantHours'ga yig'iladi", () => {
    const teachers = [
      { position: "assistant", stavka: 1, blocks: [{ totalHour: 400 }] },
      { isVacant: true, stavka: 1, blocks: [{ totalHour: 300 }, { totalHour: 50 }] },
    ];
    const sp = deriveStaffPositions({ teachers, positionNorms: { assistant: 400 } });

    const assistantItem = sp.items.find((it) => it.slug === "assistant");
    expect(assistantItem.positions).toBe(1);
    expect(sp.totalPositions).toBe(1);
    expect(sp.meta.vacantHours).toBe(350);
  });
});

describe("deriveStaffPositions — blok darajasida yig'indi (Kengash #5 egizagi)", () => {
  test("hours = Σ blocks[].totalHour, ENTRY.totalHour EMAS (drift himoyasi)", () => {
    const teachers = [
      {
        position: "assistant",
        stavka: 1,
        totalHour: 999999,
        blocks: [{ totalHour: 100 }, { totalHour: 150 }],
      },
    ];
    const sp = deriveStaffPositions({ teachers, positionNorms: { assistant: 400 } });
    expect(sp.items.find((it) => it.slug === "assistant").totalHours).toBe(250);
  });
});

describe("deriveStaffPositions — float yaxlitlash (0.25 qadam)", () => {
  test("13 × 0.25 stavka = 3.25, ikkilik float xatosiz", () => {
    const teachers = Array.from({ length: 13 }, () => ({
      position: "assistant",
      stavka: 0.25,
      blocks: [{ totalHour: 10 }],
    }));
    const sp = deriveStaffPositions({ teachers, positionNorms: { assistant: 400 } });
    expect(sp.items.find((it) => it.slug === "assistant").positions).toBe(3.25);
    expect(sp.totalPositions).toBe(3.25);
  });
});

describe("deriveStaffPositions — bo'sh taqsimot", () => {
  test("teachers=[] → null (chaqiruvchi zaxira manbaga qaytadi)", () => {
    expect(deriveStaffPositions({ teachers: [], positionNorms: {} })).toBeNull();
  });

  test("faqat vakant (biriktirilgan o'qituvchi yo'q) → null", () => {
    const teachers = [{ isVacant: true, stavka: 1, blocks: [{ totalHour: 100 }] }];
    expect(deriveStaffPositions({ teachers, positionNorms: {} })).toBeNull();
  });

  test("teachers berilmasa (undefined) → null", () => {
    expect(deriveStaffPositions({ positionNorms: {} })).toBeNull();
  });
});

describe("deriveStaffPositions — Kengash #2: manual departmentHead/supportStaff", () => {
  const teachers = [{ position: "professor", stavka: 1, blocks: [{ totalHour: 300 }] }];
  const manualItems = [
    { category: "departmentHead", slug: "docent", title: "Kafedra mudiri", positions: 1, load: 650, totalHours: 650 },
    { category: "supportStaff", slug: "laborant", title: "Laborant", positions: 2, load: 0, totalHours: 0 },
    { category: "teachingStaff", slug: "assistant", title: "Assistent", positions: 99, load: 0, totalHours: 0 },
  ];

  test("departmentHead/supportStaff o'zgarishsiz items'ga qo'shiladi", () => {
    const sp = deriveStaffPositions({ teachers, positionNorms: { professor: 300 }, manualItems });
    expect(sp.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "departmentHead", slug: "docent", positions: 1 }),
        expect.objectContaining({ category: "supportStaff", slug: "laborant", positions: 2 }),
      ]),
    );
  });

  test("manual teachingStaff (assistant:99) E'TIBORGA OLINMAYDI — faqat hosila chiqadi", () => {
    const sp = deriveStaffPositions({ teachers, positionNorms: { professor: 300 }, manualItems });
    const teachingItems = sp.items.filter((it) => it.category === "teachingStaff");
    expect(teachingItems).toHaveLength(1);
    expect(teachingItems[0]).toMatchObject({ slug: "professor", positions: 1 });
    expect(sp.items.find((it) => it.slug === "assistant")).toBeUndefined();
  });

  test("totalPositions = hosila(1) + manual(1+2) = 4", () => {
    const sp = deriveStaffPositions({ teachers, positionNorms: { professor: 300 }, manualItems });
    expect(sp.totalPositions).toBe(4);
  });
});
