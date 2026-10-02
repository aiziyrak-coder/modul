const fs = require("node:fs");
const path = require("node:path");

jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
  enrichMetaWithSlugRefs: jest.fn(),
}));

const Controller = require("./workingSchedule.controller");

const CONTROLLER = path.join(__dirname, "workingSchedule.controller.js");
const SRC = fs.readFileSync(CONTROLLER, "utf8");

const countOf = (haystack, needle) => haystack.split(needle).length - 1;

const PROJECTION_MARK = "science: link.science,";
const ALTERNATIVES_MARK = "alternatives: projectAlternatives(s),";

describe("generatsiya proyeksiyasi — alternativlar IKKALA nusxada ko'chadi", () => {
  test("fan qatori proyeksiyasi hamon ikki joyda (skaner mo'ljalni yo'qotmadi)", () => {
    expect(countOf(SRC, PROJECTION_MARK)).toBe(2);
  });

  test("har bir proyeksiya `projectAlternatives` ni chaqiradi", () => {
    expect(countOf(SRC, ALTERNATIVES_MARK)).toBe(
      countOf(SRC, PROJECTION_MARK),
    );
  });

  test("nusxa #1 (createOneCourseWorkingPlan) va nusxa #2 alohida-alohida", () => {
    const first = SRC.indexOf(ALTERNATIVES_MARK);
    const second = SRC.indexOf(ALTERNATIVES_MARK, first + 1);

    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(first).toBeGreaterThan(SRC.indexOf("const projectAlternatives ="));
  });

  test("mantiq dublikat qilinmagan — `alternatives` bitta joyda quriladi", () => {
    expect(countOf(SRC, "s?.alternatives")).toBe(1);
    expect(countOf(SRC, "s.alternatives.map(")).toBe(1);
  });
});

const { _projectAlternatives: projectAlternatives } = Controller;

const SCI_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DEP_C = "cccccccccccccccccccccccc";

describe("_projectAlternatives", () => {
  test("maydon yo'q bo'lsa `[]` (eski `studyPlan` hujjatlari)", () => {
    expect(projectAlternatives({ code: "TF101" })).toEqual([]);
    expect(projectAlternatives(null)).toEqual([]);
    expect(projectAlternatives({ alternatives: null })).toEqual([]);
  });

  test("science/code/title/department ko'chadi", () => {
    const out = projectAlternatives({
      alternatives: [
        {
          science: SCI_B,
          code: "TF102",
          title: "Tibbiyot tarixi",
          department: DEP_C,
        },
      ],
    });

    expect(out).toEqual([
      {
        science: SCI_B,
        code: "TF102",
        title: "Tibbiyot tarixi",
        department: DEP_C,
      },
    ]);
  });

  test("kredit/soat/particle KO'CHMAYDI (alternativning raqami yo'q)", () => {
    const out = projectAlternatives({
      alternatives: [
        { science: SCI_B, totalCredit: 3, weeklyHours: 2, particle: [{}] },
      ],
    });

    expect(Object.keys(out[0]).sort()).toEqual([
      "code",
      "department",
      "science",
      "title",
    ]);
  });

  test("manbadagi barcha qatorlar ko'chadi — jim `slice` YO'Q", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      science: SCI_B,
      code: `ALT${i}`,
    }));

    expect(projectAlternatives({ alternatives: many })).toHaveLength(5);
  });
});
