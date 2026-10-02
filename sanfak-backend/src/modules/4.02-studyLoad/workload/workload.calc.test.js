const { calculateBlockTotal, calcPerGroup } = require("./workload.model");

const buildStudyWork = () => ({
  group: 4,
  stream: 2,
  semester: 1,
  thisSemester: { totalHour: 0, auditoriumHour: 0 },
  classTypes: [
    { slug: "maruza", title: "Ma'ruza", stream: 30, total: 0 },
    { slug: "klinik_amaliyot", title: "Klinik", stream: 0, total: 0 },
    { slug: "laboratoriya", title: "Laboratoriya", stream: 20, total: 0 },
    { slug: "amaliy", title: "Amaliy", stream: 10, total: 0 },
  ],
  items: [
    {
      slug: "qoldirilgan",
      title: "Qoldirilgan dars",
      value: 5,
      overridden: true,
    },
    { slug: "malakaviy", title: "Malakaviy amaliyot", value: 3 },
  ],
});

const buildOtherWork = () => ({
  items: [{ slug: "qabul", title: "Qabul", value: 4 }],
});

describe("calculateBlockTotal — ko'paytiruvchi qoidasi (ma'ruza→oqim, boshqa→guruh)", () => {
  test("ma'ruza soati OQIM soniga ko'payadi", () => {
    const sw = buildStudyWork();
    calculateBlockTotal(sw, buildOtherWork(), 0);
    const maruza = sw.classTypes.find((c) => c.slug === "maruza");
    expect(maruza.total).toBe(30 * 2);
  });

  test("amaliy/laboratoriya soati GURUH soniga ko'payadi", () => {
    const sw = buildStudyWork();
    calculateBlockTotal(sw, buildOtherWork(), 0);
    const lab = sw.classTypes.find((c) => c.slug === "laboratoriya");
    const amaliy = sw.classTypes.find((c) => c.slug === "amaliy");
    expect(lab.total).toBe(20 * 4);
    expect(amaliy.total).toBe(10 * 4);
  });

  test("thisSemester.auditoriumHour = Σ ct.stream (REJA hajmi, ko'paytirilmagan)", () => {
    const sw = buildStudyWork();
    calculateBlockTotal(sw, buildOtherWork(), 0);
    expect(sw.thisSemester.auditoriumHour).toBe(30 + 0 + 20 + 10);
  });

  test("blok jami soati Σ ct.total dan quriladi (o'qituvchi yuklamasi)", () => {
    const sw = buildStudyWork();
    const total = calculateBlockTotal(sw, buildOtherWork(), 7);
    const teaching = 30 * 2 + 0 * 4 + 20 * 4 + 10 * 4;
    expect(total).toBe(teaching + 8 + 4 + 7);
  });

  test("thisSemester.totalHour = auditoriya + mustaqil ta'lim (items KIRMAYDI)", () => {
    const sw = buildStudyWork();
    sw.thisSemester.independentHour = 45;
    calculateBlockTotal(sw, buildOtherWork(), 7);
    expect(sw.thisSemester.totalHour).toBe(60 + 45);
  });

  test("independentHour berilmasa totalHour = auditoriya", () => {
    const sw = buildStudyWork();
    calculateBlockTotal(sw, buildOtherWork(), 0);
    expect(sw.thisSemester.totalHour).toBe(60);
  });

  test("idempotentlik: ikki marta chaqirilsa natija bir xil", () => {
    const sw = buildStudyWork();
    const ow = buildOtherWork();
    const first = calculateBlockTotal(sw, ow, 7);
    const second = calculateBlockTotal(sw, ow, 7);
    expect(second).toBe(first);
    expect(sw.thisSemester).toEqual(sw.thisSemester);
  });

  test("kirish maydonlari (stream, group, items[].value, otherWork, leadership) o'zgarmaydi", () => {
    const sw = buildStudyWork();
    const ow = buildOtherWork();
    calculateBlockTotal(sw, ow, 7);
    expect(sw.stream).toBe(2);
    expect(sw.group).toBe(4);
    expect(sw.classTypes.map((c) => c.stream)).toEqual([30, 0, 20, 10]);
    expect(sw.items.map((i) => i.value)).toEqual([5, 3]);
    expect(ow.items.map((i) => i.value)).toEqual([4]);
  });

  test("classTypes=[] bo'lsa auditoriumHour=0", () => {
    const sw = { group: 4, stream: 2, classTypes: [], items: [] };
    calculateBlockTotal(sw, { items: [] }, 0);
    expect(sw.thisSemester.auditoriumHour).toBe(0);
    expect(sw.thisSemester.totalHour).toBe(0);
  });

  test("streamCount=0 bo'lsa ma'ruza total=0 (nol bo'lish yo'q — xato tashlamaydi)", () => {
    const sw = {
      group: 4,
      stream: 0,
      classTypes: [{ slug: "maruza", stream: 30, total: 99 }],
      items: [],
    };
    calculateBlockTotal(sw, { items: [] }, 0);
    expect(sw.classTypes[0].total).toBe(0);
  });

  test("canonical mavjud bo'lsa slug'dan ustun (lecture canonical → oqim)", () => {
    const sw = {
      group: 4,
      stream: 2,
      classTypes: [
        { slug: "boshqa_nom", canonical: "lecture", stream: 10, total: 0 },
      ],
      items: [],
    };
    calculateBlockTotal(sw, { items: [] }, 0);
    expect(sw.classTypes[0].total).toBe(10 * 2);
  });
});

