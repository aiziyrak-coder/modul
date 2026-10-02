const mongoose = require("mongoose");
const ScienceProgram = require("./scienceProgram.model");

const { CHAINS, LEGACY_STEPS, buildChainSteps } = ScienceProgram;

const oid = () => new mongoose.Types.ObjectId();
const st = (step, status = "pending") => ({ step, status });

const base = () => ({
  science: oid(),
  user: oid(),
  status: "in_review",
});

const stepErrors = (doc) => {
  const err = doc.validateSync();
  if (!err) return [];
  return Object.keys(err.errors).filter((k) => k.startsWith("approvalSteps"));
};

describe("ADR-035 — CHAINS / LEGACY_STEPS / buildChainSteps", () => {
  test("v259 = B1 (dekanda tugaydi), v142 o'zgarmagan", () => {
    expect(CHAINS.v259).toEqual(["teacher", "kafedra", "arm", "methodical", "dean"]);
    expect(CHAINS.v142).toEqual(["teacher", "kafedra", "dean"]);
  });

  test("LEGACY_STEPS = prorektor, rektor — faol zanjirlarda YO'Q", () => {
    expect(LEGACY_STEPS).toEqual(["prorektor", "rektor"]);
    for (const step of LEGACY_STEPS) {
      expect(CHAINS.v259).not.toContain(step);
      expect(CHAINS.v142).not.toContain(step);
    }
  });

  test("buildChainSteps: v142 → 3, v259 → 5, formVersion yo'q (legacy) → v259 B1 (ADR-008 inv #4)", () => {
    expect(buildChainSteps("v142").map((s) => s.step)).toEqual(CHAINS.v142);
    expect(buildChainSteps("v259").map((s) => s.step)).toEqual(CHAINS.v259);
    expect(buildChainSteps(undefined).map((s) => s.step)).toEqual(CHAINS.v259);
    expect(buildChainSteps(null).map((s) => s.step)).toEqual(CHAINS.v259);
    expect(buildChainSteps("v259")).not.toBe(buildChainSteps("v259"));
  });
});

describe("ADR-035 SHART #1 — legacy bosqichli hujjat enum'dan o'tadi (save() qotmaydi)", () => {
  test("legacy 6 bosqich (… → prorektor → rektor) — approvalSteps xatosi YO'Q", () => {
    const doc = new ScienceProgram({
      ...base(),
      formVersion: "v259",
      approvalSteps: ["teacher", "kafedra", "arm", "methodical", "prorektor", "rektor"].map(
        (s) => st(s, "approved"),
      ),
    });
    expect(stepErrors(doc)).toEqual([]);
  });

  test("S4 aralash zanjir [t✓,k✓,a✓,m✓,prorektor✓,dean] — xatosi YO'Q", () => {
    const doc = new ScienceProgram({
      ...base(),
      approvalSteps: [
        st("teacher", "approved"),
        st("kafedra", "approved"),
        st("arm", "approved"),
        st("methodical", "approved"),
        st("prorektor", "approved"),
        st("dean"),
      ],
    });
    expect(stepErrors(doc)).toEqual([]);
  });

  test("noma'lum bosqich hamon RAD etiladi (enum ochilib ketmagan)", () => {
    const doc = new ScienceProgram({
      ...base(),
      approvalSteps: [st("teacher"), st("boshqarma_boshligi")],
    });
    expect(stepErrors(doc).length).toBeGreaterThan(0);
  });

  test("schema default (`formVersion`siz konstruktor) — B1 zanjiri, hammasi pending", () => {
    const doc = new ScienceProgram(base());
    expect(doc.approvalSteps.map((s) => s.step)).toEqual(CHAINS.v259);
    expect(doc.approvalSteps.every((s) => s.status === "pending")).toBe(true);
  });
});
