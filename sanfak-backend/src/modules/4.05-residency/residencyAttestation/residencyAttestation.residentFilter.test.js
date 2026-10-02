jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("./residencyAttestation.model");
jest.mock("./residencyAttestationResult.model");

const {
  _residentFilter: attestationFilter,
} = require("./residencyAttestation.controller");
const {
  residentFilter: testFilter,
} = require("#modules/4.05-residency/residencyTest/residencyTest.service");

describe("attestatsiya kesimi — darvoza", () => {
  it("bo'sh kesim = o'quvda + chetlatish loyihasi yo'q", () => {
    expect(attestationFilter({})).toEqual({
      active: true,
      status: "oquvda",
      expulsionOrderCreated: { $ne: true },
    });
  });

  it("IKKI darvoza kesim to'ldirilganda ham qoladi", () => {
    const f = attestationFilter({ specialty: "s1", program: "ordinatura" });
    expect(f.status).toBe("oquvda");
    expect(f.expulsionOrderCreated).toEqual({ $ne: true });
    expect(f.specialty).toBe("s1");
  });

  it("QORA ro'yxat EMAS — `status` aniq satr", () => {
    expect(typeof attestationFilter({}).status).toBe("string");
  });
});

describe("attestatsiya va sinov filtrlari BIR XIL darvozaga ega", () => {
  const cases = [
    {},
    { specialty: "s1" },
    { program: "ordinatura", courseNumber: 2 },
    { group: "g1", academicYear: "2026-2027" },
  ];

  it.each(cases)("bir xil kirishda bir xil darvoza: %o", (input) => {
    const a = attestationFilter(input);
    const t = testFilter(input);
    expect({
      active: a.active,
      status: a.status,
      expulsionOrderCreated: a.expulsionOrderCreated,
    }).toEqual({
      active: t.active,
      status: t.status,
      expulsionOrderCreated: t.expulsionOrderCreated,
    });
  });
});