describe("calculateBlockTotal — ON/YAN avtomatik hisoblash (server, foydalanuvchi kiritmaydi)", () => {
  const buildOnYanItems = (onSeed = 999, yanSeed = 999) => [
    { slug: "on", title: "ON (1 tal. 0.2 soat)", value: onSeed },
    { slug: "yan", title: "YAN (1 tal. 0.3 soat)", value: yanSeed },
  ];

  const buildEligibleClassTypes = () => [
    { slug: "maruza", stream: 30, total: 0 },
    { slug: "amaliy", stream: 60, total: 0 },
  ];

  describe("calcPerGroup — PDF `blockToRow()` bilan bir xil formula", () => {
    test("student=55, group=2 → round(55/2)=28", () => {
      expect(calcPerGroup(55, 2)).toBe(28);
    });
    test("group=0 → 0 (bo'lishga urinmaydi)", () => {
      expect(calcPerGroup(55, 0)).toBe(0);
    });
    test("student=0 → 0", () => {
      expect(calcPerGroup(0, 2)).toBe(0);
    });
  });

  test("tasdiqlangan aniq qiymat: student=55 → ON=11, YAN=8", () => {
    const sw = {
      group: 2,
      stream: 1,
      classTypes: buildEligibleClassTypes(),
      items: buildOnYanItems(),
    };
    calculateBlockTotal(sw, { items: [] }, 0, 55);
    expect(sw.items.find((i) => i.slug === "on").value).toBe(11);
    expect(sw.items.find((i) => i.slug === "yan").value).toBe(8);
  });

  test("44 talaba, 8 guruh → ON=9 (yangi formula eski perGroup-formuladan farqlanadi)", () => {
    const sw = {
      group: 8,
      stream: 1,
      classTypes: buildEligibleClassTypes(),
      items: buildOnYanItems(),
    };
    calculateBlockTotal(sw, { items: [] }, 0, 44);
    expect(sw.items.find((i) => i.slug === "on").value).toBe(9);
  });

  test("group=0 (guruh topilmagan o'quv yili) — ON/YANga ENDI TA'SIR QILMAYDI (2026-09-02)", () => {
    const sw = { group: 0, stream: 1, classTypes: [], items: buildOnYanItems() };
    calculateBlockTotal(sw, { items: [] }, 0, 55);
    expect(sw.items.find((i) => i.slug === "on").value).toBe(0);
    expect(sw.items.find((i) => i.slug === "yan").value).toBe(8);
  });

  test("student=0 → ON=0, YAN=0", () => {
    const sw = { group: 2, stream: 1, classTypes: [], items: buildOnYanItems() };
    calculateBlockTotal(sw, { items: [] }, 0, 0);
    expect(sw.items.find((i) => i.slug === "on").value).toBe(0);
    expect(sw.items.find((i) => i.slug === "yan").value).toBe(0);
  });

  test("student berilmasa (default 0) — eski 3-argument chaqiruvlar buzilmaydi", () => {
    const sw = { group: 2, stream: 1, classTypes: [], items: buildOnYanItems() };
    calculateBlockTotal(sw, { items: [] }, 0);
    expect(sw.items.find((i) => i.slug === "on").value).toBe(0);
    expect(sw.items.find((i) => i.slug === "yan").value).toBe(0);
  });

  test("mavjud (eski) qiymat E'TIBORGA OLINMAY qayta hisoblanadi — `overridden` YO'Q bo'lsa", () => {
    const sw = {
      group: 1,
      stream: 1,
      classTypes: buildEligibleClassTypes(),
      items: buildOnYanItems(500, 500),
    };
    calculateBlockTotal(sw, { items: [] }, 0, 10);
    expect(sw.items.find((i) => i.slug === "on").value).toBe(2);
    expect(sw.items.find((i) => i.slug === "yan").value).toBe(2);
  });

  test("AUTO_CALCULATED_ITEM_SLUGS'da yo'q slug — xatolik yo'q, o'sha item'ga tegilmaydi", () => {
    const sw = {
      group: 2,
      stream: 1,
      classTypes: [],
      items: [{ slug: "malakaviy", value: 7 }],
    };
    expect(() => calculateBlockTotal(sw, { items: [] }, 0, 55)).not.toThrow();
    expect(sw.items[0].value).toBe(7);
  });
});

