const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const { buildWorkloadPdf } = require("./workload.pdf");

const LEFT_X = 18;
const RIGHT_X = 18 + 806 - 200;

const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const wlFixture = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  department: { title: "Stomatologiya va otorinolaringologiya kafedrasi" },
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  directions: [],
  approvalSteps: [],
  agreed: {},
  confirmation: {},
  methodicalHead: null,
  financialHead: null,
  staffPositions: null,
  ...overrides,
});

const render = async (wl) => {
  WorkloadModel.findById = jest.fn().mockReturnValue(chainablePopulate(wl));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildWorkloadPdf("wl1");
    doc.end();
    return spy.mock.calls;
  } finally {
    spy.mockRestore();
  }
};

const xOf = (calls, text) => {
  const call = calls.find((c) => c[0] === text);
  return call ? call[1] : null;
};

const texts = (calls) => calls.map((c) => c[0]);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("drawApprovalHeader — TASDIQLAYMAN chapda, KELISHILDI o'ngda", () => {
  test("'TASDIQLAYMAN' CHAP ustunda chiziladi", async () => {
    const calls = await render(wlFixture());
    expect(xOf(calls, '"TASDIQLAYMAN"')).toBe(LEFT_X);
  });

  test("'KELISHILDI' O'NG ustunda chiziladi", async () => {
    const calls = await render(wlFixture());
    expect(xOf(calls, '"KELISHILDI"')).toBe(RIGHT_X);
  });

  test("tasdiq bloki kelishuv blokidan CHAPDA turadi (blanka tartibi)", async () => {
    const calls = await render(wlFixture());
    expect(xOf(calls, '"TASDIQLAYMAN"')).toBeLessThan(
      xOf(calls, '"KELISHILDI"'),
    );
  });

  test("lavozimlar bloklariga mos: rektor CHAPDA, prorektor O'NGDA", async () => {
    const calls = await render(wlFixture());
    expect(
      xOf(calls, "Farg'ona jamoat salomatligi tibbiyot instituti rektori"),
    ).toBe(LEFT_X);
    expect(xOf(calls, "O'quv ishlari bo'yicha prorektor")).toBe(RIGHT_X);
  });

  test("hujjatdan kelgan imzolovchi F.I.O ham o'z blokining ustunida chiziladi", async () => {
    const calls = await render(
      wlFixture({
        confirmation: { rector: { lastName: "Karimov", firstName: "R." } },
        agreed: { viceRector: { lastName: "Boltaboyev", firstName: "U." } },
      }),
    );
    expect(xOf(calls, "R.Karimov")).toBe(LEFT_X);
    expect(xOf(calls, "U.Boltaboyev")).toBe(RIGHT_X);
  });
});

describe("COLS — ustun sarlavhalari imlosi (blanka bilan bir xil)", () => {
  const CASES = [
    {
      eski: "Qoldirilgan dars. Qo'shimcha topsh. qabul qilish",
      blanka: "Qoldirilgan dars. Qayta topsh. qabul qilish",
    },
    {
      eski: "KO rahbarlik qilish (soat)",
      blanka: "KO rahbarlik qilish (1 KO uchun 100 soat)",
    },
    { eski: "kafedralar", blanka: "kafedrada" },
    { eski: "Qabul", blanka: "Qabul (ijodiy imtihon) da qatnashish" },
    {
      eski: "YADA da umumiy ma'ruza va mashg'ulot o'tkazish",
      blanka: "YADA da umum ma'r.va mas.o'tkazish qatnashishi",
    },
    { eski: "Auditoriya soat", blanka: "Auditoriya soati" },
    { eski: "VADA da qatnashish", blanka: "YADA da qatnashish" },
    {
      eski: "MI laiga ilmiy mulaziratchilik",
      blanka: "MI larga ilmiy maslaxatchilik",
    },
  ];

  test.each(CASES)("'$blanka' chiziladi", async ({ blanka }) => {
    const calls = await render(wlFixture());
    expect(texts(calls)).toContain(blanka);
  });

  test.each(CASES)("eski imlo '$eski' endi chizilmaydi", async ({ eski }) => {
    const calls = await render(wlFixture());
    expect(texts(calls)).not.toContain(eski);
  });
});
