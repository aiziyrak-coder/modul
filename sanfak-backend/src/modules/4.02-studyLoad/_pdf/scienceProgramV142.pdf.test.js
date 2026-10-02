"use strict";

const PDFDocument = require("pdfkit");
const { docToBuffer } = require("./staffHeaderText.testutil");
const {
  buildScienceProgramV142Pdf,
  SECTION_TITLES,
  COVER_LINES,
  DOC_TYPE_LINE,
  INDEPENDENT_NOTE,
  GRADING,
  TOPIC_GROUPS,
  PAGE_NUMBER_Y,
  NO_W,
  FILL_HDR,
  drawSectionTable,
  registerFonts,
  councilSentence,
  departmentSentence,
  formatPerson,
  groupTopics,
  numberOutcomes,
  numberLiterature,
  educationFormLine,
} = require("./scienceProgramV142.pdf");

const M = (20 * 72) / 25.4;
const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps;
const {
  TOPIC_TYPES,
  TOPIC_CODE_PREFIX,
} = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const pageCount = (buf) =>
  (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

const fixture = (overrides = {}) => ({
  formVersion: "v142",
  title: "Kommunal gigiyena — fan dasturi (2026/2027)",
  science: {
    name: "Anesteziologiya va reanimatologiya",
    scienceCode: "AR3007",
    department: { title: "Anesteziologiya-reanimatologiya" },
  },
  directions: [
    { name: "Davolash ishi", directionCode: "60910200", faculty: { title: "Davolash ishi fakulteti" } },
  ],
  knowledgeArea: ["500 000 – Sog'liqni saqlash va ijtimoiy ta'minot"],
  educationArea: ["510 000 – Sog'liqni saqlash"],
  code: "3.07",
  serialNumber: "60910200 — 3.07",
  academicYear: { title: "2026/2027" },
  semester: "9",
  credits: 3,
  moduleType: "Majburiy",
  language: "O'zbek/rus",
  weeklyHours: 3,
  hourItems: [
    { slug: "maruza", title: "Ma'ruza", value: 10 },
    { slug: "amaliy", title: "Amaliy", value: 20 },
    { slug: "mustaqil", title: "Mustaqil ta'lim", value: 54 },
  ],
  classroomHours: 30,
  independentHours: 54,
  totalHours: 84,
  scienceEssence: {
    sciencePurpose: { desc: "anesteziya tamoyillarini o'rgatish." },
    scienceTasks: { desc: "reanimatsiya algoritmini o'rganish." },
  },
  creditRequirements: { desc: "Nazariy tushunchalarni to'la o'zlashtirish." },
  literatureGroups: [
    { slug: "primary", literatures: ["Avakov V.Ye. Reanimatsiya.", "Bunyatyan A.A. Anesteziologiya."] },
    { slug: "additional", literatures: ["Butrov A.V. Ekstrennaya anesteziologiya."] },
    { slug: "information", literatures: ["http://www.msu.ru", "http://ziyonet.uz/"] },
  ],
  approvalSteps: [
    {
      step: "dean",
      status: "approved",
      approvedBy: { firstName: "Falonchi", lastName: "Raxmatullayev" },
      date: new Date(2026, 7, 28),
    },
  ],
  status: "in_review",
  v142: {
    educationForm: "kunduzgi",
    prerequisites: [{ code: "2.07", title: "Fiziologiya" }, { code: null, title: "Anatomiya" }],
    outcomes: {
      competencies: [{ text: "Bemor to'g'risida ma'lumotga ega bo'lish." }, { text: "Kuratsiya." }],
      skills: [{ text: "Anesteziya darajasini baholash." }],
    },
    topics: [
      { type: "amaliy", title: "Og'riqsizlantirish usullari.", hours: 6 },
      { type: "maruza", title: "Anesteziologiya tarixi.", hours: 2, refs: [1, 2] },
      { type: "maruza", title: "Narkoz vositalari.", hours: 2 },
      { type: "klinik_amaliyot", title: "O'pka-yurak reanimatsiyasi", hours: 6 },
    ],
    independentTasks: [
      { order: 1, title: "SO'V apparatlari.", hours: 12 },
      { order: 2, title: "Infuzion terapiya.", hours: 12 },
    ],
    techMethods: ["ma'ruzalar", "guruhlarda ishlash"],
    grading: { a: ["to'liq yorita olsa;"], b: ["tushungan bo'lsa;"], d: ["umumiy tushuncha;"], e: ["fanni bilmasa."] },
    authors: [{ fio: "Axmadaliyev Sh.Sh.", degree: "PhD", department: "Anesteziologiya", position: "mudiri" }],
    reviewers: [{ fio: "Fattoxov N.X.", degree: "DSc", title: "professor" }],
    councilProtocol: { date: new Date(2026, 7, 20), number: "6" },
    departmentProtocol: { date: new Date(2026, 7, 15), number: "7" },
  },
  ...overrides,
});

const render = async (sp) => {
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  const rectSpy = jest.spyOn(PDFDocument.prototype, "rect");
  const fillStrokeSpy = jest.spyOn(PDFDocument.prototype, "fillAndStroke");
  const fillSpy = jest.spyOn(PDFDocument.prototype, "fill");
  const pageSpy = jest.spyOn(PDFDocument.prototype, "addPage");
  try {
    const doc = await buildScienceProgramV142Pdf(sp);
    const buf = await docToBuffer(doc);
    const pageStarts = pageSpy.mock.invocationCallOrder;
    const pageOf = (o) => pageStarts.filter((a) => a < o).length - 1;
    const calls = spy.mock.calls;
    const texts = calls.map((c) => c[0]).filter((t) => typeof t === "string");
    return {
      buf,
      calls,
      texts,
      order: spy.mock.invocationCallOrder,
      callPage: spy.mock.invocationCallOrder.map(pageOf),
      rects: rectSpy.mock.calls.map(([x, y, w, h], i) => ({ x, y, w, h, page: pageOf(rectSpy.mock.invocationCallOrder[i]) })),
      fills: { fillAndStroke: fillStrokeSpy.mock.calls, fill: fillSpy.mock.calls, order: fillStrokeSpy.mock.invocationCallOrder },
    };
  } finally {
    spy.mockRestore();
    rectSpy.mockRestore();
    fillStrokeSpy.mockRestore();
    fillSpy.mockRestore();
    pageSpy.mockRestore();
  }
};

beforeEach(() => jest.clearAllMocks());

describe("v142 renderer — muqova (shablon 17-bet + institut .docx)", () => {
  test("vazirlik/institut 3 qatori (SSV qoladi) va shablon hujjat turi «FANINING O'QUV DASTURI»", async () => {
    const { texts } = await render(fixture());
    for (const line of COVER_LINES) expect(texts).toContain(line);
    expect(texts).toContain("ANESTEZIOLOGIYA VA REANIMATOLOGIYA");
    expect(texts).toContain(DOC_TYPE_LINE);
    expect(DOC_TYPE_LINE).toBe("FANINING O'QUV DASTURI");
    expect(texts).toContain("(kunduzgi ta'lim shakli)");
  });

  test("«Farg'ona – <yil>» — «YIL» so'zisiz, yil o'quv yilining boshi", async () => {
    const { texts } = await render(fixture());
    expect(texts).toContain("Farg'ona – 2026");
    expect(texts.some((t) => /YIL/.test(t))).toBe(false);
  });

  test("hujjatning DB sarlavhasi (`sp.title`) zarvaraqda CHIQMAYDI", async () => {
    const { texts } = await render(fixture());
    expect(texts).not.toContain("Kommunal gigiyena — fan dasturi (2026/2027)");
  });

  test("meta 3 qatori DOIM chiziladi, yo'nalish shifr bilan", async () => {
    const { texts } = await render(fixture());
    expect(texts).toContain("Bilim sohasi:");
    expect(texts).toContain("Ta'lim sohasi:");
    expect(texts).toContain("Ta'lim yo'nalishi:");
    expect(texts).toContain("60910200 – Davolash ishi");
  });

  test("dekan bloki — «TASDIQLAYMAN», fakultet dekani lavozimi, F.I.O zanjirdan", async () => {
    const { texts } = await render(fixture());
    expect(texts).toContain('"TASDIQLAYMAN"');
    expect(texts).toContain("Davolash ishi fakulteti dekani");
    expect(texts).toContain("F.Raxmatullayev");
  });

  test("ta'lim shakli `v142.educationForm`dan; noma'lum/yo'q → kunduzgi", () => {
    expect(educationFormLine({ educationForm: "sirtqi" })).toBe("(sirtqi ta'lim shakli)");
    expect(educationFormLine({})).toBe("(kunduzgi ta'lim shakli)");
    expect(educationFormLine(undefined)).toBe("(kunduzgi ta'lim shakli)");
  });
});

describe("v142 renderer — 2-bet (shablon 18-bet)", () => {
  test("Kengash bayoni jumlasi TO'LGAN — fakultet + sana (formatUzDateQuoted) + raqam", async () => {
    const sp = fixture();
    const { texts } = await render(sp);
    const s = councilSentence(sp, sp.v142);
    expect(s).toBe(
      "Mazkur o'quv dasturi Davolash ishi fakulteti Kengashining 2026-yil “ 20 ” avgustdagi 6-sonli yig'ilish bayoni bilan ma'qullangan.",
    );
    expect(texts).toContain(s);
  });

  test("kafedra bayoni jumlasi TO'LGAN — `science.department.title` (populate) + sana + raqam", async () => {
    const sp = fixture();
    const { texts } = await render(sp);
    const s = departmentSentence(sp, sp.v142);
    expect(s).toBe(
      "Mazkur o'quv dasturi Farg'ona jamoat salomatligi tibbiyot institutining “Anesteziologiya-reanimatologiya” kafedrasi tomonidan taqdim etilgan (kafedraning 2026-yil “ 15 ” avgustdagi 7-sonli yig'ilish bayoni).",
    );
    expect(texts).toContain(s);
  });

  test("bayon rekvizitlari BO'SH — shablon bo'sh chiziqlari, taxminiy sana/raqam YO'Q", () => {
    const sp = fixture({ directions: [], science: { name: "X" } });
    const c = councilSentence(sp, {});
    const d = departmentSentence(sp, {});
    expect(c).toBe(
      "Mazkur o'quv dasturi ____________________ fakulteti Kengashining 20__-yil “___” __________dagi ___-sonli yig'ilish bayoni bilan ma'qullangan.",
    );
    expect(d).toContain("“____________________” kafedrasi");
    expect(d).toContain("20__-yil “___” __________dagi ___-sonli");
    expect(c).not.toMatch(/20\d\d-yil/);
  });

  test("fakultet nomi «fakulteti» bilan tugasa — so'z TAKRORLANMAYDI", () => {
    const sp = fixture({ directions: [{ faculty: { title: "Neft va gaz" } }] });
    expect(councilSentence(sp, {})).toContain("Neft va gaz fakulteti Kengashining");
    const sp2 = fixture();
    expect(councilSentence(sp2, {})).not.toContain("fakulteti fakulteti");
  });

  test("Tuzuvchilar/Taqrizchilar — shablon shakli, bo'sh qismlar tushib qoladi", async () => {
    expect(
      formatPerson({ fio: "U.Safayev", degree: "t.f.d.", title: "professor", department: "Ekologiya", position: "o'qituvchisi" }),
    ).toBe("U.Safayev — t.f.d., professor, “Ekologiya” kafedrasi o'qituvchisi");
    expect(formatPerson({ fio: "Axmadaliyev Sh.Sh.", degree: "PhD", position: "Kafedra mudiri" })).toBe(
      "Axmadaliyev Sh.Sh. — PhD, Kafedra mudiri",
    );
    expect(formatPerson({ fio: "Muhammad R.N." })).toBe("Muhammad R.N.");
    expect(formatPerson({ fio: "" })).toBe("");
    const { texts } = await render(fixture());
    expect(texts).toContain("Tuzuvchilar:");
    expect(texts).toContain("Taqrizchilar:");
    expect(texts).toContain("Axmadaliyev Sh.Sh. — PhD, “Anesteziologiya” kafedrasi mudiri");
    expect(texts).toContain("Fattoxov N.X. — DSc, professor");
  });
});

describe("v142 renderer — §1…§10 sarlavhalari (shablon matni AYNAN)", () => {
  const EXPECTED = [
    "1. Fan ma'lumotlari",
    "2. Fanning mazmuni",
    "3. Fanni o'zlashtirish uchun zarur boshlang'ich bilimlar",
    "4. Ta'lim natijalari (TN)",
    "5. Fan mazmuni va mashg'ulotlar shakli:",
    "6. Mustaqil ta'lim topshiriqlari*",
    "7. Ta'lim texnologiyalari va metodlari",
    "8. Talabalar tomonidan kreditlarni olish uchun talablar",
    "9. Talabala bilimini baholash mezoni",
    "10. Foydalanilgan adabiyotlar",
  ];

  const HEADER_CELLS = EXPECTED.map((t) => {
    const i = t.indexOf(" ");
    return { no: t.slice(0, i), title: t.slice(i + 1) };
  });

  test("SECTION_TITLES lug'ati shablon matni bilan bir xil", () => {
    expect(Object.keys(SECTION_TITLES).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(Object.values(SECTION_TITLES)).toEqual(EXPECTED);
  });

  const headerIndex = (calls, title, after = -1) =>
    calls.findIndex((c, k) => k > after && c[0] === title && near(c[1], M + NO_W + 3));
  const rowBoxes = (rects, page, ty) => rects.filter((r) => r.page === page && r.y <= ty && ty <= r.y + r.h);

  test("to'lgan hujjatda 10 sarlavha ham RAMKALI qator: «N.» katagi + sarlavha katagi alohida, TARTIBDA", async () => {
    const { calls, callPage, rects } = await render(fixture());
    let last = -1;
    for (const h of HEADER_CELLS) {
      const i = headerIndex(calls, h.title, last);
      expect(i).toBeGreaterThan(last);
      expect(calls[i - 1][0]).toBe(h.no);
      expect(near(calls[i - 1][1], M + 3)).toBe(true);
      const boxes = rowBoxes(rects, callPage[i], calls[i][2]);
      expect(boxes.some((r) => near(r.x, M) && near(r.w, NO_W))).toBe(true);
      expect(boxes.some((r) => near(r.x, M + NO_W))).toBe(true);
      last = i;
    }
  });

  test("§5/§6 sarlavha qatorida o'ng «Soat»/yig'indi katagi bor (3 katak); §1 sarlavha qatori 2 katak", async () => {
    const { calls, callPage, rects } = await render(fixture());
    const boxesOf = (title) => {
      const i = headerIndex(calls, title);
      return { i, n: rowBoxes(rects, callPage[i], calls[i][2]).length };
    };
    const s5 = boxesOf("Fan mazmuni va mashg'ulotlar shakli:");
    const s6 = boxesOf("Mustaqil ta'lim topshiriqlari*");
    expect(s5.n).toBe(3);
    expect(s6.n).toBe(3);
    expect(boxesOf("Fan ma'lumotlari").n).toBe(2);
    expect(calls[s5.i + 1][0]).toBe("Soat");
    expect(calls[s6.i + 1][0]).toBe("24");
  });

  test("kulrang fon (#d9d9d9) FAQAT §1 sarlavha kataklarida: ≥ 8 ta, «1.» katagidan keyin, §2 dan oldin; `fill()` yo'q", async () => {
    const { calls, order, fills } = await render(fixture());
    expect(fills.fillAndStroke.length).toBe(16);
    for (const c of fills.fillAndStroke) {
      expect(c[0]).toBe(FILL_HDR);
      expect(c[1]).toBe("#000");
    }
    expect(fills.fill).toHaveLength(0);
    const orderOf = (title) => order[headerIndex(calls, title)];
    expect(Math.min(...fills.order)).toBeGreaterThan(orderOf("Fan ma'lumotlari"));
    expect(Math.max(...fills.order)).toBeLessThan(orderOf("Fanning mazmuni"));
  });

  const BOTTOM = 841.89 - (25 * 72) / 25.4;
  const expectBoxesInsideContent = (rects) => {
    for (const r of rects) expect(r.y + r.h).toBeLessThanOrEqual(BOTTOM + 0.01);
  };

  test("qator BO'LINMAYDI — hech bir katak ramkasi kontent chegarasidan (BOTTOM) pastga o'tmaydi", async () => {
    const { rects } = await render(fixture());
    expect(rects.length).toBeGreaterThan(40);
    expectBoxesInsideContent(rects);
  });

  const sweepDoc = () => {
    const doc = new PDFDocument({ size: "A4", margins: { top: M, bottom: (25 * 72) / 25.4, left: M, right: M }, bufferPages: true });
    registerFonts(doc);
    const textSpy = jest.spyOn(doc, "text");
    const pageSpy = jest.spyOn(doc, "addPage");
    const pageOf = (o) => pageSpy.mock.invocationCallOrder.filter((a) => a < o).length;
    return {
      doc,
      cursor: () => textSpy.mock.calls.length,
      pageOfText: (text, from) => {
        const i = textSpy.mock.calls.findIndex((c, k) => k >= from && c[0] === text);
        expect(i).toBeGreaterThan(-1);
        return pageOf(textSpy.mock.invocationCallOrder[i]);
      },
    };
  };
  const fillerRows = (n) => Array.from({ length: n }, (_, i) => ({ cells: [{ text: `${i + 1}.` }, { text: `Qator ${i + 1}` }] }));

  test("keepNext: guruh qatori bet oxirida o'zi sig'sa ham KEYINGI qatordan ajralmaydi (n=1..30 sweep)", () => {
    const s = sweepDoc();
    let movedTogether = 0;
    for (let n = 1; n <= 30; n++) {
      const rows = fillerRows(n);
      rows.push({ cells: [{ text: "" }, { text: "GURUH", bold: true }], keepNext: true });
      rows.push({ cells: [{ text: "X1" }, { text: "Keyingi qator" }] });
      const from = s.cursor();
      s.doc.addPage();
      drawSectionTable(s.doc, M, { no: "1.", title: "Sinov jadvali", rows });
      const g = s.pageOfText("GURUH", from);
      expect(s.pageOfText("X1", from)).toBe(g);
      if (g !== s.pageOfText(`Qator ${n}`, from)) movedTogether++;
    }
    s.doc.end();
    expect(movedTogether).toBeGreaterThan(0);
  });

  test("sarlavha yetim qolmaydi: bo'lim sarlavhasi doim 1-kontent qatori bilan bir betda (n=1..30 sweep)", () => {
    const s = sweepDoc();
    let movedTogether = 0;
    for (let n = 1; n <= 30; n++) {
      const from = s.cursor();
      s.doc.addPage();
      const y = drawSectionTable(s.doc, M, { no: "1.", title: "Birinchi", rows: fillerRows(n) });
      drawSectionTable(s.doc, y, { no: "2.", title: "Ikkinchi", rows: [{ paras: [{ text: "Birinchi qator matni." }] }] });
      const h = s.pageOfText("Ikkinchi", from);
      expect(s.pageOfText("Birinchi qator matni.", from)).toBe(h);
      if (h !== s.pageOfText(`Qator ${n}`, from)) movedTogether++;
    }
    s.doc.end();
    expect(movedTogether).toBeGreaterThan(0);
  });

  test("bir betdan katta span-qator (patologik uzun §2) — yiqilmaydi, paragraflar bo'yicha bo'laklanadi", async () => {
    const longDesc = Array.from({ length: 60 }, (_, i) => `Paragraf ${i + 1}. ${"matn ".repeat(40)}`).join("\n");
    const sp = fixture({ scienceEssence: { sciencePurpose: { desc: longDesc }, scienceTasks: { desc: "vazifa" } } });
    const { buf, rects, texts } = await render(sp);
    expectBoxesInsideContent(rects);
    expect(texts).toContain(`Paragraf 60. ${"matn ".repeat(40).trim()}`);
    expect(pageCount(buf)).toBeGreaterThanOrEqual(6);
  });

  test("§1: «O'quv rejadagi tartib raqami» yorlig'i va qiymati, klinik ustunsiz jami", async () => {
    const { texts } = await render(fixture());
    expect(texts).toContain("O'quv rejadagi tartib raqami");
    expect(texts).toContain("60910200 — 3.07");
    expect(texts).toContain("Lab-ya");
    expect(texts).toContain("Auditoriya mashg'ulotlari jami — 30 soat, shundan:");
    expect(texts).toContain("Ma'ruza");
    expect(texts).toContain("Amaliy");
    expect(texts).toContain("Mustaqil ta'lim (soat)");
    expect(texts).toContain("Kurs ishi");
    expect(texts).toContain("-");
  });

  test("§1: hourItems'da klinik bo'lsa — «Klinik o'quv amaliyoti» ustuni, `mustaqil` guruhda YO'Q", async () => {
    const { texts } = await render(
      fixture({
        hourItems: [
          { slug: "maruza", value: 10 },
          { slug: "amaliy", value: 20 },
          { slug: "klinik_amaliyot", value: 24 },
          { slug: "mustaqil", value: 54 },
        ],
      }),
    );
    expect(texts).toContain("Klinik o'quv amaliyoti");
    expect(texts).toContain("Auditoriya mashg'ulotlari jami — 54 soat, shundan:");
  });

  test("§1: hourItems bo'sh — shablonning 3 ustuni (Ma'ruza | Amaliy | Lab-ya), jami «...»", async () => {
    const { texts } = await render(fixture({ hourItems: [] }));
    expect(texts).toContain("Lab-ya");
    expect(texts).toContain("Auditoriya mashg'ulotlari jami — ... soat, shundan:");
  });

  test("§2: «Fanining maqsadi –» / «Fanining vazifalari –» kirish so'zlari YO'Q", async () => {
    const { texts } = await render(fixture());
    expect(texts).not.toContain("Fanining maqsadi – ");
    expect(texts).not.toContain("Fanining vazifalari – ");
  });

  test("§3: «1. (2.07) Fiziologiya» — kod yo'q bo'lsa qavs yo'q", async () => {
    const { texts } = await render(fixture());
    expect(texts).toContain("(2.07) Fiziologiya");
    expect(texts).toContain("Anatomiya");
    expect(texts).toContain("1.");
    expect(texts).toContain("2.");
  });

  test("§4: TN kodlari kompetensiya → ko'nikma bo'ylab UZLUKSIZ (TN1, TN2, TN3)", async () => {
    const out = numberOutcomes(fixture().v142.outcomes);
    expect(out.competencies.map((o) => o.code)).toEqual(["TN1", "TN2"]);
    expect(out.skills.map((o) => o.code)).toEqual(["TN3"]);
    const { texts } = await render(fixture());
    expect(texts).toContain("Kasbiy kompetensiyalar:");
    expect(texts).toContain("Ko'nikmalar:");
    expect(texts).toContain("TN3");
  });

  test("§5: tur bo'yicha guruhlash RENDER vaqtida — M1/M2/A1/K1 kodlari, guruh yig'indisi, refs", async () => {
    const groups = groupTopics(fixture().v142.topics);
    expect(groups.map((g) => g.type)).toEqual(["maruza", "amaliy", "klinik_amaliyot"]);
    expect(groups[0].rows.map((r) => r.code)).toEqual(["M1", "M2"]);
    expect(groups[0].hours).toBe(4);
    expect(groups[1].rows[0].code).toBe("A1");
    expect(groups[2].rows[0].code).toBe("K1");
    const { texts } = await render(fixture());
    expect(texts).toContain("Ma'ruza (M)");
    expect(texts).toContain("Amaliy mashg'ulot (A)");
    expect(texts).toContain("Klinik o'quv amaliyoti (K)");
    expect(texts).toContain("M1");
    expect(texts).toContain("A1");
    expect(texts).toContain("Anesteziologiya tarixi. [1,2]");
    expect(texts).toContain("Soat");
  });

  test("§5: mavzular bo'sh — shablonning M/A/L guruhlari bittadan bo'sh qator bilan", () => {
    const groups = groupTopics([]);
    expect(groups.map((g) => g.type)).toEqual(["maruza", "amaliy", "laboratoriya"]);
    expect(groups.map((g) => g.rows[0].code)).toEqual(["M1", "A1", "L1"]);
    expect(groups.every((g) => g.blank)).toBe(true);
  });

  test("§4/§5: saqlangan kod afzal — qo'lda `M-kirish`/`TN-A` chiqadi, bo'sh → avto; o'rin egallanadi (2026-09-16, egasi)", () => {
    const groups = groupTopics([
      { type: "maruza", code: "M-kirish", title: "Kirish", hours: 2 },
      { type: "maruza", code: "", title: "Davomi", hours: 2 },
      { type: "maruza", code: "   ", title: "Yakun", hours: 2 },
      { type: "amaliy", code: null, title: "Amaliy", hours: 2 },
    ]);
    expect(groups[0].rows.map((r) => r.code)).toEqual(["M-kirish", "M2", "M3"]);
    expect(groups[1].rows[0].code).toBe("A1");
    const out = numberOutcomes({
      competencies: [{ code: "TN-A", text: "a" }, { code: null, text: "b" }],
      skills: [{ code: "", text: "c" }],
    });
    expect(out.competencies.map((o) => o.code)).toEqual(["TN-A", "TN2"]);
    expect(out.skills.map((o) => o.code)).toEqual(["TN3"]);
  });

  test("§5 prefiks/tur lug'ati model `TOPIC_CODE_PREFIX`/`TOPIC_TYPES` bilan drift qilmaydi", () => {
    expect(TOPIC_GROUPS.map((g) => g.type)).toEqual([...TOPIC_TYPES]);
    for (const g of TOPIC_GROUPS) expect(g.prefix).toBe(TOPIC_CODE_PREFIX[g.type]);
  });

  test("§6: yig'indi sarlavhada, kursiv izoh SHABLON matni bilan", async () => {
    const { texts } = await render(fixture());
    expect(texts).toContain("24");
    expect(texts).toContain(INDEPENDENT_NOTE);
    expect(INDEPENDENT_NOTE.startsWith("*Izoh: Fan (modul) yuzasidan")).toBe(true);
    expect(INDEPENDENT_NOTE).toContain("1/3 qismi");
    expect(INDEPENDENT_NOTE).toContain("(kooperativlik)ga");
  });

  test("§6: izoh TAHRIRLANADI — `v142.independentNote` bo'lsa u chiziladi, shablon matni EMAS (egasi 2026-09-16)", async () => {
    const fx = fixture();
    fx.v142.independentNote = "*Izoh: kafedra qoidasi bo'yicha mustaqil ish 1/2 qismi guruhda.";
    const { texts } = await render(fx);
    expect(texts).toContain("*Izoh: kafedra qoidasi bo'yicha mustaqil ish 1/2 qismi guruhda.");
    expect(texts).not.toContain(INDEPENDENT_NOTE);
  });

  test("§9: kirish jumlasi = bandlarning 1-si (harf + matn, tahrirlanadi) — DUBLIKAT yo'q; bandlar bo'sh → shablon jumlasi", async () => {
    const fx = fixture();
    fx.v142.grading = {
      a: ["5 baho (90-100 ball) olish uchun talabaning bilim darajasi quyidagilarga javob berishi lozim:", "to'liq yorita olsa;"],
      b: [],
      d: ["umumiy tushuncha;"],
      e: [],
    };
    const { texts } = await render(fx);
    expect(texts).toContain("a) 5 baho (90-100 ball) olish uchun talabaning bilim darajasi quyidagilarga javob berishi lozim:");
    expect(texts).not.toContain(GRADING[0].lead);
    expect(texts.filter((t) => /5 baho/.test(t))).toHaveLength(1);
    expect(texts).toContain(GRADING[1].lead);
    expect(texts).toContain("d) umumiy tushuncha;");
  });

  test("§9: a/b/d/e kirish jumlalari shablon matni bilan, tartibda (fixture bandlari bir so'zli → 1-band kirish bo'ladi)", async () => {
    expect(GRADING.map((g) => g.key)).toEqual(["a", "b", "d", "e"]);
    const fx = fixture();
    fx.v142.grading = { a: [], b: [], d: [], e: [] };
    const { texts } = await render(fx);
    for (const g of GRADING) expect(texts).toContain(g.lead);
    expect(GRADING[3].lead).toBe(
      "e) quyidagi hollarda talabaning bilim darajasi qoniqarsiz 2 baho bilan baholanishi mumkin:",
    );
  });

  test("§10: guruhlar bo'ylab UZLUKSIZ raqamlash (1..2, 3, 4..5) va 3 sarlavha", async () => {
    const groups = numberLiterature(fixture().literatureGroups);
    expect(groups.map((g) => g.title)).toEqual(["Asosiy adabiyotlar", "Qo'shimcha adabiyotlar", "Axborot manbalari"]);
    expect(groups.map((g) => g.items.map((i) => i.n))).toEqual([[1, 2], [3], [4, 5]]);
    const { texts } = await render(fixture());
    const start = texts.indexOf("Foydalanilgan adabiyotlar");
    expect(start).toBeGreaterThan(0);
    const nums = texts.slice(start).filter((t) => /^\d+\.$/.test(t));
    expect(nums).toEqual(["1.", "2.", "3.", "4.", "5."]);
  });

  test("§10: legacy `desc` qatorlaridagi eski raqam olib tashlanadi, shablonda yo'q slug yo'qolmaydi", () => {
    const groups = numberLiterature([
      { slug: "primary", desc: "1. Birinchi\n2. Ikkinchi" },
      { slug: "guidance", title: "Rahbariy adabiyotlar", literatures: ["Qonun"] },
    ]);
    expect(groups[0].items.map((i) => i.text)).toEqual(["Birinchi", "Ikkinchi"]);
    expect(groups[3]).toEqual({ slug: "guidance", title: "Rahbariy adabiyotlar", items: [{ n: 3, text: "Qonun" }] });
  });
});

describe("v142 renderer — bo'sh / legacy hujjat", () => {
  test("`v142` UMUMAN yo'q (legacy) — yiqilmaydi, 10 sarlavha bo'sh shablon bilan chiziladi", async () => {
    const sp = fixture({ v142: undefined, hourItems: [], directions: [], approvalSteps: [], literatureGroups: [] });
    delete sp.v142;
    const { texts, buf } = await render(sp);
    for (const t of Object.values(SECTION_TITLES)) {
      const i = t.indexOf(" ");
      expect(texts).toContain(t.slice(0, i));
      expect(texts).toContain(t.slice(i + 1));
    }
    expect(texts).toContain("Tuzuvchilar:");
    expect(texts).toContain("Fakultet dekani");
    expect(pageCount(buf)).toBeGreaterThanOrEqual(3);
  });

  test("`science` populate qilinmagan/yo'q — «Fan nomi» zaxirasi, 500 yo'q", async () => {
    const { texts } = await render(fixture({ science: null }));
    expect(texts).toContain("FAN NOMI");
  });

  test("approved + verify token — QR yo'li yiqilmaydi (darvoza `prepareVerifyQr`)", async () => {
    const sp = fixture({
      status: "approved",
      verify: { token: "0123456789abcdef0123456789abcdef", revokedAt: null, snapshot: [] },
    });
    await expect(render(sp)).resolves.toBeDefined();
  });
});

describe("v142 renderer — bet raqamlari (PDFKit hoshiya tuzog'i)", () => {
  test("muqova RAQAMSIZ (namuna 9-/17-bet), 2-betdan «2»..N; raqamlar soni == betlar soni − 1, ortiqcha bet yo'q", async () => {
    const { calls, buf } = await render(fixture());
    const numbers = calls.filter((c) => c[2] === PAGE_NUMBER_Y);
    expect(numbers.length).toBe(pageCount(buf) - 1);
    expect(numbers.map((c) => c[0])).toEqual(numbers.map((_, i) => String(i + 2)));
    expect(pageCount(buf)).toBeGreaterThanOrEqual(3);
  });
});

describe("v142 2-bet — D-13 bayonnoma zanjirdan", () => {
  const withSteps = (steps) => fixture({ approvalSteps: steps });
  const dean = { step: "dean", status: "approved", protocol: "5", date: new Date(2026, 8, 25) };
  const kafedra = { step: "kafedra", status: "approved", protocol: "14", date: new Date(2026, 8, 24) };

  test("forma bo'sh — Kengash raqami dekan bosqichidan, kafedra raqami kafedra bosqichidan", () => {
    const sp = withSteps([kafedra, dean]);
    expect(councilSentence(sp, {})).toContain("5-sonli yig'ilish bayoni");
    expect(departmentSentence(sp, {})).toContain("14-sonli yig'ilish bayoni");
    expect(councilSentence(sp, {})).not.toContain("___-sonli");
  });

  test("formada raqam bor — forma ustun", () => {
    const sp = withSteps([dean]);
    expect(councilSentence(sp, { councilProtocol: { number: "6", date: null } })).toContain("6-sonli");
  });

  test("tasdiqlanmagan yoki raqamsiz bosqich — bo'sh qoladi", () => {
    const sp = withSteps([{ ...dean, status: "pending" }, { ...kafedra, protocol: null }]);
    expect(councilSentence(sp, {})).toContain("___-sonli");
    expect(departmentSentence(sp, {})).toContain("___-sonli");
  });
});

describe("v142 2-bet — D-14 kafedra nomi", () => {
  test("nomda «kafedrasi» bor — qo'shimcha «kafedrasi» YO'Q", () => {
    const base = fixture();
    const sp = fixture({
      science: { ...base.science, department: { title: "Normal anatomiya, operativ jarrohlik va topografik anatomiya kafedrasi" } },
    });
    const s = departmentSentence(sp, {});
    expect(s).toContain("“Normal anatomiya, operativ jarrohlik va topografik anatomiya kafedrasi” tomonidan");
    expect(s).not.toContain("kafedrasi” kafedrasi");
  });

  test("shaxs qatori: nomda «kafedra» bor — takror yo'q, lavozim vergul bilan", () => {
    expect(
      formatPerson({ fio: "Rasulov F.", department: "Anatomiya kafedrasi (Andijon DTI)", position: "Kafedra mudiri" }),
    ).toBe("Rasulov F. — “Anatomiya kafedrasi (Andijon DTI)”, Kafedra mudiri");
  });
});

describe("v142 muqova — D-9 Bilim/Ta'lim sohasi yo'nalishdan", () => {
  const DIR = {
    name: "Davolash ishi",
    directionCode: "60910200",
    faculty: { title: "Davolash ishi fakulteti" },
    knowledgeArea: "900000 – Sog'liqni saqlash va ijtimoiy ta'minot",
    educationArea: "910000 – Sog'liqni saqlash",
  };

  test("o'z qiymati bo'sh — yo'nalishdagi soha chiziladi", async () => {
    const { texts } = await render(fixture({ knowledgeArea: [], educationArea: [], directions: [DIR] }));
    expect(texts).toContain("900000 – Sog'liqni saqlash va ijtimoiy ta'minot");
    expect(texts).toContain("910000 – Sog'liqni saqlash");
  });

  test("o'z qiymati ustun — yo'nalishdagi soha chizilmaydi", async () => {
    const { texts } = await render(fixture({ directions: [DIR] }));
    expect(texts).toContain("500 000 – Sog'liqni saqlash va ijtimoiy ta'minot");
    expect(texts).not.toContain("900000 – Sog'liqni saqlash va ijtimoiy ta'minot");
  });

  test("ikki yo'nalishda bir xil soha — bir marta (vergulsiz takror yo'q)", async () => {
    const twin = { ...DIR, name: "Pediatriya ishi", directionCode: "60910300" };
    const { texts } = await render(fixture({ knowledgeArea: [], educationArea: [], directions: [DIR, twin] }));
    expect(texts).toContain("910000 – Sog'liqni saqlash");
    expect(texts.some((t) => t.includes("910000 – Sog'liqni saqlash, 910000"))).toBe(false);
  });

  test("hech qayerda yo'q — «—» (qiymat yorliqdan keyingi `text` chaqiruvi)", async () => {
    const bare = { name: "Davolash ishi", directionCode: "60910200" };
    const { texts } = await render(fixture({ knowledgeArea: [], educationArea: [], directions: [bare] }));
    const valueOf = (label) => texts[texts.indexOf(label) + 1];
    expect(valueOf("Bilim sohasi:")).toBe("—");
    expect(valueOf("Ta'lim sohasi:")).toBe("—");
  });
});
