const {
  createWorkSchema,
  changeStatusSchema,
  updateMembersSchema,
  generateProtocolSchema,
  makeDecisionSchema,
  acceptApplicationSchema,
} = require("./scientificWork.validation");

describe("scientificWork.validation", () => {
  describe("createWorkSchema", () => {
    test("to'g'ri data qabul qilinadi (internal)", () => {
      const { error } = createWorkSchema.validate({
        title: "Test ilmiy ish",
        researcher: "507f1f77bcf86cd799439011",
      });
      expect(error).toBeUndefined();
    });

    test("title majburiy", () => {
      const { error } = createWorkSchema.validate({
        researcher: "507f1f77bcf86cd799439011",
      });
      expect(error).toBeDefined();
    });

    test("internal tipda researcher YUBORILMASA ham o'tadi (self-scope oqimi)", () => {
      const { error } = createWorkSchema.validate({
        title: "Test",
        authorType: "internal",
      });
      expect(error).toBeUndefined();
    });

    test("authorType umuman berilmasa ham o'tadi (default 'internal')", () => {
      const { value, error } = createWorkSchema.validate({ title: "Test" });
      expect(error).toBeUndefined();
      expect(value.authorType).toBe("internal");
    });

    test("researcher berilsa — saqlanadi (kotib boshqa muallif nomidan)", () => {
      const { value, error } = createWorkSchema.validate({
        title: "Test",
        authorType: "internal",
        researcher: "6a44a93b3c41e20eb51faae4",
      });
      expect(error).toBeUndefined();
      expect(value.researcher).toBe("6a44a93b3c41e20eb51faae4");
    });

    test("researcher bo'sh satr — kalit OLIB TASHLANADI (ObjectId cast yiqilmasin)", () => {
      const { value, error } = createWorkSchema.validate({
        title: "Test",
        authorType: "internal",
        researcher: "",
      });
      expect(error).toBeUndefined();
      expect(value.researcher).toBeUndefined();
    });

    test("external tipda externalAuthor majburiy", () => {
      const { error } = createWorkSchema.validate({
        title: "Test",
        authorType: "external",
      });
      expect(error).toBeDefined();
    });

    test("external author to'g'ri qabul qilinadi", () => {
      const { error } = createWorkSchema.validate({
        title: "Test",
        authorType: "external",
        externalAuthor: {
          name: "Alisher Navoiy",
          workplace: "ToshDTU",
          position: "Professor",
        },
      });
      expect(error).toBeUndefined();
    });

    test("{uz,ru,eng} obyekti rad qilinadi", () => {
      const { error } = createWorkSchema.validate({
        title: { uz: "Test", ru: "Тест", eng: "Test" },
        researcher: "507f1f77bcf86cd799439011",
      });
      expect(error).toBeDefined();
    });

    test("bo'sh string rad qilinadi", () => {
      const { error } = createWorkSchema.validate({
        title: "",
        researcher: "507f1f77bcf86cd799439011",
      });
      expect(error).toBeDefined();
    });
  });

  describe("changeStatusSchema", () => {
    test("to'g'ri status qabul qilinadi", () => {
      const { error } = changeStatusSchema.validate({ status: "pending" });
      expect(error).toBeUndefined();
    });

    test("noto'g'ri status rad qilinadi", () => {
      const { error } = changeStatusSchema.validate({ status: "invalid" });
      expect(error).toBeDefined();
    });
  });

  describe("updateMembersSchema", () => {
    test("memberIds massivi qabul qilinadi", () => {
      const { error } = updateMembersSchema.validate({
        memberIds: ["id1", "id2"],
      });
      expect(error).toBeUndefined();
    });

    test("memberIds majburiy", () => {
      const { error } = updateMembersSchema.validate({});
      expect(error).toBeDefined();
    });
  });

  describe("generateProtocolSchema", () => {
    test("hech qaysi berilmasa rad qilinadi", () => {
      const { error } = generateProtocolSchema.validate({});
      expect(error).toBeDefined();
    });

    test("finalConclusion bilan qabul qilinadi", () => {
      const { error } = generateProtocolSchema.validate({
        finalConclusion: "Ilmiy ish barcha talablarga javob beradi",
      });
      expect(error).toBeUndefined();
    });

    test("conclusion bilan ham qabul qilinadi", () => {
      const { error } = generateProtocolSchema.validate({
        conclusion: "Ilmiy ish barcha talablarga javob beradi",
      });
      expect(error).toBeUndefined();
    });
  });

  describe("makeDecisionSchema", () => {
    test("type majburiy", () => {
      const { error } = makeDecisionSchema.validate({ comment: "test" });
      expect(error).toBeDefined();
    });

    test("seminar qabul qilinadi", () => {
      const { error } = makeDecisionSchema.validate({
        type: "seminar",
        seminarDate: "2025-06-15",
      });
      expect(error).toBeUndefined();
    });

    test("revision qabul qilinadi", () => {
      const { error } = makeDecisionSchema.validate({
        type: "revision",
        revisionDocs: ["dissertation", "abstract"],
        comment: "Qayta ishlash kerak",
      });
      expect(error).toBeUndefined();
    });

    test("rejected — rejectionReason'siz rad etiladi", () => {
      const { error } = makeDecisionSchema.validate({ type: "rejected" });
      expect(error).toBeDefined();
    });

    test("rejected — rejectionReason bilan qabul qilinadi", () => {
      const { error } = makeDecisionSchema.validate({
        type: "rejected",
        rejectionReason: "Talablarga javob bermaydi",
      });
      expect(error).toBeUndefined();
    });
  });

  describe("acceptApplicationSchema", () => {
    test("memberIds majburiy", () => {
      const { error } = acceptApplicationSchema.validate({});
      expect(error).toBeDefined();
    });

    test("bo'sh memberIds ro'yxati rad etiladi (a'zosiz qabul qilib bo'lmaydi)", () => {
      const { error } = acceptApplicationSchema.validate({ memberIds: [] });
      expect(error).toBeDefined();
    });

    test("kamida bitta a'zo bilan qabul qilinadi", () => {
      const { error } = acceptApplicationSchema.validate({
        memberIds: ["507f1f77bcf86cd799439011"],
      });
      expect(error).toBeUndefined();
    });
  });
});

