const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);
jest.mock("#references/position/position.model");

const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const Position = require("#references/position/position.model");
const { buildDistributionPdf } = require("./distribution.pdf");

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const distFixture = (overrides = {}) => ({
  title: null,
  confirmation: {},
  department: { title: "Stomatologiya va otorinolaringologiya kafedrasi" },
  date: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  status: "draft",
  teachers: [],
  staffPositions: { items: [], totalPositions: 0, hourly: 0 },
  methodicalHead: null,
  financialHead: null,
  departmentHead: null,
  ...overrides,
});

const mockPositions = (docs) => {
  Position.find = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(docs),
  });
};

const render = async (dist) => {
  WorkloadDistribution.findById = jest.fn().mockReturnValue(chainablePopulate(dist));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildDistributionPdf("dist1");
    doc.end();
    return spy.mock.calls;
  } finally {
    spy.mockRestore();
  }
};

const texts = (calls) => calls.map((c) => c[0]).filter((t) => typeof t === "string");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Kadrlar jadvali — blanka sonlari hosiladan chiqadi", () => {
  const POSITION_DOCS = [
    { title: "Dotsent", annualHours: 650, date: "2024-01-01" },
    { title: "Katta o'qituvchi", annualHours: 750, date: "2024-01-01" },
    { title: "Assistent", annualHours: 850, date: "2024-01-01" },
  ];

  const fixture = () =>
    distFixture({
      teachers: [
        { position: "docent", stavka: 0.5, blocks: [{ science: { title: "Terapevtik stomatologiya" }, totalHour: 325 }] },
        { position: "senior_teacher", stavka: 1, blocks: [{ science: { title: "Ortopedik stomatologiya" }, totalHour: 750 }] },
        { position: "assistant", stavka: 33, blocks: [{ science: { title: "Bolalar stomatologiyasi" }, totalHour: 14000 }] },
        { position: "assistant", stavka: 0.5, blocks: [{ science: { title: "Parodontologiya" }, totalHour: 14608 }] },
      ],
    });

  test("'35' (Jami ish o'rni) va '29683' (asosiy jadval JAMI) chiziladi", async () => {
    mockPositions(POSITION_DOCS);
    const t = texts(await render(fixture()));
    expect(t).toContain("35");
    expect(t).toContain("29683");
  });

  test("har slugning 'Ish o'rinlari'/'O'quv yuklama'/'Jami soat' qiymatlari chiziladi", async () => {
    mockPositions(POSITION_DOCS);
    const t = texts(await render(fixture()));
    for (const v of ["0,5", "1", "33,5", "650", "750", "850", "325", "28608"]) {
      expect(t).toContain(v);
    }
  });

  test("hosila izoh qatori chiziladi, noma'lum/vakant shoxlari esa YO'Q (nol)", async () => {
    mockPositions(POSITION_DOCS);
    const t = texts(await render(fixture()));
    expect(t).toContain("Kadrlar jadvali taqsimot biriktirishidan hisoblangan");
    expect(t.filter((s) => s.startsWith("Lavozimi aniqlanmagan"))).toHaveLength(0);
    expect(t.filter((s) => s.startsWith("Vakant:"))).toHaveLength(0);
  });

  test("Position.find DB so'rovi active:true filtr bilan chaqiriladi", async () => {
    mockPositions(POSITION_DOCS);
    await render(fixture());
    expect(Position.find).toHaveBeenCalledWith({ active: true });
  });
});

describe("Kadrlar jadvali — Kengash #2: manual teachingStaff E'TIBORGA OLINMAYDI", () => {
  test("taqsimotning eski qo'lda items'dagi teachingStaff qiymati (777) bosilmaydi, departmentHead (7) esa bosiladi", async () => {
    mockPositions([{ title: "Professor", annualHours: 300, date: "2024-01-01" }]);
    const fixture = distFixture({
      teachers: [
        { position: "professor", stavka: 1, blocks: [{ science: { title: "Fiziologiya" }, totalHour: 300 }] },
      ],
      staffPositions: {
        items: [
          { category: "departmentHead", slug: "docent", title: "Kafedra mudiri", positions: 7, load: 0, totalHours: 0 },
          { category: "teachingStaff", slug: "assistant", title: "Assistent", positions: 777, load: 0, totalHours: 0 },
        ],
        totalPositions: 784,
        hourly: 0,
      },
    });
    const t = texts(await render(fixture));
    expect(t).not.toContain("777");
    expect(t).toContain("7");
  });
});

