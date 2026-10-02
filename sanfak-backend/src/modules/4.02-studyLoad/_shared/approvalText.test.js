const { APPROVAL_MAX, sanitizeApproval } = require("./approvalText");

describe("sanitizeApproval", () => {
  test("oddiy matn — trim qilinadi", () => {
    expect(sanitizeApproval("  2026-yil 5-sonli bayonnoma  ")).toBe(
      "2026-yil 5-sonli bayonnoma",
    );
  });

  test("🔴 query injection — obyekt RAD etiladi (?approval[$ne]=x)", () => {
    expect(sanitizeApproval({ $ne: null })).toBeNull();
    expect(sanitizeApproval(["a", "b"])).toBeNull();
  });

  test("bo'sh / probel-only → null (model defaulti saqlanadi)", () => {
    expect(sanitizeApproval("")).toBeNull();
    expect(sanitizeApproval("   ")).toBeNull();
    expect(sanitizeApproval("\n\t ")).toBeNull();
  });

  test("yo'q / noto'g'ri turlar → null", () => {
    expect(sanitizeApproval(undefined)).toBeNull();
    expect(sanitizeApproval(null)).toBeNull();
    expect(sanitizeApproval(42)).toBeNull();
  });

  test("uzun matn kesiladi", () => {
    const long = "a".repeat(APPROVAL_MAX + 250);
    expect(sanitizeApproval(long)).toHaveLength(APPROVAL_MAX);
  });

  test("ko'p qatorli matn saqlanadi (blanka 3 qator)", () => {
    const multi = "Institut kengashida\nma'qullangan\n5-sonli bayonnoma";
    expect(sanitizeApproval(multi)).toBe(multi);
  });
});
