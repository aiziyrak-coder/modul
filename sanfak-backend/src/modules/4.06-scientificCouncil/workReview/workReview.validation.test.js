const {
  createReviewSchema,
  updateReviewSchema,
} = require("./workReview.validation");

describe("workReview.validation", () => {
  describe("createReviewSchema", () => {
    test("to'g'ri data qabul qilinadi", () => {
      const { error } = createReviewSchema.validate({
        work: "507f1f77bcf86cd799439011",
        docKey: "dissertation",
        type: "positive",
        text: "Juda yaxshi ish",
      });
      expect(error).toBeUndefined();
    });

    test("work majburiy", () => {
      const { error } = createReviewSchema.validate({
        docKey: "dissertation",
        type: "positive",
      });
      expect(error).toBeDefined();
    });

    test("docKey majburiy", () => {
      const { error } = createReviewSchema.validate({
        work: "507f1f77bcf86cd799439011",
        type: "positive",
      });
      expect(error).toBeDefined();
    });

    test("type majburiy", () => {
      const { error } = createReviewSchema.validate({
        work: "507f1f77bcf86cd799439011",
        docKey: "dissertation",
      });
      expect(error).toBeDefined();
    });

    test("noto'g'ri type rad qilinadi", () => {
      const { error } = createReviewSchema.validate({
        work: "507f1f77bcf86cd799439011",
        docKey: "dissertation",
        type: "invalid",
      });
      expect(error).toBeDefined();
    });

    test("text 3000 belgidan oshmasligi kerak", () => {
      const { error } = createReviewSchema.validate({
        work: "507f1f77bcf86cd799439011",
        docKey: "dissertation",
        type: "neutral",
        text: "a".repeat(3001),
      });
      expect(error).toBeDefined();
    });
  });

  describe("updateReviewSchema", () => {
    test("faqat type yangilanishi mumkin", () => {
      const { error } = updateReviewSchema.validate({ type: "negative" });
      expect(error).toBeUndefined();
    });

    test("faqat text yangilanishi mumkin", () => {
      const { error } = updateReviewSchema.validate({ text: "Yangi xulosa" });
      expect(error).toBeUndefined();
    });
  });
});
