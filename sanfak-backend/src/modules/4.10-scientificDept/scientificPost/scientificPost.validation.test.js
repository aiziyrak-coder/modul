const { createPostSchema, postPaginateSchema } = require("./scientificPost.validation");

describe("scientificPost.validation", () => {
  describe("createPostSchema", () => {
    it("to'g'ri payload o'tadi", () => {
      const { error } = createPostSchema.validate({
        title: "Seminar e'loni",
        text: "Hurmatli o'qituvchilar, 20-iyul kuni seminar bo'ladi.",
        recipients: ["teachers"],
        telegram: true,
      });
      expect(error).toBeUndefined();
    });

    it("title va text majburiy", () => {
      expect(createPostSchema.validate({ recipients: ["all"] }).error).toBeDefined();
    });

    it("recipients kamida bitta va valid", () => {
      expect(
        createPostSchema.validate({ title: "A", text: "matn", recipients: [] }).error,
      ).toBeDefined();
      expect(
        createPostSchema.validate({ title: "A", text: "matn", recipients: ["nobody"] }).error,
      ).toBeDefined();
    });
  });

  describe("postPaginateSchema", () => {
    it("page/limit majburiy", () => {
      expect(postPaginateSchema.validate({}).error).toBeDefined();
    });
  });
});
