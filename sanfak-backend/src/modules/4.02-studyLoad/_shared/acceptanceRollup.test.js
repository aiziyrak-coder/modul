const { rollupEntryAcceptance } = require("./acceptanceRollup");

describe("rollupEntryAcceptance", () => {
  test("1) bo'sh massiv / undefined → pending, null, null", () => {
    expect(rollupEntryAcceptance([])).toEqual({
      acceptanceStatus: "pending",
      rejectionReason: null,
      respondedAt: null,
    });
    expect(rollupEntryAcceptance(undefined)).toEqual({
      acceptanceStatus: "pending",
      rejectionReason: null,
      respondedAt: null,
    });
  });

  test("2) hammasi accepted → accepted", () => {
    const result = rollupEntryAcceptance([
      { acceptanceStatus: "accepted", respondedAt: new Date("2026-01-01") },
      { acceptanceStatus: "accepted", respondedAt: new Date("2026-01-02") },
    ]);
    expect(result.acceptanceStatus).toBe("accepted");
    expect(result.rejectionReason).toBeNull();
  });

  test("3) biror blok rejected → rejected + eng oxirgi rad sababi (respondedAt bo'yicha)", () => {
    const result = rollupEntryAcceptance([
      { acceptanceStatus: "accepted", respondedAt: new Date("2026-01-01") },
      {
        acceptanceStatus: "rejected",
        rejectionReason: "Birinchi sabab",
        respondedAt: new Date("2026-01-02"),
      },
      {
        acceptanceStatus: "rejected",
        rejectionReason: "Eng oxirgi sabab",
        respondedAt: new Date("2026-01-05"),
      },
    ]);
    expect(result.acceptanceStatus).toBe("rejected");
    expect(result.rejectionReason).toBe("Eng oxirgi sabab");
  });

  test("3b) rejected bloklarda sana yo'q bo'lsa — massivdagi OXIRGISI g'olib", () => {
    const result = rollupEntryAcceptance([
      { acceptanceStatus: "rejected", rejectionReason: "Birinchi" },
      { acceptanceStatus: "rejected", rejectionReason: "Ikkinchi" },
    ]);
    expect(result.acceptanceStatus).toBe("rejected");
    expect(result.rejectionReason).toBe("Ikkinchi");
  });

  test("4) aralash (accepted + pending) → pending", () => {
    const result = rollupEntryAcceptance([
      { acceptanceStatus: "accepted" },
      { acceptanceStatus: "pending" },
    ]);
    expect(result.acceptanceStatus).toBe("pending");
    expect(result.rejectionReason).toBeNull();
  });

  test("5) LEGACY — bloklarda maydon yo'q + fallbackStatus=\"accepted\" → accepted (regressiya qulfi)", () => {
    const result = rollupEntryAcceptance(
      [{ totalHour: 40 }, { totalHour: 60 }],
      "accepted",
    );
    expect(result.acceptanceStatus).toBe("accepted");
  });

  test("5b) LEGACY — fallbackStatus berilmasa default \"pending\"", () => {
    const result = rollupEntryAcceptance([{ totalHour: 40 }]);
    expect(result.acceptanceStatus).toBe("pending");
  });

  test("6) respondedAt — bloklardagi ENG KATTA qiymat", () => {
    const result = rollupEntryAcceptance([
      { acceptanceStatus: "accepted", respondedAt: new Date("2026-01-01") },
      { acceptanceStatus: "accepted", respondedAt: new Date("2026-03-15") },
      { acceptanceStatus: "accepted", respondedAt: new Date("2026-02-10") },
    ]);
    expect(result.respondedAt).toEqual(new Date("2026-03-15"));
  });

  test("6b) birortasida ham respondedAt yo'q bo'lsa — null", () => {
    const result = rollupEntryAcceptance([
      { acceptanceStatus: "accepted" },
      { acceptanceStatus: "accepted" },
    ]);
    expect(result.respondedAt).toBeNull();
  });
});