describe("ON — auditoriya chegarasi (> 71.99)", () => {
  const build = (streamHours) => ({
    group: 2,
    stream: 1,
    classTypes: [{ slug: "amaliy", stream: streamHours, total: 0 }],
    items: [
      { slug: "on", title: "ON", value: 0 },
      { slug: "yan", title: "YAN", value: 0 },
    ],
  });
  const onOf = (sw) => sw.items.find((i) => i.slug === "on").value;

  test("auditoriya 90 (> 71.99) → ON hisoblanadi", () => {
    const sw = build(90);
    calculateBlockTotal(sw, { items: [] }, 0, 55);
    expect(onOf(sw)).toBe(11);
  });

  test("auditoriya 60 (< 71.99) → ON=0", () => {
    const sw = build(60);
    calculateBlockTotal(sw, { items: [] }, 0, 55);
    expect(onOf(sw)).toBe(0);
  });

  test("chegara AYNAN: 72 → hisoblanadi, 71 → 0", () => {
    const yuqori = build(72);
    calculateBlockTotal(yuqori, { items: [] }, 0, 55);
    expect(onOf(yuqori)).toBe(11);

    const past = build(71);
    calculateBlockTotal(past, { items: [] }, 0, 55);
    expect(onOf(past)).toBe(0);
  });

  test("ON=0 bo'lganda ham YAN o'z qoidasi bo'yicha beriladi", () => {
    const sw = build(60);
    calculateBlockTotal(sw, { items: [] }, 0, 55);
    expect(sw.items.find((i) => i.slug === "yan").value).toBe(8);
  });
});

describe("YAN — oxirgi semestr qoidasi", () => {
  const build = (isLastSemester) => ({
    group: 2,
    stream: 1,
    isLastSemester,
    classTypes: [{ slug: "amaliy", stream: 90, total: 0 }],
    items: [
      { slug: "on", title: "ON", value: 0 },
      { slug: "yan", title: "YAN", value: 0 },
    ],
  });
  const yanOf = (sw) => sw.items.find((i) => i.slug === "yan").value;

  test("oxirgi semestr → YAN hisoblanadi", () => {
    const sw = build(true);
    calculateBlockTotal(sw, { items: [] }, 0, 55);
    expect(yanOf(sw)).toBe(8);
  });

  test("oraliq semestr → YAN=0", () => {
    const sw = build(false);
    calculateBlockTotal(sw, { items: [] }, 0, 55);
    expect(yanOf(sw)).toBe(0);
  });

  test("maydon yo'q (eski yozuv) → YAN beriladi (eski xatti-harakat saqlanadi)", () => {
    const sw = build(undefined);
    calculateBlockTotal(sw, { items: [] }, 0, 55);
    expect(yanOf(sw)).toBe(8);
  });

  test("YAN=0 bo'lganda ham ON o'z qoidasi bo'yicha beriladi", () => {
    const sw = build(false);
    calculateBlockTotal(sw, { items: [] }, 0, 55);
    expect(sw.items.find((i) => i.slug === "on").value).toBe(11);
  });
});

