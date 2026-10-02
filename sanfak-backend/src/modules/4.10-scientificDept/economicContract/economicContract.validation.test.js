const {
  createContractSchema,
  rejectContractSchema,
} = require("./economicContract.validation");

describe("economicContract.validation", () => {
  describe("createContractSchema", () => {
    const valid = {
      title: "Suv tozalash bo'yicha X/Sh",
      partnerOrganization: "Suvsoz MChJ",
      contractDate: "2026-03-01",
      amount: 50000000,
    };

    it("to'liq payload o'tadi", () => {
      const { error } = createContractSchema.validate(valid);
      expect(error).toBeUndefined();
    });

    it("hamkorsiz o'tmaydi", () => {
      const { error } = createContractSchema.validate({
        ...valid,
        partnerOrganization: undefined,
      });
      expect(error).toBeDefined();
    });

    it("manfiy mablag' o'tmaydi", () => {
      const { error } = createContractSchema.validate({ ...valid, amount: -1 });
      expect(error).toBeDefined();
    });

    it("fayllarsiz ham o'tadi (fileSlots ixtiyoriy)", () => {
      const { error } = createContractSchema.validate(valid);
      expect(error).toBeUndefined();
    });
  });

  describe("rejectContractSchema", () => {
    it("sabab majburiy", () => {
      const { error } = rejectContractSchema.validate({});
      expect(error).toBeDefined();
    });

    it("normal sabab o'tadi", () => {
      const { error } = rejectContractSchema.validate({
        reason: "Hamkor tashkilot rekvizitlari to'liq emas",
      });
      expect(error).toBeUndefined();
    });
  });
});
