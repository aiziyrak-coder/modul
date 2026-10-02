jest.mock("./workloadSummary.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.service", () => ({
  loadSummaryWorkloads: jest.fn().mockResolvedValue([]),
}));
jest.mock("#references/department/department.model", () => ({
  find: jest.fn(() => ({ lean: () => ({ exec: async () => [] }) })),
}));

const service = require("./workloadSummary.service");
const { STEP_ORDER, STEP_ROLES } = require("./workloadSummary.chain");
const { ROLES } = require("#config/constants");

const makeDoc = (status = "draft") => ({
  _id: "s1",
  academicYear: "ay1",
  status,
  snapshot: { rows: [{ no: 1, department: "A" }], rowCount: 1 },
  approvalSteps: STEP_ORDER.map((step) => ({
    step,
    status: "pending",
    approvedBy: null,
    date: null,
    comment: null,
    signature: null,
    eriSignature: null,
    eriSerial: null,
    eriSignedAt: null,
  })),
});

describe("zanjir ta'rifi", () => {
  test("4 bosqich, namunadagi imzolar tartibida", () => {
    expect(STEP_ORDER).toEqual(["methodical", "financial", "prorektor", "rektor"]);
  });

  test("har bosqichda aniq rol bor", () => {
    expect(STEP_ROLES).toEqual({
      methodical: ROLES.OQUV_USLUBIY_BOSHQARMA,
      financial: ROLES.REJA_MOLIYA,
      prorektor: ROLES.PROREKTOR,
      rektor: ROLES.REKTOR,
    });
  });

  test("kafedra mudiri va dekan zanjirda YO'Q (institut darajasidagi hujjat)", () => {
    const roles = Object.values(STEP_ROLES);
    expect(roles).not.toContain(ROLES.KAFEDRA_MUDIRI);
    expect(roles).not.toContain(ROLES.DEKAN);
  });
});

describe("submitSummary — yuborish", () => {
  test("O'UB yuboradi; `methodical` BIRGA yopiladi", () => {
    const doc = makeDoc("draft");
    service.submitSummary(doc, {
      userRole: ROLES.OQUV_USLUBIY_BOSHQARMA,
      userId: "u1",
    });

    expect(doc.status).toBe("in_review");
    expect(doc.approvalSteps[0]).toMatchObject({
      step: "methodical",
      status: "approved",
      approvedBy: "u1",
    });
    expect(service.getCurrentStep(doc.approvalSteps).step).toBe("financial");
  });

  test("boshqa rol yubora olmaydi → 403", () => {
    const doc = makeDoc("draft");
    expect(() =>
      service.submitSummary(doc, { userRole: ROLES.REJA_MOLIYA, userId: "u2" }),
    ).toThrow(expect.objectContaining({ statusCode: 403 }));
  });

  test("qoralama bo'lmasa → 409", () => {
    expect(() =>
      service.submitSummary(makeDoc("in_review"), {
        userRole: ROLES.OQUV_USLUBIY_BOSHQARMA,
      }),
    ).toThrow(expect.objectContaining({ statusCode: 409 }));
  });
});

describe("approveStep — tartib va rol", () => {
  const submitted = () => {
    const doc = makeDoc("draft");
    service.submitSummary(doc, { userRole: ROLES.OQUV_USLUBIY_BOSHQARMA, userId: "u1" });
    return doc;
  };

  test("navbatdagi rol tasdiqlaydi", () => {
    const doc = submitted();
    const out = service.approveStep(doc, { userRole: ROLES.REJA_MOLIYA, userId: "u2" });
    expect(out.approvedStep).toBe("financial");
    expect(out.nextStep).toBe("prorektor");
    expect(doc.status).toBe("in_review");
  });

  test("navbati kelmagan rol TASDIQLAY OLMAYDI → 403", () => {
    const doc = submitted();
    expect(() =>
      service.approveStep(doc, { userRole: ROLES.REKTOR, userId: "u9" }),
    ).toThrow(expect.objectContaining({ statusCode: 403 }));
    expect(doc.approvalSteps[1].status).toBe("pending");
  });

  test("to'liq zanjir → approved", () => {
    const doc = submitted();
    service.approveStep(doc, { userRole: ROLES.REJA_MOLIYA, userId: "u2" });
    service.approveStep(doc, { userRole: ROLES.PROREKTOR, userId: "u3" });
    const last = service.approveStep(doc, { userRole: ROLES.REKTOR, userId: "u4" });

    expect(doc.status).toBe("approved");
    expect(last.nextStep).toBeNull();
    expect(doc.approvalSteps.every((s) => s.status === "approved")).toBe(true);
  });

  test("super_admin har bosqichni tasdiqlay oladi", () => {
    const doc = submitted();
    expect(() =>
      service.approveStep(doc, { userRole: ROLES.SUPER_ADMIN, userId: "adm" }),
    ).not.toThrow();
  });

  test("imzo izlari yoziladi (`req.eri` ustuvor)", () => {
    const doc = submitted();
    service.approveStep(doc, {
      userRole: ROLES.REJA_MOLIYA,
      userId: "u2",
      eri: { signature: "PKCS7", serialNumber: "SN1", signedAt: new Date("2026-09-17") },
      eriSignature: "ESKI",
    });
    expect(doc.approvalSteps[1].eriSignature).toBe("PKCS7");
    expect(doc.approvalSteps[1].eriSerial).toBe("SN1");
  });
});

