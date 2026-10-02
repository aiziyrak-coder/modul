const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const { buildWorkloadPdf } = require("./workload.pdf");

const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const staffPositions = () => ({
  items: [
    { category: "teachingStaff", slug: "professor", positions: 1, load: 550, totalHours: 550, hourly: 40 },
    { category: "teachingStaff", slug: "docent", positions: 2, load: 650, totalHours: 1300, hourly: 25 },
    { category: "teachingStaff", slug: "seniorTeacher", positions: 3, load: 750, totalHours: 2250 },
    { category: "teachingStaff", slug: "assistant", positions: 5, load: 850, totalHours: 4250 },
    { category: "teachingStaff", slug: "trainee", positions: 5, load: 850, totalHours: 4250 },
    { category: "supportStaff", slug: "seniorLaborant", positions: 1, load: 0, totalHours: 0, hourly: 12 },
  ],
  totalPositions: 16,
  hourly: 234,
});

const wlFixture = () => ({
  _id: new mongoose.Types.ObjectId(),
  title: null,
  agreed: {},
  confirmation: {},
  department: { title: "Mikrobiologiya, virusologiya va immunologiya kafedrasi" },
  date: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2024/2025" },
  status: "draft",
  directions: [],
  approvalSteps: [],
  staffPositions: staffPositions(),
  methodicalHead: null,
  financialHead: null,
  verify: null,
});

const renderCalls = async () => {
  WorkloadModel.findById = jest.fn().mockReturnValue(chainablePopulate(wlFixture()));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildWorkloadPdf("wl1");
    doc.end();
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

const rowAfter = (texts, label, n = 14) => {
  const i = texts.lastIndexOf(label);
  return i < 0 ? [] : texts.slice(i + 1, i + 1 + n);
};

describe("workload.pdf — asosiy jadval sarlavhasi", () => {
  test("'Amaliy Mashg'' — '(sem)' yo'q", async () => {
    const t = await renderCalls();
    expect(t).toContain("Amaliy Mashg'");
    expect(t.some((s) => /\(sem\)/.test(s))).toBe(false);
  });
});

describe("workload.pdf — Jadval 2 jami qoidalari (2026-09-18)", () => {
  test("'O'quv yuklama' jami = Jami soat ÷ Jami ish o'rni, butun son (788), yig'indi (3650) EMAS; oxirgi jami bo'sh", async () => {
    const t = await renderCalls();
    const row = rowAfter(t, "O'quv yuklama");
    expect(row).toContain("788");
    expect(row).not.toContain("741");
    expect(row).not.toContain("787.5");
    expect(row).not.toContain("3650");
  });

  test("'Ish o'rinlari' va 'Jami soat' jami — yig'indi (16 va 12600)", async () => {
    const t = await renderCalls();
    expect(rowAfter(t, "Ish o'rinlari")).toContain("16");
    expect(rowAfter(t, "Jami soat")).toContain("12600");
  });
});

describe("workload.pdf — Jadval 2 kumulyativ jami (2026-09-23)", () => {
  test("'Jami ish o'rinlari' (oxirgi ustun) = mudir + o'qituvchilar + o'quv yordamchi — 18, faqat ish o'rni qatorida", async () => {
    const withHead = wlFixture();
    withHead.staffPositions.items.unshift({
      category: "departmentHead", slug: "docent", positions: 1, load: 600, totalHours: 600, hourly: 10,
    });
    WorkloadModel.findById = jest.fn().mockReturnValue(chainablePopulate(withHead));
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    let t;
    try {
      const doc = await buildWorkloadPdf("wl1");
      doc.end();
      t = spy.mock.calls.map((c) => c[0]).filter((x) => typeof x === "string");
    } finally {
      spy.mockRestore();
    }
    const rowOf = (label, next) => {
      const i = t.lastIndexOf(label);
      return t.slice(i + 1, t.indexOf(next, i + 1));
    };
    expect(rowOf("Ish o'rinlari", "O'quv yuklama")).toEqual(["1", "1", "2", "3", "5", "5", "17", "1", "18"]);
    expect(rowOf("O'quv yuklama", "Jami soat")).toEqual(["600", "550", "650", "750", "850", "850", "776"]);
    expect(rowOf("Jami soat", "Soatbay")).toEqual(["600", "550", "1300", "2250", "4250", "4250", "13200"]);
    expect(rowOf("Soatbay", "O'quv-uslubiy boshqarma boshlig'i:")).toEqual(["10", "40", "25", "75", "12"]);
  });

  test("'Soatbay' — ustun qiymatlari qo'lda (`hourly`), guruh jami = yig'indi; hujjat qoldig'i (234) chizilmaydi", async () => {
    const t = await renderCalls();
    const row = rowAfter(t, "Soatbay");
    expect(row).toContain("40");
    expect(row).toContain("25");
    expect(row).toContain("65");
    expect(row).toContain("12");
    expect(row).not.toContain("234");
  });
});
