const {
  createMonographSchema,
  ssvDecisionSchema,
  fillDataSchema,
} = require("./monograph.validation");

describe("monograph.validation", () => {
  describe("createMonographSchema (faqat fayllar)", () => {
    it("fileSlots bilan o'tadi", () => {
      const { error } = createMonographSchema.validate({
        fileSlots: JSON.stringify(["referral", "council"]),
      });
      expect(error).toBeUndefined();
    });

    it("fileSlots'siz o'tmaydi", () => {
      const { error } = createMonographSchema.validate({});
      expect(error).toBeDefined();
    });

    it("title yuborilsa o'tmaydi (nom 7-bosqichda)", () => {
      const { error } = createMonographSchema.validate({
        fileSlots: "[]",
        title: "Erta nom",
      });
      expect(error).toBeDefined();
    });
  });

  describe("ssvDecisionSchema (ikki bosqichli rad)", () => {
    it("approve — sabab shart emas", () => {
      const { error } = ssvDecisionSchema.validate({ decision: "approve" });
      expect(error).toBeUndefined();
    });

    it("reject — sabab majburiy", () => {
      const { error } = ssvDecisionSchema.validate({ decision: "reject" });
      expect(error).toBeDefined();
    });

    it("reject + sabab o'tadi", () => {
      const { error } = ssvDecisionSchema.validate({
        decision: "reject",
        reason: "SSV talablarga mos emas deb topdi",
      });
      expect(error).toBeUndefined();
    });
  });

  describe("fillDataSchema (7-bosqich)", () => {
    const valid = {
      title: "Ichki kasalliklar monografiyasi",
      ssvNumber: "SSV-1024",
      ssvDate: "2026-01-15",
      isbn: "978-9943-101-00-1",
      publisher: "Fan nashriyoti",
    };

    it("to'liq ma'lumot o'tadi", () => {
      const { error } = fillDataSchema.validate(valid);
      expect(error).toBeUndefined();
    });

    it("ISBN'siz o'tmaydi", () => {
      const { error } = fillDataSchema.validate({ ...valid, isbn: undefined });
      expect(error).toBeDefined();
    });

    it("nashriyotsiz o'tmaydi", () => {
      const { error } = fillDataSchema.validate({
        ...valid,
        publisher: undefined,
      });
      expect(error).toBeDefined();
    });
  });
});