describe("KONTENT QULFI — tasdiqlangan hujjat", () => {
  test.each([
    ["approved"],
    ["superseded"],
  ])("%s holatda zanjir amallari 409 beradi", (status) => {
    const doc = makeDoc(status);
    const ctx = { userRole: ROLES.SUPER_ADMIN, userId: "adm" };

    expect(() => service.submitSummary(doc, ctx)).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
    expect(() => service.approveStep(doc, ctx)).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
    expect(() => service.rejectSummary(doc, ctx)).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
    expect(() => service.reopenSummary(doc, ctx)).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
  });
});

describe("rejectSummary va reopenSummary", () => {
  const submitted = () => {
    const doc = makeDoc("draft");
    service.submitSummary(doc, { userRole: ROLES.OQUV_USLUBIY_BOSHQARMA, userId: "u1" });
    return doc;
  };

  test("navbatdagi rol rad etadi, izoh saqlanadi", () => {
    const doc = submitted();
    const out = service.rejectSummary(doc, {
      userRole: ROLES.REJA_MOLIYA,
      userId: "u2",
      comment: "Raqamlar mos emas",
    });
    expect(out.rejectedStep).toBe("financial");
    expect(doc.status).toBe("rejected");
    expect(doc.approvalSteps[1].comment).toBe("Raqamlar mos emas");
  });

  test("navbati kelmagan rol rad eta olmaydi → 403", () => {
    const doc = submitted();
    expect(() =>
      service.rejectSummary(doc, { userRole: ROLES.REKTOR, userId: "u9" }),
    ).toThrow(expect.objectContaining({ statusCode: 403 }));
  });

  test("qayta ochish zanjirni tozalaydi, SURATGA TEGMAYDI", () => {
    const doc = submitted();
    service.rejectSummary(doc, { userRole: ROLES.REJA_MOLIYA, userId: "u2", comment: "x" });
    const snapshotBefore = JSON.stringify(doc.snapshot);

    service.reopenSummary(doc, { userRole: ROLES.OQUV_USLUBIY_BOSHQARMA });

    expect(doc.status).toBe("draft");
    expect(doc.approvalSteps.every((s) => s.status === "pending")).toBe(true);
    expect(doc.approvalSteps.every((s) => s.comment === null)).toBe(true);
    expect(JSON.stringify(doc.snapshot)).toBe(snapshotBefore);
  });

  test("qayta ochishni faqat O'UB qiladi → 403", () => {
    const doc = submitted();
    service.rejectSummary(doc, { userRole: ROLES.REJA_MOLIYA, userId: "u2" });
    expect(() =>
      service.reopenSummary(doc, { userRole: ROLES.REKTOR }),
    ).toThrow(expect.objectContaining({ statusCode: 403 }));
  });
});

describe("supersedePrevious — yilga bitta faol hisobot", () => {
  const WorkloadSummary = require("./workloadSummary.model");

  test("o'sha yilning eski `approved` hujjatlari `superseded` bo'ladi", async () => {
    WorkloadSummary.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });

    const n = await service.supersedePrevious({ _id: "new1", academicYear: "ay1" });

    expect(n).toBe(2);
    const [filter, update] = WorkloadSummary.updateMany.mock.calls[0];
    expect(filter).toMatchObject({
      _id: { $ne: "new1" },
      academicYear: "ay1",
      status: "approved",
      active: true,
    });
    expect(update.$set).toMatchObject({ status: "superseded", supersededBy: "new1" });
  });

  test("eski hujjat O'CHIRILMAYDI — faqat holati o'zgaradi", async () => {
    WorkloadSummary.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    await service.supersedePrevious({ _id: "new1", academicYear: "ay1" });

    const [, update] = WorkloadSummary.updateMany.mock.calls[0];
    expect(update.$set.active).toBeUndefined();
    expect(JSON.stringify(update)).not.toContain("snapshot");
  });
});
