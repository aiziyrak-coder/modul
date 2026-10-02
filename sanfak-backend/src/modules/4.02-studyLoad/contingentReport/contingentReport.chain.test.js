jest.mock("./contingentReport.model");
jest.mock("./contingentReport.prefill", () => ({
  PREFILL_CELLS: ["total", "groupCount", "streamCount"],
  buildPrefillRows: jest.fn(),
  mergePrefill: jest.fn(),
  rowKey: (r) => `${r.direction}|${r.course}`,
}));
jest.mock("#references/direction/direction.model", () => ({ find: jest.fn() }));
jest.mock("#references/faculty/faculty.model", () => ({ find: jest.fn() }));

const service = require("./contingentReport.service");
const { STEP_ORDER, STEP_ROLES, SUBMITTER_ROLES, buildChainSteps } = require("./contingentReport.chain");
const { ROLES } = require("#config/constants");

const VALID_ROW = {
  direction: "d1",
  course: 1,
  total: 5,
  boys: 3,
  girls: 2,
  grant: 4,
  contract: 1,
  grantBoys: 2,
  grantGirls: 2,
  contractBoys: 1,
  contractGirls: 0,
};

const makeDoc = (status = "draft", rows = [VALID_ROW]) => ({
  _id: "c1",
  faculty: "f1",
  status,
  rows,
  submittedAt: null,
  approvalSteps: STEP_ORDER.map((step) => ({
    step,
    status: "pending",
    approvedBy: null,
    date: null,
    comment: null,
    protocol: null,
    signature: null,
    eriSignature: null,
    eriSerial: null,
    eriSignedAt: null,
  })),
});

describe("zanjir ta'rifi", () => {
  test("bitta bosqich — dean, rol — dekan", () => {
    expect(STEP_ORDER).toEqual(["dean"]);
    expect(STEP_ROLES).toEqual({ dean: ROLES.DEKAN });
    expect(buildChainSteps()).toEqual([{ step: "dean" }]);
  });

  test("yuboruvchilar — dekan + fakultet kengash kotibi; O'UB/rektor YO'Q", () => {
    expect(SUBMITTER_ROLES).toEqual([ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI]);
    expect(SUBMITTER_ROLES).not.toContain(ROLES.OQUV_USLUBIY_BOSHQARMA);
    expect(SUBMITTER_ROLES).not.toContain(ROLES.REKTOR);
  });
});

