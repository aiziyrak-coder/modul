jest.mock("#modules/4.02-studyLoad/_pdf/workingPlan.pdf", () => ({
  generateWorkingPlanPdf: jest.fn(),
}));

const WorkingPlanModel = require("./workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const Controller = require("./workingPlan.controller");

const WS_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const semester1 = () => ({
  blocks: [
    {
      _id: "blk1",
      blockCode: "MF1",
      title: "Majburiy fanlar",
      sciences: [
        { _id: "s0", serialNumber: "1.2.", code: "", title: "Klinika oldi fanlari moduli", totalCredit: 7 },
        { _id: "s1", serialNumber: "1.2.12", code: "KAN1504", title: "Klinik anatomiya", totalCredit: 4 },
        { _id: "s2", serialNumber: "1.2.13", code: "PAN15-606", title: "Patologik anatomiya", totalCredit: 3 },
        { _id: "s3", serialNumber: "", code: "", title: "Jami", totalCredit: 7 },
      ],
    },
  ],
});

const planDoc = () => ({ _id: "wp1", semesters: { 1: semester1() } });

const mockFindOne = (doc) =>
  jest.spyOn(WorkingPlanModel, "findOne").mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      }),
    }),
  });

const mockParentCourse = (currentCourse = 1) =>
  jest.spyOn(WorkingScheduleModel, "findById").mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(
        currentCourse == null ? null : { currentCourse },
      ),
    }),
  });

const call = async (handler, doc, currentCourse = 1) => {
  mockFindOne(doc);
  mockParentCourse(currentCourse);
  const res = createRes();
  await Controller[handler](
    { query: { workingSchedule: WS_ID }, scope: {} },
    res,
    jest.fn(),
  );
  return res.json.mock.calls[0][0];
};

describe("findAllWorkingPlansSchedule — `rowType` kontrakti (FE shu bo'yicha yashiradi)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("sarlavha / yig'indi / fan — uch xil `rowType`", async () => {
    const body = await call("findAllWorkingPlansSchedule", planDoc());
    const rows = body.semesters["1"].blocks[0].sciences;
    const typeOf = (title) => rows.find((r) => r.title === title).rowType;

    expect(typeOf("Klinika oldi fanlari moduli")).toBe("sectionHeader");
    expect(typeOf("Jami")).toBe("aggregate");
    expect(typeOf("Klinik anatomiya")).toBe("subject");
    expect(typeOf("Patologik anatomiya")).toBe("subject");
  });

  test("har qatorda `rowType` BOR (FE undefined tekshirishi shart emas)", async () => {
    const body = await call("findAllWorkingPlansSchedule", planDoc());
    const rows = body.semesters["1"].blocks[0].sciences;
    expect(rows.every((r) => typeof r.rowType === "string")).toBe(true);
  });

  test("tekis (sarlavhasiz) reja — hammasi 'subject' (regressiya yo'q)", async () => {
    const flat = {
      _id: "wp2",
      semesters: {
        1: {
          blocks: [
            {
              blockCode: "MFI",
              sciences: [
                { serialNumber: "1", code: "FA1", title: "Fan A", totalCredit: 4 },
                { serialNumber: "2", code: "FA2", title: "Fan B", totalCredit: 3 },
              ],
            },
          ],
        },
      },
    };
    const body = await call("findAllWorkingPlansSchedule", flat);
    expect(
      body.semesters["1"].blocks[0].sciences.map((r) => r.rowType),
    ).toEqual(["subject", "subject"]);
  });
});

describe("findAllWorkingPlansSchedule — `semesterNumbers` kontrakti", () => {
  afterEach(() => jest.restoreAllMocks());

  test("lokal kalit → global raqam (III bosqich: 1→5, 2→6)", async () => {
    const out = await call(
      "findAllWorkingPlansSchedule",
      { _id: "wp1", semesters: { 1: semester1(), 2: semester1() } },
      3,
    );
    expect(out.semesterNumbers).toEqual({ 1: "5", 2: "6" });
  });

  test("currentCourse yo'q (eski hujjat) → lokal raqamning o'zi", async () => {
    const out = await call("findAllWorkingPlansSchedule", planDoc(), null);
    expect(out.semesterNumbers).toEqual({ 1: "1" });
  });
});

