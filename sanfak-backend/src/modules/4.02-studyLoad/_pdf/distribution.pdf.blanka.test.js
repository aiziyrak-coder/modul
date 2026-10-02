const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);

const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const { buildDistributionPdf } = require("./distribution.pdf");

const DEPARTMENT = "Gigiyena va ekologiya kafedrasi";

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const distFixture = (overrides = {}) => ({
  title: null,
  confirmation: {},
  department: { title: DEPARTMENT },
  date: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  status: "draft",
  teachers: [],
  staffPositions: { items: [], totalPositions: 36, hourly: 0 },
  methodicalHead: null,
  financialHead: null,
  departmentHead: null,
  ...overrides,
});

const render = async (dist) => {
  WorkloadDistribution.findById = jest
    .fn()
    .mockReturnValue(chainablePopulate(dist));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildDistributionPdf("dist1");
    doc.end();
    return spy.mock.calls;
  } finally {
    spy.mockRestore();
  }
};

const texts = (calls) =>
  calls.map((c) => c[0]).filter((t) => typeof t === "string");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("drawDocTitle — 'ning' qo'shimchasi (B1)", () => {
  test("sarlavhada ajralgan \" ning \" YO'Q", async () => {
    const calls = await render(distFixture());
    const bad = texts(calls).filter((t) => t.includes(" ning "));
    expect(bad).toEqual([]);
  });

  test("sarlavha = faqat kafedra nomi, qo'shtirnoqda (taqsimot blankasi)", async () => {
    const calls = await render(distFixture());
    expect(texts(calls)).toContain(`"${DEPARTMENT}"`);
  });

  test("sarlavhaga o'quv yili / 'soatlar hisobi' KIRMAYDI (yuklama iborasi emas)", async () => {
    const calls = await render(distFixture());
    const bad = texts(calls).filter(
      (t) => t.includes("soatlar hisobi va ish o'rinlari") || t.includes(`${DEPARTMENT}ning`),
    );
    expect(bad).toEqual([]);
  });

  test("nomi 'kafedrasi'siz bo'lsa — ' kafedrasi' qo'shiladi", async () => {
    const fx = distFixture();
    fx.department = { ...fx.department, title: "Normal anatomiya" };
    const calls = await render(fx);
    expect(texts(calls)).toContain('"Normal anatomiya kafedrasi"');
  });
});

describe("drawDocTitle — sana 'dd.mm.yyyy holatiga' (T-12)", () => {
  test("saqlangan '23/09/2026' → '23.09.2026 holatiga'", async () => {
    const t = texts(await render(distFixture({ date: "23/09/2026" })));
    expect(t).toContain("23.09.2026 holatiga");
    expect(t).not.toContain("23/09/2026 holatiga");
  });
});

describe("drawConfirmationHeader — tasdiq blokida kafedra nomi yo'q (B2)", () => {
  test("kafedra nomi tasdiq blokida chizilmaydi", async () => {
    const calls = await render(distFixture());
    expect(texts(calls)).not.toContain(DEPARTMENT);
  });

  test("F.I.O manbasi bo'lsa — lavozimdan keyin imzolovchi F.I.O chiziladi", async () => {
    const calls = await render(
      distFixture({
        confirmation: { rector: { lastName: "Boltaboyev", firstName: "U." } },
      }),
    );
    const t = texts(calls);
    expect(t).toContain("O'quv ishlari bo'yicha prorektor");
    expect(t).toContain("U.Boltaboyev");
    expect(t).not.toContain(DEPARTMENT);
  });

  test("F.I.O manbasi bo'lmasa — bo'sh chiziq qoladi, kafedra nomi bosilmaydi", async () => {
    const calls = await render(distFixture({ confirmation: {} }));
    expect(texts(calls)).not.toContain(DEPARTMENT);
  });
});

describe("Imlo — blanka bilan bir xil (B3)", () => {
  const CASES = [
    { eski: "O'uv yordamchi xodimlar", blanka: "O'quv yordamchi xodimlar" },
    { eski: "Guruhichalar soni", blanka: "Guruhchalar soni" },
    {
      eski: "Qoldir.dars Qo'yra topsh.Qab.qil.",
      blanka: "Qoldir.dars Qayta topsh. Qab.qil.",
    },
    { eski: "Malakaviy amaliyoti", blanka: "Malakaviy amaliyot" },
  ];

  test.each(CASES)("'$blanka' chiziladi", async ({ blanka }) => {
    const calls = await render(distFixture());
    expect(texts(calls)).toContain(blanka);
  });

  test.each(CASES)("eski imlo '$eski' endi chizilmaydi", async ({ eski }) => {
    const calls = await render(distFixture());
    expect(texts(calls)).not.toContain(eski);
  });
});

describe("drawStaffTable — 'Jami ish o'rni' (B4)", () => {
  test("AYNAN BIR MARTA chiziladi (guruh + leaf sarlavhasi ustma-ust tushmaydi)", async () => {
    const calls = await render(distFixture());
    const hits = texts(calls).filter((t) => t === "Jami ish o'rni");
    expect(hits).toHaveLength(1);
  });

  test("qo'shni guruh sarlavhalari va O'UX leaf ustunlari chizilishda davom etadi", async () => {
    const t = texts(await render(distFixture()));
    expect(t).toContain("Kafedra mudiri");
    expect(t).toContain("Professor o'qituvchilar");
    expect(t).toContain("O'quv yordamchi xodimlar");
    expect(t).toContain("Jami ish o'rinlari");
    expect(t).toContain("Katta laborant");
  });
});

describe("drawTableHeader — oxirgi 'Jami soat' ustuni (B5)", () => {
  test("AYNAN BIR MARTA chiziladi (sikl + span katagi ustma-ust tushmaydi)", async () => {
    const t = texts(await render(distFixture()));
    const end = t.indexOf("JAMI:");
    expect(end).toBeGreaterThan(-1);
    expect(t.slice(0, end).filter((x) => x === "Jami soat")).toHaveLength(1);
  });

  test("butun hujjatda 2 ta: jadval sarlavhasi + kadrlar jadvali yorlig'i", async () => {
    const t = texts(await render(distFixture()));
    expect(t.filter((x) => x === "Jami soat")).toHaveLength(2);
  });

  test("3-qator siklining qolgan ustunlari chizilishda davom etadi", async () => {
    const t = texts(await render(distFixture()));
    expect(t).toContain("Umumiy soat");
    expect(t).toContain("Malakaviy amaliyot");
  });
});