describe("submitReport — yuborish", () => {
  test.each([ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI, ROLES.SUPER_ADMIN])(
    "%s yuboradi → in_review, submittedAt yoziladi, bosqich pending qoladi",
    (role) => {
      const doc = makeDoc("draft");
      service.submitReport(doc, { userRole: role, userId: "u1" });
      expect(doc.status).toBe("in_review");
      expect(doc.submittedAt).toBeInstanceOf(Date);
      expect(doc.approvalSteps[0].status).toBe("pending");
      expect(service.getCurrentStep(doc.approvalSteps).step).toBe("dean");
    },
  );

  test.each([ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.KAFEDRA_MUDIRI, ROLES.REKTOR])("%s yubora olmaydi → 403", (role) => {
    expect(() => service.submitReport(makeDoc("draft"), { userRole: role })).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  test("bo'sh jadval → 409", () => {
    expect(() => service.submitReport(makeDoc("draft", []), { userRole: ROLES.DEKAN })).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
  });

  test("draft bo'lmagan hujjat → 409", () => {
    expect(() => service.submitReport(makeDoc("in_review"), { userRole: ROLES.DEKAN })).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
  });
});

describe("approveStep — dekan tasdiqlaydi", () => {
  test("dekan → approved (yagona bosqich), protocol va imzo izlari yoziladi", () => {
    const doc = makeDoc("in_review");
    const res = service.approveStep(doc, {
      userRole: ROLES.DEKAN,
      userId: "dekan1",
      protocol: "5-son, 22.09.2026",
      signature: "sig",
      eriSignature: "pkcs7",
      eriSerial: "123",
    });
    expect(res.approvedStep).toBe("dean");
    expect(res.nextStep).toBeNull();
    expect(doc.status).toBe("approved");
    expect(doc.approvalSteps[0]).toMatchObject({
      status: "approved",
      approvedBy: "dekan1",
      protocol: "5-son, 22.09.2026",
      signature: "sig",
      eriSignature: "pkcs7",
      eriSerial: "123",
    });
    expect(doc.approvalSteps[0].date).toBeInstanceOf(Date);
    expect(doc.approvalSteps[0].eriSignedAt).toBeInstanceOf(Date);
  });

  test("kotib tasdiqlay olmaydi → 403 (faqat yuboradi)", () => {
    expect(() =>
      service.approveStep(makeDoc("in_review"), { userRole: ROLES.FAKULTET_KENGASH_KOTIBI }),
    ).toThrow(expect.objectContaining({ statusCode: 403 }));
  });

  test("draft hujjatga approve → 409 (avval yuborilsin)", () => {
    expect(() => service.approveStep(makeDoc("draft"), { userRole: ROLES.DEKAN })).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
  });

  test("`req.eri` (eriGuard) ustuvor — body eriSignature'dan", () => {
    const doc = makeDoc("in_review");
    service.approveStep(doc, {
      userRole: ROLES.DEKAN,
      eri: { signature: "GUARD", serialNumber: "S1", signedAt: new Date("2026-09-22") },
      eriSignature: "BODY",
    });
    expect(doc.approvalSteps[0].eriSignature).toBe("GUARD");
    expect(doc.approvalSteps[0].eriSerial).toBe("S1");
  });
});

describe("rejectReport / reopenReport", () => {
  test("dekan rad etadi → rejected, izoh saqlanadi", () => {
    const doc = makeDoc("in_review");
    const { rejectedStep } = service.rejectReport(doc, {
      userRole: ROLES.DEKAN,
      userId: "dekan1",
      comment: "Grant raqamlari noto'g'ri",
    });
    expect(rejectedStep).toBe("dean");
    expect(doc.status).toBe("rejected");
    expect(doc.approvalSteps[0]).toMatchObject({ status: "rejected", comment: "Grant raqamlari noto'g'ri" });
  });

  test("kotib rad eta olmaydi → 403", () => {
    expect(() =>
      service.rejectReport(makeDoc("in_review"), { userRole: ROLES.FAKULTET_KENGASH_KOTIBI }),
    ).toThrow(expect.objectContaining({ statusCode: 403 }));
  });

  test("qayta ochish (kotib) → draft, zanjir toza, jadval TEGILMAYDI", () => {
    const doc = makeDoc("rejected");
    doc.approvalSteps[0].status = "rejected";
    doc.approvalSteps[0].comment = "x";
    doc.submittedAt = new Date();
    service.reopenReport(doc, { userRole: ROLES.FAKULTET_KENGASH_KOTIBI });
    expect(doc.status).toBe("draft");
    expect(doc.submittedAt).toBeNull();
    expect(doc.approvalSteps).toEqual([{ step: "dean" }]);
    expect(doc.rows).toEqual([VALID_ROW]);
  });

  test("qayta ochish — faqat rejected (in_review → 409), O'UB → 403", () => {
    expect(() => service.reopenReport(makeDoc("in_review"), { userRole: ROLES.DEKAN })).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
    expect(() => service.reopenReport(makeDoc("rejected"), { userRole: ROLES.OQUV_USLUBIY_BOSHQARMA })).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });
});

describe("qulf — approved hujjatga hech qanday amal yo'q", () => {
  test.each([
    ["submit", (d) => service.submitReport(d, { userRole: ROLES.DEKAN })],
    ["approve", (d) => service.approveStep(d, { userRole: ROLES.DEKAN })],
    ["reject", (d) => service.rejectReport(d, { userRole: ROLES.DEKAN })],
    ["reopen", (d) => service.reopenReport(d, { userRole: ROLES.DEKAN })],
    ["assertEditable (PUT/prefill)", (d) => service.assertEditable(d)],
  ])("%s → 409", (_label, fn) => {
    expect(() => fn(makeDoc("approved"))).toThrow(expect.objectContaining({ statusCode: 409 }));
  });

  test("in_review hujjat tahrirlanmaydi (PUT/prefill 409), draft/rejected — mumkin", () => {
    expect(() => service.assertEditable(makeDoc("in_review"))).toThrow(expect.objectContaining({ statusCode: 409 }));
    expect(() => service.assertEditable(makeDoc("draft"))).not.toThrow();
    expect(() => service.assertEditable(makeDoc("rejected"))).not.toThrow();
  });
});

describe("yig'indi invariantlari zanjirda — 409 row_invariants", () => {
  const PREFILLED_ROW = { direction: "d1", directionTitle: "Davolash ishi", course: 2, total: 100 };

  test("prefill qatori (jami 100, o'g'il/qiz 0) yuborilmaydi → 409 + qatorlar ro'yxati", () => {
    const doc = makeDoc("draft", [VALID_ROW, PREFILLED_ROW]);
    let error;
    try {
      service.submitReport(doc, { userRole: ROLES.DEKAN });
    } catch (err) {
      error = err;
    }
    expect(error).toMatchObject({ statusCode: 409, meta: { reason: "row_invariants" } });
    expect(error.meta.rows).toEqual([
      { kind: "row", label: "Davolash ishi 2-kurs", message: "o'g'il + qiz jami talabaga teng emas" },
    ]);
    expect(doc.status).toBe("draft");
    expect(doc.submittedAt).toBeNull();
  });

  test("xorijiy talaba qatori ham tekshiriladi (o'g'il + qiz ≠ jami → 409)", () => {
    const doc = makeDoc("draft");
    doc.foreignByCountry = [{ country: "Hindiston", total: 3, boys: 1, girls: 1 }];
    expect(() => service.submitReport(doc, { userRole: ROLES.DEKAN })).toThrow(
      expect.objectContaining({ statusCode: 409, meta: expect.objectContaining({ reason: "row_invariants" }) }),
    );
  });

  test("tuzatishdan oldin yuborilgan (in_review) noto'g'ri hujjat tasdiqlanmaydi → 409", () => {
    const doc = makeDoc("in_review", [PREFILLED_ROW]);
    expect(() => service.approveStep(doc, { userRole: ROLES.DEKAN, userId: "dekan1" })).toThrow(
      expect.objectContaining({ statusCode: 409, meta: expect.objectContaining({ reason: "row_invariants" }) }),
    );
    expect(doc.status).toBe("in_review");
    expect(doc.approvalSteps[0].status).toBe("pending");
  });

  test("rol tekshiruvi invariantdan OLDIN — kotib noto'g'ri hujjatda ham 403 oladi", () => {
    expect(() =>
      service.approveStep(makeDoc("in_review", [PREFILLED_ROW]), { userRole: ROLES.FAKULTET_KENGASH_KOTIBI }),
    ).toThrow(expect.objectContaining({ statusCode: 403 }));
  });

  test("noto'g'ri jadvalli hujjatni dekan RAD ETA oladi (tuzattirish uchun)", () => {
    const doc = makeDoc("in_review", [PREFILLED_ROW]);
    service.rejectReport(doc, { userRole: ROLES.DEKAN, userId: "dekan1", comment: "Jins bo'yicha to'ldiring" });
    expect(doc.status).toBe("rejected");
  });
});

describe("buildSignatories — faqat approved bosqich, populate bo'lmasa ism yo'q", () => {
  test("approved + populate → ism va sana; pending → yo'q; xom id → yo'q", () => {
    const doc = makeDoc("approved");
    doc.approvalSteps[0] = {
      step: "dean",
      status: "approved",
      approvedBy: { firstName: "Rustam", lastName: "Rahmonov", middleName: "Abdullayevich" },
      date: new Date(2026, 8, 22),
    };
    expect(service.buildSignatories(doc)).toEqual({
      dean: { name: "R.A.Rahmonov", date: "2026-yil “ 22 ” sentabr" },
    });
    expect(service.buildSignatories(makeDoc("in_review"))).toEqual({});
    const raw = makeDoc("approved");
    raw.approvalSteps[0] = { step: "dean", status: "approved", approvedBy: "64f0000000000000000000aa", date: new Date() };
    expect(service.buildSignatories(raw)).toEqual({});
  });
});
