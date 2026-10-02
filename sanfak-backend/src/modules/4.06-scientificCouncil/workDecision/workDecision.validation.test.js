const { createDecisionSchema } = require("./workDecision.validation");

describe("workDecision.validation", () => {
  describe("createDecisionSchema", () => {
    test("to'g'ri data qabul qilinadi", () => {
      const { error } = createDecisionSchema.validate({
        work: "507f1f77bcf86cd799439011",
        type: "seminar",
      });
      expect(error).toBeUndefined();
    });

    test("work majburiy", () => {
      const { error } = createDecisionSchema.validate({
        type: "seminar",
      });
      expect(error).toBeDefined();
    });

    test("type majburiy", () => {
      const { error } = createDecisionSchema.validate({
        work: "507f1f77bcf86cd799439011",
      });
      expect(error).toBeDefined();
    });

    test("noto'g'ri type rad qilinadi", () => {
      const { error } = createDecisionSchema.validate({
        work: "507f1f77bcf86cd799439011",
        type: "invalid",
      });
      expect(error).toBeDefined();
    });

    test("revision bilan revisionDocs qabul qilinadi", () => {
      const { error } = createDecisionSchema.validate({
        work: "507f1f77bcf86cd799439011",
        type: "revision",
        revisionDocs: ["dissertation", "abstract"],
        comment: "Qayta ishlash kerak",
      });
      expect(error).toBeUndefined();
    });

    test("rejection bilan rejectionReason qabul qilinadi", () => {
      const { error } = createDecisionSchema.validate({
        work: "507f1f77bcf86cd799439011",
        type: "rejection",
        rejectionReason: "Plagiat aniqlandi",
      });
      expect(error).toBeUndefined();
    });

    test("finalConclusion qabul qilinadi", () => {
      const { error } = createDecisionSchema.validate({
        work: "507f1f77bcf86cd799439011",
        type: "seminar",
        finalConclusion: "Ilmiy ish talablarga javob beradi",
        seminarDate: "2025-06-15",
      });
      expect(error).toBeUndefined();
    });
  });
});
