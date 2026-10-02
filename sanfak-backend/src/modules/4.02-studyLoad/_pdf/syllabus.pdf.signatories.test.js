const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.model");

const Syllabus = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const { buildSyllabusPdf } = require("./syllabus.pdf");

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
  confirmation: { confirm: null, position: null, viceRector: null, date: null },
  science: { title: "Mehnat gigiyenasi", scienceCode: "FA1003", department: { title: "Kafedra" } },
  scienceTitle: null,
  scienceType: null,
  scienceCode: null,
  faculty: { title: "Tibbiy profilaktika fakulteti" },
  directions: [],
  year: 0,
  semester: 1,
  credits: 0,
  educationForm: null,
  evaluationForm: null,
  scienceLang: null,
  hoursByType: { title: null, totalHours: 0, items: [] },
  sciencePurpose: { title: null, desc: null },
  prerequisiteKnowledge: { title: null, desc: null },
  learningOutcome: { knowledgeOutcomes: [], skillOutcomes: [] },
  scienceContent: { title: null, desc: null, topics: [] },
  trainingSeminar: { title: null, topics: [] },
  independent: { title: null, topics: [] },
  literatureGroups: [],
  evaluationCriteria: { title: null, criteria: [] },
  author: { teacher: null, email: null, organization: null, reviewer: {} },
  desc: null,
  weeklySchedule: { title: null, weeks: [] },
  submissionRules: { title: null, desc: null },
  contactInfo: {},
  methodicalHead: {},
  facultyDean: {},
  departmentHead: {},
  creator: {},
  approvalSteps: [{ step: "kafedra", status: "pending", approvedBy: null }],
  status: "draft",
  location: null,
  ...overrides,
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