describe("Kadrlar jadvali — Kengash #3/#4: izoh qatorlari (noma'lum lavozim + vakant)", () => {
  test("'Lavozimi aniqlanmagan: 2 st. / 80 soat' chiziladi", async () => {
    mockPositions([{ title: "Professor", annualHours: 300, date: "2024-01-01" }]);
    const fixture = distFixture({
      teachers: [
        { position: "professor", stavka: 1, blocks: [{ science: { title: "Fiziologiya" }, totalHour: 300 }] },
        { position: null, stavka: 2, blocks: [{ science: { title: "Noma'lum fan" }, totalHour: 80 }] },
      ],
    });
    const t = texts(await render(fixture));
    expect(t).toContain("Lavozimi aniqlanmagan: 2 st. / 80 soat");
  });

  test("'Vakant: 120 soat' chiziladi", async () => {
    mockPositions([{ title: "Professor", annualHours: 300, date: "2024-01-01" }]);
    const fixture = distFixture({
      teachers: [
        { position: "professor", stavka: 1, blocks: [{ science: { title: "Fiziologiya" }, totalHour: 300 }] },
        { isVacant: true, vacantLabel: "Vakant 1", stavka: 1, blocks: [{ science: { title: "Bosh fan" }, totalHour: 120 }] },
      ],
    });
    const t = texts(await render(fixture));
    expect(t).toContain("Vakant: 120 soat");
  });
});

describe("Kadrlar jadvali — bo'sh taqsimot (fallback)", () => {
  test("teachers:[] bo'lsa Position.find chaqirilmaydi, eski staffPositions ishlatiladi", async () => {
    mockPositions([]);
    const fixture = distFixture({
      staffPositions: { items: [], totalPositions: 36, hourly: 0 },
    });
    const t = texts(await render(fixture));
    expect(Position.find).not.toHaveBeenCalled();
    expect(t).toContain("36");
    expect(t.filter((s) => s.includes("hisoblangan"))).toHaveLength(0);
  });
});

const staffRows = (t) => {
  const block = t.slice(t.indexOf("Ish o'rinlari"));
  const load = block.indexOf("O'quv yuklama");
  const hours = block.indexOf("Jami soat");
  const end = block.findIndex((s, i) => i > hours && !/^[\d,]+$/.test(s));
  return {
    positions: block.slice(1, load),
    load: block.slice(load + 1, hours),
    totalHours: block.slice(hours + 1, end === -1 ? undefined : end),
  };
};

describe("Kadrlar jadvali — jami ustunlari kumulyativ (blanka 5-bet)", () => {
  test("mudir 0.5 + o'qituvchilar 34.5 → 35 | 848 | 29683; + kabinet mudiri 1 → 36", async () => {
    mockPositions([
      { title: "Katta o'qituvchi", annualHours: 750, date: "2024-01-01" },
      { title: "Assistent", annualHours: 850, date: "2024-01-01" },
    ]);
    const fixture = distFixture({
      teachers: [
        { position: "senior_teacher", stavka: 1, blocks: [{ science: { title: "Ortopedik stomatologiya" }, totalHour: 750 }] },
        { position: "assistant", stavka: 33.5, blocks: [{ science: { title: "Bolalar stomatologiyasi" }, totalHour: 28608 }] },
      ],
      staffPositions: {
        items: [
          { category: "departmentHead", slug: "docent", positions: 0.5, load: 650, totalHours: 325 },
          { category: "supportStaff", slug: "cabinetHead", positions: 1, load: 0, totalHours: 0 },
        ],
        totalPositions: 1.5,
        hourly: 0,
      },
    });
    const rows = staffRows(texts(await render(fixture)));
    expect(rows.positions).toEqual(["0,5", "1", "33,5", "35", "1", "36"]);
    expect(rows.load).toEqual(["650", "750", "850", "848"]);
    expect(rows.totalHours).toEqual(["325", "750", "28608", "29683"]);
  });

  test("items[] bo'sh — ish o'rni hujjatning tayyor totalPositions'idan, yuklama/soat bo'sh", async () => {
    mockPositions([]);
    const fixture = distFixture({ staffPositions: { items: [], totalPositions: 36, hourly: 0 } });
    const rows = staffRows(texts(await render(fixture)));
    expect(rows.positions).toEqual(["36", "36"]);
    expect(rows.load).toEqual([]);
    expect(rows.totalHours).toEqual([]);
  });
});