describe("scientificWork.validation — aloqa va ixtisoslik", () => {
  const base = {
    title: "Test ish",
    year: "2025-2026",
    researcher: "507f1f77bcf86cd799439011",
  };

  test("tashqi rahbarning email/telefoni qabul qilinadi", () => {
    const { error } = createWorkSchema.validate({
      ...base,
      supervisor: {
        type: "external",
        name: "Aliyev V",
        workplace: "TTA",
        position: "Dotsent",
        email: "rahbar@example.uz",
        phone: "+998901234567",
      },
    });
    expect(error).toBeUndefined();
  });

  test("noto'g'ri email RAD ETILADI", () => {
    const { error } = createWorkSchema.validate({
      ...base,
      supervisor: {
        type: "external",
        name: "Aliyev V",
        workplace: "TTA",
        position: "Dotsent",
        email: "notanemail",
      },
    });
    expect(error).toBeDefined();
  });

  test("bo'sh email o'tadi (ixtiyoriy maydon, D-014 naqshi)", () => {
    const { error } = createWorkSchema.validate({
      ...base,
      supervisor: {
        type: "external",
        name: "Aliyev V",
        workplace: "TTA",
        position: "Dotsent",
        email: "",
        phone: "",
      },
    });
    expect(error).toBeUndefined();
  });

  test("ixtisoslik ObjectId sifatida qabul qilinadi", () => {
    const { error } = createWorkSchema.validate({
      ...base,
      specialty: "507f1f77bcf86cd799439012",
    });
    expect(error).toBeUndefined();
  });

  test("ixtisoslik ObjectId bo'lmasa rad etiladi", () => {
    const { error } = createWorkSchema.validate({ ...base, specialty: "salom" });
    expect(error).toBeDefined();
  });

  test("bo'sh ixtisoslik kalit sifatida TUSHIRIB QOLDIRILADI (ObjectId cast xatosi bo'lmasin)", () => {
    const { value, error } = createWorkSchema.validate({ ...base, specialty: "" });
    expect(error).toBeUndefined();
    expect(value.specialty).toBeUndefined();
  });
});
