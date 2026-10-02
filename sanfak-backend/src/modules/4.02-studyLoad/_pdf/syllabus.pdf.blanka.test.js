const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.model");

const Syllabus = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const { buildSyllabusPdf } = require("./syllabus.pdf");

const MINISTRY_LINES = [
  "O'ZBEKISTON RESPUBLIKASI SOG'LIQNI SAQLASH VAZIRLIGI",
  "O'ZBEKISTON RESPUBLIKASI OLIY TA'LIM, FAN VA INNOVATSIYALAR VAZIRLIGI",
  "FARG'ONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI",
];

const FOOTER_Y = 805;

const POSITION_ID = "6a7d69082200e50d919e2b3a";

const chainable = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const fixture = (overrides = {}) => ({
  _id: "syl1",
  label: null,
  title: null,
  createdAt: new Date("2026-08-19T05:25:57.414Z"),
  confirmation: {
    confirm: null,
    position: null,
    viceRector: null,
    date: null,
  },
  science: {
    title: "Mehnat gigiyenasi",
    scienceCode: "FA1003",
    department: { title: "Gigiyena va ekologiya kafedrasi" },
  },
  scienceTitle: null,
  scienceType: null,
  scienceCode: null,
  faculty: { title: "Tibbiy profilaktika fakulteti" },
  directions: [
    { title: "Tibbiy profilaktika ishi", directionCode: "60910500" },
  ],
  year: 0,
  semester: 1,
  credits: 0,
  educationForm: "full_time",
  evaluationForm: "exam",
  scienceLang: "uz",
  hoursByType: { title: null, totalHours: 0, items: [] },
  sciencePurpose: { title: null, desc: "V. O'quv natijalari" },
  prerequisiteKnowledge: { title: null, desc: null },
  learningOutcome: { knowledgeOutcomes: [], skillOutcomes: [] },
  scienceContent: { title: null, desc: null, topics: [] },
  trainingSeminar: { title: null, topics: [] },
  independent: { title: null, topics: [] },
  literatureGroups: [],
  evaluationCriteria: {
    title: null,
    criteria: [
      { slug: "5", title: "A'lo (5)", desc: "A'lo (5) bahosi uchun mezon" },
    ],
  },
  author: {
    teacher: {
      firstName: "Ibrohim",
      lastName: "Qodirjonov",
      middleName: "Jabborovich",
      position: { title: "Professor" },
    },
    email: null,
    organization: null,
    reviewer: { title: null, desc: "Taqrizchilar" },
  },
  desc: null,
  weeklySchedule: { title: null, weeks: [] },
  submissionRules: { title: null, desc: null },
  contactInfo: {},
  methodicalHead: {},
  facultyDean: {},
  departmentHead: {},
  creator: {},
  approvalSteps: [
    {
      step: "kafedra",
      status: "approved",
      approvedBy: { firstName: "Sanjar", lastName: "Abdusalimov" },
      date: new Date("2026-08-19T05:29:54.409Z"),
    },
    {
      step: "prorektor",
      status: "approved",
      approvedBy: { firstName: "Ulugbek", lastName: "Boltaboyev" },
      date: new Date("2026-08-19T05:32:58.374Z"),
    },
  ],
  status: "approved",
  location: null,
  ...overrides,
});

const emptyFixture = () =>
  fixture({
    science: null,
    directions: [],
    educationForm: null,
    evaluationForm: null,
    scienceLang: null,
    evaluationCriteria: { title: null, criteria: [] },
    author: { teacher: null, email: null, organization: null, reviewer: {} },
    sciencePurpose: { title: null, desc: null },
    approvalSteps: [{ step: "kafedra", status: "pending", approvedBy: null }],
    status: "draft",
  });

const build = (doc) => {
  Syllabus.findById = jest.fn().mockReturnValue(chainable(doc));
  return buildSyllabusPdf("syl1");
};

const docToBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

const pageCount = (buf) =>
  (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

const render = async (doc = fixture()) => {
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const pdf = await build(doc);
    const buf = await docToBuffer(pdf);
    return { buf, calls: spy.mock.calls };
  } finally {
    spy.mockRestore();
  }
};

