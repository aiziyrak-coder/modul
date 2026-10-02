const {
  migrate,
  transformSteps,
  isTargetDoc,
} = require("./migrate-scienceprogram-v259-chain");

const st = (step, status = "pending") => ({ step, status });
const LEGACY = ["teacher", "kafedra", "arm", "methodical", "prorektor", "rektor"];

const makeDb = (docs) => {
  const calls = { updateOne: 0, sets: [] };
  return {
    calls,
    collection(name) {
      if (name !== "scienceprograms") {
        return { find: () => ({ toArray: async () => [] }) };
      }
      return {
        find: (filter) => ({
          toArray: async () =>
            docs.filter((d) =>
              filter && filter.status && filter.status.$ne
                ? d.status !== filter.status.$ne
                : true,
            ),
        }),
        updateOne: async (q, u) => {
          calls.updateOne += 1;
          calls.sets.push({ _id: q._id, steps: u.$set.approvalSteps });
          return { modifiedCount: 1 };
        },
      };
    },
  };
};

describe("transformSteps — sof qoida (B1, tarix saqlanadi)", () => {
  test("draft legacy 6 bosqich → B1 (prorektor/rektor tushadi, dean qo'shiladi)", () => {
    const r = transformSteps(LEGACY.map((s) => st(s)));
    expect(r.changed).toBe(true);
    expect(r.steps.map((s) => s.step)).toEqual([
      "teacher",
      "kafedra",
      "arm",
      "methodical",
      "dean",
    ]);
    expect(r.dropped).toEqual(["prorektor", "rektor"]);
    expect(r.added).toEqual(["dean"]);
    expect(r.steps.every((s) => s.status === "pending")).toBe(true);
  });

  test("in_review — approved bosqichlar (imzo bilan) BAYT-BAYT saqlanadi", () => {
    const signed = { step: "kafedra", status: "approved", approvedBy: "u2", protocol: "7" };
    const r = transformSteps([
      { step: "teacher", status: "approved", approvedBy: "u1" },
      signed,
      st("arm"),
      st("methodical"),
      st("prorektor"),
      st("rektor"),
    ]);
    expect(r.steps[1]).toBe(signed);
    expect(r.steps.map((s) => `${s.step}:${s.status}`)).toEqual([
      "teacher:approved",
      "kafedra:approved",
      "arm:pending",
      "methodical:pending",
      "dean:pending",
    ]);
  });

  test("S4 — prorektor allaqachon tasdiqlagan bo'lsa QOLADI, faqat pending rektor tushadi", () => {
    const r = transformSteps([
      st("teacher", "approved"),
      st("kafedra", "approved"),
      st("arm", "approved"),
      st("methodical", "approved"),
      st("prorektor", "approved"),
      st("rektor"),
    ]);
    expect(r.steps.map((s) => `${s.step}:${s.status}`)).toEqual([
      "teacher:approved",
      "kafedra:approved",
      "arm:approved",
      "methodical:approved",
      "prorektor:approved",
      "dean:pending",
    ]);
    expect(r.dropped).toEqual(["rektor"]);
  });

  test("rejected legacy bosqich (rektor rad etgan) SAQLANADI — holat yo'qolmaydi", () => {
    const r = transformSteps([
      st("teacher", "approved"),
      st("kafedra", "approved"),
      st("arm", "approved"),
      st("methodical", "approved"),
      st("prorektor", "approved"),
      st("rektor", "rejected"),
    ]);
    expect(r.steps.map((s) => s.step)).toEqual([
      ...LEGACY,
      "dean",
    ]);
    expect(r.dropped).toEqual([]);
  });

  test("idempotent — B1 hujjat ikkinchi o'tishda o'zgarmaydi", () => {
    const b1 = ["teacher", "kafedra", "arm", "methodical", "dean"].map((s) => st(s));
    const r = transformSteps(b1);
    expect(r.changed).toBe(false);
    expect(r.steps.map((s) => s.step)).toEqual(b1.map((s) => s.step));
  });

  test("bo'sh/yo'q approvalSteps — to'liq B1 quriladi", () => {
    expect(transformSteps(undefined).steps.map((s) => s.step)).toEqual([
      "teacher",
      "kafedra",
      "arm",
      "methodical",
      "dean",
    ]);
  });
});

describe("isTargetDoc — nishon tanlovi", () => {
  test("v259 / formVersion yo'q (legacy) va approved bo'lmagan — nishon", () => {
    expect(isTargetDoc({ formVersion: "v259", status: "draft" })).toBe(true);
    expect(isTargetDoc({ status: "in_review" })).toBe(true);
    expect(isTargetDoc({ formVersion: null, status: "rejected" })).toBe(true);
  });
  test("approved yoki v142 — TEGILMAYDI", () => {
    expect(isTargetDoc({ formVersion: "v259", status: "approved" })).toBe(false);
    expect(isTargetDoc({ formVersion: "v142", status: "draft" })).toBe(false);
  });
});

describe("migrate — dry-run va apply", () => {
  const fixture = () => [
    { _id: "legacyDraft", formVersion: "v259", status: "draft", approvalSteps: LEGACY.map((s) => st(s)) },
    { _id: "legacyNoVersion", status: "in_review", approvalSteps: [st("teacher", "approved"), ...LEGACY.slice(1).map((s) => st(s))] },
    { _id: "approvedLegacy", formVersion: "v259", status: "approved", approvalSteps: LEGACY.map((s) => st(s, "approved")) },
    { _id: "v142Draft", formVersion: "v142", status: "draft", approvalSteps: ["teacher", "kafedra", "dean"].map((s) => st(s)) },
    { _id: "alreadyB1", formVersion: "v259", status: "draft", approvalSteps: ["teacher", "kafedra", "arm", "methodical", "dean"].map((s) => st(s)) },
  ];

  test("DEFAULT (dry) — hisobot to'g'ri, DB'ga BIRORTA yozuv YO'Q", async () => {
    const db = makeDb(fixture());
    const r = await migrate({ db, apply: false, backup: false });
    expect(r.affected).toBe(2);
    expect(r.perDoc.map((d) => d._id)).toEqual(["legacyDraft", "legacyNoVersion"]);
    expect(r.written).toBe(0);
    expect(db.calls.updateOne).toBe(0);
  });

  test("--apply — faqat nishon hujjatlar yoziladi, approved/v142/B1 tegilmaydi", async () => {
    const db = makeDb(fixture());
    const r = await migrate({ db, apply: true, backup: false });
    expect(r.written).toBe(2);
    expect(db.calls.updateOne).toBe(2);
    const ids = db.calls.sets.map((s) => s._id);
    expect(ids).toEqual(["legacyDraft", "legacyNoVersion"]);
    for (const s of db.calls.sets) {
      expect(s.steps.map((x) => x.step)).toEqual([
        "teacher",
        "kafedra",
        "arm",
        "methodical",
        "dean",
      ]);
    }
  });
});