describe("overridden — qo'lda kiritilgan ON/YAN bosilmaydi", () => {
  const build = () => ({
    group: 2,
    stream: 1,
    classTypes: [{ slug: "amaliy", stream: 90, total: 0 }],
    items: [
      { slug: "on", title: "ON", value: 42, overridden: true },
      { slug: "yan", title: "YAN", value: 7, overridden: true },
    ],
  });

  test("overridden:true — avtomatik formula tegmaydi", () => {
    const sw = build();
    calculateBlockTotal(sw, { items: [] }, 0, 55);
    expect(sw.items.find((i) => i.slug === "on").value).toBe(42);
    expect(sw.items.find((i) => i.slug === "yan").value).toBe(7);
  });

  test("qo'lda kiritilgan qiymat jami soatga qo'shiladi", () => {
    const sw = build();
    const total = calculateBlockTotal(sw, { items: [] }, 0, 55);
    expect(total).toBe(90 * 2 + 42 + 7);
  });

  test("faqat bittasi overridden — ikkinchisi qayta hisoblanadi", () => {
    const sw = build();
    sw.items.find((i) => i.slug === "yan").overridden = false;
    calculateBlockTotal(sw, { items: [] }, 0, 55);
    expect(sw.items.find((i) => i.slug === "on").value).toBe(42);
    expect(sw.items.find((i) => i.slug === "yan").value).toBe(8);
  });

  test("idempotent: overridden qiymat takror chaqiruvda ham o'zgarmaydi", () => {
    const sw = build();
    const first = calculateBlockTotal(sw, { items: [] }, 0, 55);
    const second = calculateBlockTotal(sw, { items: [] }, 0, 55);
    expect(second).toBe(first);
    expect(sw.items.find((i) => i.slug === "on").value).toBe(42);
  });
});

describe("qoldirilgan — avtomatik hisoblash (shartsiz, 0.1 koeffitsient)", () => {
  const buildQoldirilganItem = (seed = 999) => [
    { slug: "qoldirilgan", title: "Qoldirilgan dars / Qayta topshirish", value: seed },
  ];

  test("golden misol (institut blankasi): 259 talaba → 26", () => {
    const sw = {
      group: 4,
      stream: 1,
      classTypes: [],
      items: buildQoldirilganItem(),
    };
    calculateBlockTotal(sw, { items: [] }, 0, 259);
    expect(sw.items.find((i) => i.slug === "qoldirilgan").value).toBe(26);
  });

  test("student=0 → qoldirilgan=0", () => {
    const sw = { group: 4, stream: 1, classTypes: [], items: buildQoldirilganItem() };
    calculateBlockTotal(sw, { items: [] }, 0, 0);
    expect(sw.items.find((i) => i.slug === "qoldirilgan").value).toBe(0);
  });

  test("overridden:true — avtomatik formula tegmaydi (qo'lda kiritilgan qiymat saqlanadi)", () => {
    const sw = {
      group: 4,
      stream: 1,
      classTypes: [],
      items: [
        {
          slug: "qoldirilgan",
          title: "Qoldirilgan dars / Qayta topshirish",
          value: 100,
          overridden: true,
        },
      ],
    };
    calculateBlockTotal(sw, { items: [] }, 0, 259);
    expect(sw.items.find((i) => i.slug === "qoldirilgan").value).toBe(100);
  });

  test("ON/YAN shartlari bajarilmasa ham qoldirilgan hisoblanadi (shart YO'Q)", () => {
    const sw = {
      group: 4,
      stream: 1,
      isLastSemester: false,
      classTypes: [{ slug: "amaliy", stream: 10, total: 0 }],
      items: [
        { slug: "on", title: "ON", value: 0 },
        { slug: "yan", title: "YAN", value: 0 },
        ...buildQoldirilganItem(),
      ],
    };
    calculateBlockTotal(sw, { items: [] }, 0, 259);
    expect(sw.items.find((i) => i.slug === "on").value).toBe(0);
    expect(sw.items.find((i) => i.slug === "yan").value).toBe(0);
    expect(sw.items.find((i) => i.slug === "qoldirilgan").value).toBe(26);
  });
});
