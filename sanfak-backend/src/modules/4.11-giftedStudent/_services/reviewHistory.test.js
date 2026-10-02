const { snapshotReview, ReviewHistorySchema } = require("./reviewHistory");

const REVIEWED_AT = new Date("2026-09-01T10:00:00Z");

describe("snapshotReview — qachon yozuv chiqadi", () => {
  test("qaror YO'Q (`pending`) — null", () => {
    expect(snapshotReview({ status: "pending", reviewNote: "x" })).toBeNull();
  });

  test("holati umuman yo'q — null", () => {
    expect(snapshotReview({})).toBeNull();
    expect(snapshotReview(null)).toBeNull();
    expect(snapshotReview(undefined)).toBeNull();
  });

  test("rad etilgan — yozuv chiqadi", () => {
    const e = snapshotReview({
      status: "rejected",
      reviewNote: "Hujjat sifati past",
      reviewedBy: "staff-1",
      reviewedAt: REVIEWED_AT,
    });
    expect(e).toMatchObject({
      status: "rejected",
      note: "Hujjat sifati past",
      reviewedBy: "staff-1",
      reviewedAt: REVIEWED_AT,
    });
    expect(e.supersededAt).toBeInstanceOf(Date);
  });

  test("tasdiqlangan ham qaror — yozuv chiqadi", () => {
    expect(snapshotReview({ status: "approved" })).toMatchObject({ status: "approved" });
  });
});

describe("snapshotReview — maydon xaritasi", () => {
  test("arizada sabab `rejectReason` da yashaydi", () => {
    const doc = { status: "rejected", rejectReason: "Ball yetarli emas" };
    expect(snapshotReview(doc).note).toBeNull();
    expect(snapshotReview(doc, { note: "rejectReason" }).note).toBe("Ball yetarli emas");
  });

  test("izohsiz qaror — `note: null` (undefined emas)", () => {
    expect(snapshotReview({ status: "approved" }).note).toBeNull();
  });
});

describe("snapshotReview — ball", () => {
  test("`withScore` so'ralmasa ball UMUMAN chiqmaydi (arizada ball yo'q)", () => {
    const e = snapshotReview({ status: "approved", score: 50 });
    expect("score" in e).toBe(false);
  });

  test("`0` HAQIQIY qiymat — saqlanadi", () => {
    expect(snapshotReview({ status: "approved", score: 0 }, { withScore: true }).score).toBe(0);
  });

  test("ball berilmagan bo'lsa maydon qo'shilmaydi", () => {
    const e = snapshotReview({ status: "rejected" }, { withScore: true });
    expect("score" in e).toBe(false);
    expect("scoreLabel" in e).toBe(false);
  });

  test("`scoreLabel` snapshot sifatida ko'chadi", () => {
    const e = snapshotReview(
      { status: "approved", score: 30, scoreLabel: "Ilmiy maqola (Scopus)" },
      { withScore: true },
    );
    expect(e.scoreLabel).toBe("Ilmiy maqola (Scopus)");
  });
});

describe("ReviewHistorySchema", () => {
  test("`_id` yaratmaydi — bu embed yozuv", () => {
    expect(ReviewHistorySchema.options._id).toBe(false);
  });

  test("mijoz yozadigan maydon EMAS — sxema faqat modelda ishlatiladi", () => {
    expect(Object.keys(ReviewHistorySchema.paths).sort()).toEqual([
      "note",
      "reviewedAt",
      "reviewedBy",
      "score",
      "scoreLabel",
      "status",
      "supersededAt",
    ]);
  });
});