describe("findAllWorkingPlansSchedule — `electiveSlot` va `unfilledSlots`", () => {
  afterEach(() => jest.restoreAllMocks());

  test("slot qatori `electiveSlot`, ro'yxatda semKey/blockId/rowId/kredit/soat", async () => {
    const { EMPTY_SLOT_TITLE } = require("#modules/4.02-studyLoad/_shared/planRowType");
    const slot = { _id: "slot1", serialNumber: "2.01", code: null, science: null, title: EMPTY_SLOT_TITLE, totalCredit: 5, weeklyHours: 5 };
    const doc = {
      _id: "wp1",
      semesters: {
        1: { blocks: [{ _id: "tf", blockCode: "TF2", title: "Tanlov fanlar", sciences: [slot] }] },
        2: semester1(),
      },
    };
    const out = await call("findAllWorkingPlansSchedule", doc);
    expect(out.semesters[1].blocks[0].sciences[0].rowType).toBe("electiveSlot");
    expect(out.unfilledSlots).toEqual([
      { semKey: "1", blockId: "tf", rowId: "slot1", serialNumber: "2.01", credit: 5, hour: 5 },
    ]);
    expect(out.semesters[2].blocks[0].sciences.map((s) => s.rowType)).toEqual([
      "sectionHeader",
      "subject",
      "subject",
      "aggregate",
    ]);
  });

  test("slot yo'q — `unfilledSlots: []` (maydon har doim bor)", async () => {
    const out = await call("findAllWorkingPlansSchedule", planDoc());
    expect(out.unfilledSlots).toEqual([]);
  });

  test("MAJBURIY blokdagi slotga o'xshash qator — `subject`, ro'yxatga KIRMAYDI", async () => {
    const { EMPTY_SLOT_TITLE } = require("#modules/4.02-studyLoad/_shared/planRowType");
    const fake = { _id: "f1", serialNumber: "1.05", code: null, science: null, title: EMPTY_SLOT_TITLE, totalCredit: 2 };
    const doc = { _id: "wp1", semesters: { 1: { blocks: [{ _id: "mf", blockCode: "MF1", title: "Majburiy fanlar", sciences: [fake] }] } } };
    const out = await call("findAllWorkingPlansSchedule", doc);
    expect(out.semesters[1].blocks[0].sciences[0].rowType).toBe("subject");
    expect(out.unfilledSlots).toEqual([]);
  });
});

describe("findAllFanlarRoyxati — sarlavha/yig'indi qatori ro'yxatga KIRMAYDI", () => {
  afterEach(() => jest.restoreAllMocks());

  test("faqat leaf fanlar qoladi, kredit IKKI MARTA sanalmaydi", async () => {
    const body = await call("findAllFanlarRoyxati", planDoc());
    const block = body.blocks[0];

    expect(block.sciences.map((s) => s.title)).toEqual([
      "Klinik anatomiya",
      "Patologik anatomiya",
    ]);
    expect(block.jamiKreditlar).toBe(7);
    expect(body.grandTotalCredit).toBe(7);
  });

  test("sarlavhaning bolalari BOSHQA semestrda bo'lsa ham tanib olinadi", async () => {
    const doc = {
      _id: "wp3",
      semesters: {
        1: {
          blocks: [
            {
              _id: "blk1",
              blockCode: "MF1",
              sciences: [
                { _id: "h1", serialNumber: "1.1.", code: "", title: "Modul", totalCredit: 4 },
              ],
            },
          ],
        },
        2: {
          blocks: [
            {
              _id: "blk1",
              blockCode: "MF1",
              sciences: [
                { _id: "c1", serialNumber: "1.1.01", code: "FA9", title: "Fan D", totalCredit: 4 },
              ],
            },
          ],
        },
      },
    };
    const body = await call("findAllFanlarRoyxati", doc);
    expect(body.blocks[0].sciences.map((s) => s.title)).toEqual(["Fan D"]);
    expect(body.grandTotalCredit).toBe(4);
  });
});
