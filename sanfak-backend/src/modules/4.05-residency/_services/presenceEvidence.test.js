"use strict";

const {
  MANUAL_VERIFICATION_PROGRAMS,
  REASONS,
  MSG,
  acceptsManualVerification,
  hasPresenceEvidence,
  manualVerificationPatch,
  presentEvidenceError,
  presentEvidenceFilter,
} = require("./presenceEvidence");
const { RESIDENT_PROGRAMS } = require("#modules/4.05-residency/resident/resident.model");

const NOW = new Date("2026-09-27T05:00:00Z");
const patch = (over) =>
  manualVerificationPatch({ userId: "u-1", now: NOW, ...over });

describe("dastur ro'yxati (D-SCOPE)", () => {
  test("har bir qo'lda-tasdiq dasturi haqiqiy rezident dasturi", () => {
    for (const p of MANUAL_VERIFICATION_PROGRAMS) expect(RESIDENT_PROGRAMS).toContain(p);
  });

  test("🔴 ordinatura (SAMS kogortasi) ro'yxatda YO'Q", () => {
    expect(MANUAL_VERIFICATION_PROGRAMS).not.toContain("ordinatura");
  });

  test("ro'yxat o'zgarmas", () => {
    expect(Object.isFrozen(MANUAL_VERIFICATION_PROGRAMS)).toBe(true);
  });

  test.each([
    ["magistratura", true],
    ["ordinatura", false],
    [undefined, false],
    ["", false],
    ["MAGISTRATURA", false],
  ])("acceptsManualVerification(%p) → %p (fail-closed)", (program, want) => {
    expect(acceptsManualVerification(program)).toBe(want);
  });
});

describe("hasPresenceEvidence", () => {
  test.each([
    [{ samsVerified: true, manualVerified: false }, true],
    [{ samsVerified: false, manualVerified: true }, true],
    [{ samsVerified: true, manualVerified: true }, true],
    [{ samsVerified: false, manualVerified: false }, false],
    [{}, false],
    [null, false],
    [undefined, false],
  ])("%p → %p", (row, want) => {
    expect(hasPresenceEvidence(row)).toBe(want);
  });
});

describe("manualVerificationPatch", () => {
  test.each([true, false, undefined])("🔴 ordinatura: requested=%p → {} (e'tiborsiz)", (requested) => {
    expect(patch({ program: "ordinatura", requested })).toEqual({});
  });

  test("noma'lum dastur ham e'tiborsiz (fail-closed)", () => {
    expect(patch({ program: undefined, requested: true })).toEqual({});
  });

  test("magistratura: true + tasdiqlanmagan → kim/qachon SERVERDA", () => {
    expect(patch({ program: "magistratura", requested: true })).toEqual({
      manualVerified: true,
      manualVerifiedBy: "u-1",
      manualVerifiedAt: NOW,
    });
  });

  test("magistratura: allaqachon tasdiqlangan → {} (asl tasdiqlovchi saqlanadi)", () => {
    expect(patch({ program: "magistratura", requested: true, wasVerified: true })).toEqual({});
  });

  test("magistratura: false → avvalgidek yoziladi", () => {
    expect(patch({ program: "magistratura", requested: false, wasVerified: true })).toEqual({
      manualVerified: false,
    });
  });

  test.each([undefined, null, "true", 1])("magistratura: boolean emas (%p) → {}", (requested) => {
    expect(patch({ program: "magistratura", requested })).toEqual({});
  });

  test("standart qiymatlar: userId null, now — hozir", () => {
    const out = manualVerificationPatch({ program: "magistratura", requested: true });
    expect(out.manualVerifiedBy).toBeNull();
    expect(out.manualVerifiedAt).toBeInstanceOf(Date);
  });
});

describe("presentEvidenceError", () => {
  const none = { samsVerified: false, manualVerified: false };

  test.each(["absent", "excused", undefined])("%p — dalil shart emas", (status) => {
    expect(presentEvidenceError(status, "ordinatura", none)).toBeNull();
  });

  test.each([
    [{ samsVerified: true, manualVerified: false }],
    [{ samsVerified: false, manualVerified: true }],
  ])("present + dalil %p → null (ikkala dasturda)", (evidence) => {
    expect(presentEvidenceError("present", "ordinatura", evidence)).toBeNull();
    expect(presentEvidenceError("present", "magistratura", evidence)).toBeNull();
  });

  test.each(["ordinatura", undefined, "noma'lum"])("🔴 %p present, dalilsiz → present_requires_sams", (program) => {
    expect(presentEvidenceError("present", program, none)).toEqual({
      message: MSG.samsOnly,
      reason: "present_requires_sams",
    });
  });

  test("magistratura present, dalilsiz → present_requires_verification, eski matn", () => {
    expect(presentEvidenceError("present", "magistratura", none)).toEqual({
      message: "Kelganini tasdiqlash uchun SAMS ilovasi yoki qo'lda tasdiq kerak",
      reason: REASONS.needsEvidence,
    });
    expect(REASONS.needsEvidence).toBe("present_requires_verification");
  });

  test("dalil obyekti umuman yo'q → dalilsiz hisoblanadi", () => {
    expect(presentEvidenceError("present", "ordinatura", undefined)?.reason).toBe(REASONS.samsOnly);
  });
});

describe("presentEvidenceFilter — yozuv paytidagi CAS sharti", () => {
  const SAMS = { samsVerified: true };
  const MANUAL = { manualVerified: true };
  const NOT_PRESENT = { status: { $ne: "present" } };

  test.each([
    ["qo'lda tasdiq yozilmoqda", { manualVerified: true }],
    ["present + qo'lda tasdiq", { status: "present", manualVerified: true }],
    ["absent ga", { status: "absent" }],
    ["absent ga + tasdiq olinadi", { status: "absent", manualVerified: false }],
    ["excused ga", { status: "excused" }],
  ])("%s → shart yo'q", (_, update) => {
    expect(presentEvidenceFilter(update)).toEqual({});
  });

  test.each([
    ["present ga", { status: "present" }, { $or: [SAMS, MANUAL] }],
    ["🔴 present ga + tasdiq olinadi", { status: "present", manualVerified: false }, { $or: [SAMS] }],
    ["holat o'zgarmaydi (ball)", { score: 8 }, { $or: [NOT_PRESENT, SAMS, MANUAL] }],
    ["🔴 holat o'zgarmaydi + tasdiq olinadi", { manualVerified: false }, { $or: [NOT_PRESENT, SAMS] }],
  ])("%s → %p", (_, update, want) => {
    expect(presentEvidenceFilter(update)).toEqual(want);
  });

  test("409 sababi — sessiya moduli bilan bir xil nom", () => {
    expect(REASONS.stateChanged).toBe("state_changed");
    expect(MSG.stateChanged).toMatch(/qayta urinib/);
  });
});