const textsOf = (calls) =>
  calls.map((c) => c[0]).filter((t) => typeof t === "string");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("zarvaraq — vazirlik/institut sarlavhasi (blanka 1-3 qatori)", () => {
  test("uch qator ham chiziladi", async () => {
    const { calls } = await render();
    const t = textsOf(calls);
    for (const line of MINISTRY_LINES) expect(t).toContain(line);
  });

  test("eski `drawHeader` banner matni endi chiqmaydi", async () => {
    const { calls } = await render();
    const t = textsOf(calls);
    expect(t).not.toContain("OLIY TA'LIM MUASSASASI");
    expect(t).not.toContain(
      "Institut Avtomatlashtirilgan Axborot Tizimi (AIS)",
    );
  });

  test("institut nomi env dan keladi (qattiq kodlanmagan)", async () => {
    const prev = process.env.PDF_INSTITUTE_NAME;
    process.env.PDF_INSTITUTE_NAME = "TEST INSTITUTI";
    try {
      const { calls } = await render();
      const t = textsOf(calls);
      expect(t).toContain("TEST INSTITUTI");
      expect(t).not.toContain(MINISTRY_LINES[2]);
    } finally {
      if (prev === undefined) delete process.env.PDF_INSTITUTE_NAME;
      else process.env.PDF_INSTITUTE_NAME = prev;
    }
  });

  test("zarvaraqda TASDIQLAYMAN bloki va hujjat turi bor", async () => {
    const { calls } = await render();
    const t = textsOf(calls);
    expect(t).toContain('"TASDIQLAYMAN"');
    expect(t).toContain("O'quv ishlari bo'yicha prorektor");
    expect(t).toContain("FANI BO'YICHA");
    expect(t).toContain("S I L L A B U S");
  });

  test("`confirmation` bo'sh bo'lsa ham F.I.O `prorektor` qadamidan olinadi", async () => {
    const { calls } = await render();
    expect(textsOf(calls)).toContain("U.Boltaboyev");
  });

  test("qadam tasdiqlanmagan bo'lsa sana bo'sh joy bilan chiziladi", async () => {
    const { calls } = await render(emptyFixture());
    expect(textsOf(calls)).toContain('202__ yil "___" ________');
  });

  test("blanka soha qatorlari bor; shifr manbasiz — `—` chiziladi", async () => {
    const { calls } = await render();
    const t = textsOf(calls);
    expect(t).toContain("Bilim sohasi:");
    expect(t).toContain("Ta'lim sohasi:");
    expect(t).toContain("Ta'lim yo'nalishi:");
    expect(t).toContain("60910500 - Tibbiy profilaktika ishi");
  });

  test("shahar–yil qatori chiziladi", async () => {
    const { calls } = await render();
    expect(textsOf(calls)).toContain("FARG'ONA – 2026");
  });

  test("F-15: `year` = kurs (2) bo'lsa ham muqovada hujjat yili — «FARG'ONA – 2026», «– 2» emas", async () => {
    const { calls } = await render({ ...fixture(), year: 2 });
    const t = textsOf(calls);
    expect(t).toContain("FARG'ONA – 2026");
    expect(t).not.toContain("FARG'ONA – 2");
  });

  test("F-15: `year` to'liq yil (2025) bo'lsa — o'sha yil (ortga moslik)", async () => {
    const { calls } = await render({ ...fixture(), year: 2025 });
    expect(textsOf(calls)).toContain("FARG'ONA – 2025");
  });
});

