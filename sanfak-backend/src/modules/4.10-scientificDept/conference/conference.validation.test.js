const {
  createConferenceSchema,
  acceptConferenceSchema,
} = require("./conference.validation");

describe("conference.validation", () => {
  describe("createConferenceSchema", () => {
    const valid = {
      title: "Zamonaviy tibbiyot 2026",
      type: "international",
      deadline: "2026-05-01",
      kafedras: ["5f8d0d55b54764421b7156c1", "5f8d0d55b54764421b7156c2"],
    };

    it("to'liq payload o'tadi", () => {
      const { error } = createConferenceSchema.validate(valid);
      expect(error).toBeUndefined();
    });

    it("kafedralarsiz o'tmaydi", () => {
      const { error } = createConferenceSchema.validate({
        ...valid,
        kafedras: [],
      });
      expect(error).toBeDefined();
    });

    it("deadline'siz o'tmaydi", () => {
      const { error } = createConferenceSchema.validate({
        ...valid,
        deadline: undefined,
      });
      expect(error).toBeDefined();
    });

    it("noto'g'ri tur o'tmaydi", () => {
      const { error } = createConferenceSchema.validate({
        ...valid,
        type: "regional",
      });
      expect(error).toBeDefined();
    });
  });

  describe("acceptConferenceSchema", () => {
    it("fileSlots bilan o'tadi", () => {
      const { error } = acceptConferenceSchema.validate({
        fileSlots: JSON.stringify(["thesis", "certificate"]),
      });
      expect(error).toBeUndefined();
    });

    it("fileSlots'siz o'tmaydi", () => {
      const { error } = acceptConferenceSchema.validate({});
      expect(error).toBeDefined();
    });
  });
});
