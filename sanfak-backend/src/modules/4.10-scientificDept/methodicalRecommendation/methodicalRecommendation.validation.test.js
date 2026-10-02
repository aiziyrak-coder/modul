const {
  createMethodicalSchema,
  signMethodicalSchema,
  rejectMethodicalSchema,
} = require("./methodicalRecommendation.validation");

describe("methodicalRecommendation.validation", () => {
  describe("createMethodicalSchema", () => {
    const valid = {
      title: "Ichki kasalliklar bo'yicha uslubiy tavsiyanoma",
      specialty: "6a59d4b607edd11d93b7becd",
      academicYear: "2025/2026",
      fileSlots: JSON.stringify(["methodical", "protocol"]),
    };

    it("to'liq payload o'tadi", () => {
      const { error } = createMethodicalSchema.validate(valid);
      expect(error).toBeUndefined();
    });

    it("title'siz o'tmaydi", () => {
      const { error } = createMethodicalSchema.validate({
        ...valid,
        title: undefined,
      });
      expect(error).toBeDefined();
    });

    it("academicYear formati noto'g'ri bo'lsa o'tmaydi", () => {
      const { error } = createMethodicalSchema.validate({
        ...valid,
        academicYear: "2025-2026",
      });
      expect(error).toBeDefined();
    });

    it("fileSlots'siz o'tmaydi", () => {
      const { error } = createMethodicalSchema.validate({
        ...valid,
        fileSlots: undefined,
      });
      expect(error).toBeDefined();
    });
  });

  describe("signMethodicalSchema (u-t-YY-N)", () => {
    it("bo'sh body o'tadi (mock rejim, raqam avto)", () => {
      const { error } = signMethodicalSchema.validate({});
      expect(error).toBeUndefined();
    });

    it("to'g'ri raqam o'tadi", () => {
      const { error } = signMethodicalSchema.validate({
        eriKey: "A1B2-C3D4-E5F6-G7H8",
        registrationNumber: "u-t-26-1",
        academicYear: "2025/2026",
      });
      expect(error).toBeUndefined();
    });

    it("erkin shakldagi raqam ham o'tadi", () => {
      ["ut-26-1", "u-t-2026-1", "12/2026", "УТ-26-1", "A-15"].forEach((val) => {
        const { error } = signMethodicalSchema.validate({ registrationNumber: val });
        expect(error).toBeUndefined();
      });
    });

    it("bo'sh raqam ham o'tadi (backend avto-generatsiya qiladi)", () => {
      expect(signMethodicalSchema.validate({ registrationNumber: "" }).error).toBeUndefined();
      expect(signMethodicalSchema.validate({}).error).toBeUndefined();
    });

    it("juda uzun raqam rad etiladi (100 belgidan ortiq)", () => {
      const { error } = signMethodicalSchema.validate({
        registrationNumber: "x".repeat(101),
      });
      expect(error).toBeDefined();
    });
  });

  describe("rejectMethodicalSchema", () => {
    it("sabab majburiy", () => {
      const { error } = rejectMethodicalSchema.validate({});
      expect(error).toBeDefined();
    });

    it("qisqa sabab o'tmaydi", () => {
      const { error } = rejectMethodicalSchema.validate({ reason: "ab" });
      expect(error).toBeDefined();
    });

    it("normal sabab o'tadi", () => {
      const { error } = rejectMethodicalSchema.validate({
        reason: "Antiplagiat hisoboti eskirgan",
      });
      expect(error).toBeUndefined();
    });
  });
});