describe("bo'sh betlar — footer hoshiyadan tashqarida edi", () => {
  test("footerlar soni PDF'dagi sahifalar soniga teng (ortiqcha bet yo'q)", async () => {
    const { buf, calls } = await render();
    const footers = calls.filter((c) => c[2] === FOOTER_Y);
    expect(footers.length).toBeGreaterThan(0);
    expect(footers.length).toBe(pageCount(buf) * 2);
  });

  test("footer raqamlari 1..N va N sahifalar soniga mos", async () => {
    const { buf, calls } = await render();
    const n = pageCount(buf);
    const nums = calls
      .filter((c) => c[2] === FOOTER_Y)
      .map((c) => c[0])
      .filter((s) => /^\d+ \/ \d+$/.test(s));
    expect(nums).toEqual(Array.from({ length: n }, (_, i) => `${i + 1} / ${n}`));
  });

  test("pastki hoshiya chizishdan keyin TIKLANADI — hujjat yaroqli PDF", async () => {
    const { buf } = await render();
    expect(buf.slice(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.toString("latin1")).toContain("%%EOF");
  });
});

describe("xom enum qiymatlari hujjatga tushmaydi", () => {
  test("`full_time` / `exam` / `uz` o'rniga o'zbekcha yorliq", async () => {
    const { calls } = await render();
    const t = textsOf(calls);
    expect(t).not.toContain("full_time");
    expect(t).not.toContain("exam");
    expect(t).not.toContain("uz");
    expect(t).toContain("Kunduzgi");
    expect(t).toContain("Imtihon");
    expect(t).toContain("O'zbek");
  });

  test("inson yozgan o'zbekcha qiymat o'zgarishsiz o'tadi", async () => {
    const { calls } = await render(fixture({ educationForm: "Kunduzgi" }));
    expect(textsOf(calls)).toContain("Kunduzgi");
  });

  test("noma'lum MASHINA slug'i chizilmaydi (`—` bo'ladi)", async () => {
    const { calls } = await render(
      fixture({ educationForm: "distance_learning", evaluationForm: "viva" }),
    );
    const t = textsOf(calls);
    expect(t).not.toContain("distance_learning");
    expect(t).not.toContain("viva");
    expect(t).toContain("—");
  });
});

describe("xom ObjectId hujjatda — hech qachon", () => {
  test("populate qilingan lavozim sarlavhasi chiziladi", async () => {
    const { calls } = await render();
    expect(textsOf(calls)).toContain(" Professor");
  });

  test("populate yechilmasa xom id emas, qator butunlay tushmaydi", async () => {
    const doc = fixture();
    doc.author.teacher.position = POSITION_ID;
    const { calls } = await render(doc);
    const t = textsOf(calls);
    expect(t).not.toContain(POSITION_ID);
    expect(t).not.toContain(` ${POSITION_ID}`);
    expect(t).not.toContain("Lavozimi:");
  });

  test("UMUMIY QULF — hujjatda 24-hex ObjectId shakli yo'q", async () => {
    const doc = fixture();
    doc.author.teacher.position = POSITION_ID;
    doc.scienceType = "6a7d69082200e50d919e2b41";
    doc.author.organization = "6a7d69082200e50d919e2b22";
    const { calls } = await render(doc);
    const joined = textsOf(calls).join(" | ");
    expect(joined).not.toMatch(/\b[0-9a-f]{24}\b/i);
  });
});

describe("apostrofli matn buzilmaydi", () => {
  test("`A'lo (5)` aynan shunday chiziladi", async () => {
    const { calls } = await render();
    const t = textsOf(calls);
    expect(t).toContain("A'lo (5)");
    expect(t).toContain("A'lo (5) bahosi uchun mezon");
    expect(t.join(" | ")).not.toContain("'A'otliq");
  });
});

describe("fan nomi/kodi — `science.title` va `science.scienceCode`", () => {
  test("zarvaraqda fan nomi, kartochkada fan kodi chiqadi", async () => {
    const { calls } = await render();
    const t = textsOf(calls);
    expect(t).toContain("MEHNAT GIGIYENASI");
    expect(t).toContain("FA1003");
    expect(t).not.toContain("Fan nomi ko'rsatilmagan");
  });
});

describe("kafedra yig'ilishi bayoni (blanka: zarvaraqning orqasi)", () => {
  test("jumla chiziladi, kafedra nomi takrorlanmaydi, raqam bo'sh", async () => {
    const { calls } = await render();
    const line = textsOf(calls).find((s) => s.startsWith("Mazkur Sillabus"));
    expect(line).toBeDefined();
    expect(line).toContain("“Gigiyena va ekologiya” kafedrasining");
    expect(line).not.toContain("kafedrasi” kafedrasining");
    expect(line).toContain("___-sonli");
    expect(line).toContain("2026-yil 19-avgustdagi");
  });

  test("kafedra qadami tasdiqlanmagan bo'lsa sana ham bo'sh joy", async () => {
    const { calls } = await render(emptyFixture());
    const line = textsOf(calls).find((s) => s.startsWith("Mazkur Sillabus"));
    expect(line).toContain("_____________ dagi");
    expect(line).toContain("___-sonli");
  });
});

describe("bo'sh ma'lumot — xato bermaydi, `—` chiziladi", () => {
  test("deyarli bo'sh hujjat ham yaroqli PDF beradi", async () => {
    const { buf, calls } = await render(emptyFixture());
    expect(buf.slice(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pageCount(buf)).toBeGreaterThan(0);
    expect(textsOf(calls)).toContain("—");
  });

  test("mavjud bo'limlar OLIB TASHLANMAGAN (imzolar, o'qituvchi ma'lumoti)", async () => {
    const { calls } = await render();
    const t = textsOf(calls);
    expect(t).not.toContain("Tasdiqlash jarayoni");
    expect(t).toContain("O'quv-uslubiy boshqarma boshlig'i:");
    expect(t).toContain("Fakultet dekani:");
    expect(t).toContain("Kafedra mudiri:");
    expect(t).toContain("Tuzuvchi:");
    expect(t).toContain("Taqrizchilar:");
    expect(t).toContain("Fan o'qituvchisi to'g'risida ma'lumot");
  });
});

describe("L-07 — kafedra bayonnoma raqami va Bilim/Ta'lim sohasi", () => {
  const withProtocol = (protocol) =>
    fixture({
      approvalSteps: [
        {
          step: "kafedra",
          status: "approved",
          approvedBy: { firstName: "Sanjar", lastName: "Abdusalimov" },
          date: new Date("2026-08-19T05:29:54.409Z"),
          protocol,
        },
      ],
    });

  test("kafedra bosqichida `protocol` bo'lsa — «7-sonli yig'ilish bayoni»", async () => {
    const { calls } = await render(withProtocol("7"));
    const t = textsOf(calls);
    expect(t.some((x) => x.includes("7-sonli yig'ilish bayoni"))).toBe(true);
    expect(t.some((x) => x.includes("___-sonli"))).toBe(false);
  });

  test("`protocol` yo'q (eski hujjat) — avvalgidek «___-sonli» (taxmin yo'q)", async () => {
    const { calls } = await render(withProtocol(null));
    const t = textsOf(calls);
    expect(t.some((x) => x.includes("___-sonli"))).toBe(true);
  });

  test("Bilim/Ta'lim sohasi — bog'langan fan dasturidan (populate) chiziladi", async () => {
    const { calls } = await render(
      fixture({
        scienceProgram: {
          code: "AN112312",
          knowledgeArea: ["Sog'liqni saqlash"],
          educationArea: ["Tibbiyot"],
        },
      }),
    );
    const t = textsOf(calls);
    expect(t).toContain("Sog'liqni saqlash");
    expect(t).toContain("Tibbiyot");
  });

  test("fan dasturida soha bo'sh bo'lsa — `—` (regressiya: eski xulq saqlanadi)", async () => {
    const { calls } = await render(fixture({ scienceProgram: { code: "X", knowledgeArea: [], educationArea: [] } }));
    const t = textsOf(calls);
    expect(t).toContain("Bilim sohasi:");
    expect(t).not.toContain("Sog'liqni saqlash");
  });
});

describe("D-9 — Bilim/Ta'lim sohasi fan dasturining yo'nalishlaridan", () => {
  const DIR = { knowledgeArea: "900000 – Sog'liqni saqlash", educationArea: "910000 – Sog'liqni saqlash" };
  const valueOf = (t, label) => t[t.indexOf(label) + 1];

  test("populate: fan dasturi `directions` bilan, ichida soha maydonlari", async () => {
    await render(fixture());
    const args = Syllabus.findById.mock.results[0].value.populate.mock.calls.map(([arg]) => arg);
    const sp = args.find((arg) => arg && arg.path === "scienceProgram");
    expect(sp.select.split(/\s+/)).toContain("directions");
    expect(sp.populate.path).toBe("directions");
    expect(sp.populate.select.split(/\s+/)).toEqual(expect.arrayContaining(["knowledgeArea", "educationArea"]));
  });

  test.each([
    ["dasturda soha bo'sh — yo'nalishdan (takrorsiz)", { directions: [DIR, { ...DIR }] }, [DIR.knowledgeArea, DIR.educationArea]],
    ["dasturning o'z sohasi ustun", { knowledgeArea: ["Tibbiyot"], educationArea: ["Stomatologiya"], directions: [DIR] }, ["Tibbiyot", "Stomatologiya"]],
    ["hech qayerda yo'q — «—»", { directions: [{ knowledgeArea: null }] }, ["—", "—"]],
  ])("%s", async (_n, sp, [bilim, talim]) => {
    const scienceProgram = { code: "X", knowledgeArea: [], educationArea: [], ...sp };
    const t = textsOf((await render(fixture({ scienceProgram }))).calls);
    expect(valueOf(t, "Bilim sohasi:")).toBe(bilim);
    expect(valueOf(t, "Ta'lim sohasi:")).toBe(talim);
  });
});