const render = async (doc) => {
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const pdf = await build(doc);
    await docToBuffer(pdf);
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("O'UB (methodicalHead) qatori — ADR-019 zanjirdan avto-to'ldirish", () => {
  test("`methodical` bosqichi approved bo'lsa — ism chiziladi (qo'lda blok bo'sh)", async () => {
    const t = await render(
      fixture({
        approvalSteps: [
          {
            step: "methodical",
            status: "approved",
            approvedBy: { firstName: "Nodira", lastName: "Yusupova" },
            date: new Date("2026-08-20T00:00:00.000Z"),
          },
        ],
      }),
    );
    expect(t).toContain("N.Yusupova");
  });

  test("`methodical` bosqichi pending bo'lsa — ism chizilmaydi (ADR-021: placeholder chiziq YO'Q)", async () => {
    const t = await render(
      fixture({
        approvalSteps: [
          { step: "methodical", status: "pending", approvedBy: null, date: null },
        ],
      }),
    );
    expect(t).not.toContain("N.Yusupova");
  });

  test("qo'lda blok (`methodicalHead.leader`) to'ldirilgan bo'lsa — zanjirdan ustun turadi (manual)", async () => {
    const t = await render(
      fixture({
        methodicalHead: {
          position: null,
          leader: { firstName: "Anvar", lastName: "Qosimov" },
          date: null,
        },
        approvalSteps: [
          {
            step: "methodical",
            status: "approved",
            approvedBy: { firstName: "Boshqa", lastName: "Odam" },
            date: new Date(),
          },
        ],
      }),
    );
    expect(t).toContain("A.Qosimov");
  });

  test("populate qilinmagan xom ObjectId `methodicalHead.leader` — hech qachon chizilmaydi", async () => {
    const rawId = { toString: () => "6a7d69082200e50d919e2b3a" };
    const t = await render(
      fixture({
        methodicalHead: { position: null, leader: rawId, date: null },
        approvalSteps: [{ step: "kafedra", status: "pending", approvedBy: null }],
      }),
    );
    const leaked = t.some((s) => s.includes("6a7d69082200e50d919e2b3a"));
    expect(leaked).toBe(false);
  });
});

describe("Fakultet dekani (facultyDean) qatori — ADR-019/WP-A2 zanjirdan avto-to'ldirish", () => {
  test("`dean` bosqichi approved bo'lsa — ism chiziladi (qo'lda blok bo'sh)", async () => {
    const t = await render(
      fixture({
        approvalSteps: [
          {
            step: "dean",
            status: "approved",
            approvedBy: { firstName: "Sardor", lastName: "Rahimov" },
            date: new Date("2026-08-20T00:00:00.000Z"),
          },
        ],
      }),
    );
    expect(t).toContain("S.Rahimov");
  });

  test("`dean` bosqichi pending bo'lsa — ism chizilmaydi (ADR-021: placeholder chiziq YO'Q)", async () => {
    const t = await render(
      fixture({
        approvalSteps: [
          { step: "dean", status: "pending", approvedBy: null, date: null },
        ],
      }),
    );
    expect(t).not.toContain("S.Rahimov");
  });

  test("qo'lda blok (`facultyDean.dean`) to'ldirilgan bo'lsa — zanjirdan ustun turadi (manual)", async () => {
    const t = await render(
      fixture({
        facultyDean: {
          position: null,
          dean: { firstName: "Malika", lastName: "Tosheva" },
          date: null,
        },
        approvalSteps: [
          {
            step: "dean",
            status: "approved",
            approvedBy: { firstName: "Boshqa", lastName: "Odam" },
            date: new Date(),
          },
        ],
      }),
    );
    expect(t).toContain("M.Tosheva");
  });

  test("populate qilinmagan xom ObjectId `facultyDean.dean` — hech qachon chizilmaydi", async () => {
    const rawId = { toString: () => "6a7d69082200e50d919e2b3a" };
    const t = await render(
      fixture({
        facultyDean: { position: null, dean: rawId, date: null },
      }),
    );
    const leaked = t.some((s2) => s2.includes("6a7d69082200e50d919e2b3a"));
    expect(leaked).toBe(false);
  });
});

describe("Kafedra mudiri (departmentHead) qatori — ADR-019/WP-A2 zanjirdan avto-to'ldirish", () => {
  test("`kafedra` bosqichi approved bo'lsa — ism chiziladi (qo'lda blok bo'sh)", async () => {
    const t = await render(
      fixture({
        approvalSteps: [
          {
            step: "kafedra",
            status: "approved",
            approvedBy: { firstName: "Otabek", lastName: "Yoldoshev" },
            date: new Date("2026-08-20T00:00:00.000Z"),
          },
        ],
      }),
    );
    expect(t).toContain("O.Yoldoshev");
  });

  test("`kafedra` bosqichi pending bo'lsa — ism chizilmaydi (ADR-021: placeholder chiziq YO'Q)", async () => {
    const t = await render(
      fixture({
        approvalSteps: [
          { step: "kafedra", status: "pending", approvedBy: null, date: null },
        ],
      }),
    );
    expect(t).not.toContain("O.Yoldoshev");
  });

  test("populate qilinmagan xom ObjectId `departmentHead.manager` — hech qachon chizilmaydi", async () => {
    const rawId = { toString: () => "6a7d69082200e50d919e2b3a" };
    const t = await render(
      fixture({
        departmentHead: { position: null, manager: rawId, date: null },
      }),
    );
    const leaked = t.some((s2) => s2.includes("6a7d69082200e50d919e2b3a"));
    expect(leaked).toBe(false);
  });
});

describe("Tuzuvchi (creator) qatori — zanjir bosqichi EMAS, hujjat muallifidan", () => {
  test("`creator.teacher` populate qilingan bo'lsa — ism chiziladi", async () => {
    const t = await render(
      fixture({
        creator: {
          position: null,
          teacher: { firstName: "Dilnoza", lastName: "Karimova" },
          date: null,
        },
      }),
    );
    expect(t).toContain("D.Karimova");
  });

  test("`creator.teacher` bo'sh, lekin hujjat muallifi `author.teacher` populate qilingan — undan ism chiziladi", async () => {
    const t = await render(
      fixture({
        creator: { position: null, teacher: null, date: null },
        author: {
          teacher: { firstName: "Ibrohim", lastName: "Qodirjonov" },
          email: null,
          organization: null,
          reviewer: {},
        },
      }),
    );
    expect(t).toContain("I.Qodirjonov");
  });

  test("ikkalasi ham bo'sh bo'lsa — ism chizilmaydi, placeholder YO'Q (ADR-021)", async () => {
    const t = await render(fixture());
    expect(t).not.toContain("___________________________");
    expect(t).not.toContain("Tuzuvchi: undefined");
  });

  test("populate qilinmagan xom ObjectId (`creator.teacher` va `author.teacher`) — hech qachon chizilmaydi", async () => {
    const rawId = { toString: () => "6a7d69082200e50d919e2b3a" };
    const t = await render(
      fixture({
        creator: { position: null, teacher: rawId, date: null },
        author: { teacher: rawId, email: null, organization: null, reviewer: {} },
      }),
    );
    const leaked = t.some((s2) => s2.includes("6a7d69082200e50d919e2b3a"));
    expect(leaked).toBe(false);
  });
});
