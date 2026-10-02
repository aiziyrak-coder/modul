const {
  createMemberSchema,
  updateMemberSchema,
} = require("./councilMember.validation");

const VALID_EXTERNAL = {
  name: "Aliyev Vali",
  workplace: "Toshkent tibbiyot akademiyasi",
  position: "Dotsent",
};

describe("councilMember.validation", () => {
  describe("createMemberSchema — ichki (default)", () => {
    test("to'g'ri data qabul qilinadi", () => {
      const { error } = createMemberSchema.validate({
        user: "507f1f77bcf86cd799439011",
        degree: "PhD",
        organization: "FJSTI",
      });
      expect(error).toBeUndefined();
    });

    test("`type` ko'rsatilmasa 'internal'ga tushadi va user majburiy bo'ladi", () => {
      const { error } = createMemberSchema.validate({
        degree: "PhD",
      });
      expect(error).toBeDefined();
      expect(error.message).toMatch(/user/);
    });

    test("faqat user bilan qabul qilinadi", () => {
      const { error } = createMemberSchema.validate({
        user: "507f1f77bcf86cd799439011",
      });
      expect(error).toBeUndefined();
    });

    test("bo'sh obyekt rad qilinadi", () => {
      const { error } = createMemberSchema.validate({});
      expect(error).toBeDefined();
    });

    test("type='internal' + external yuborilsa ham xato bermaydi (strip qilinadi)", () => {
      const { error, value } = createMemberSchema.validate({
        type: "internal",
        user: "507f1f77bcf86cd799439011",
        external: { name: "Should be stripped" },
      });
      expect(error).toBeUndefined();
      expect(value.external).toBeUndefined();
    });
  });

  describe("createMemberSchema — tashqi", () => {
    test("to'liq tashqi ma'lumot qabul qilinadi", () => {
      const { error } = createMemberSchema.validate({
        type: "external",
        external: VALID_EXTERNAL,
      });
      expect(error).toBeUndefined();
    });

    test("user'siz ham qabul qilinadi (tashqi a'zoning platforma hisobi yo'q)", () => {
      const { error } = createMemberSchema.validate({
        type: "external",
        external: VALID_EXTERNAL,
      });
      expect(error).toBeUndefined();
    });

    test("external butunlay yo'q bo'lsa rad etiladi", () => {
      const { error } = createMemberSchema.validate({ type: "external" });
      expect(error).toBeDefined();
    });

    test("name yo'q bo'lsa rad etiladi", () => {
      const { error } = createMemberSchema.validate({
        type: "external",
        external: { workplace: "X", position: "Y" },
      });
      expect(error).toBeDefined();
    });

    test("passport/email/phone ixtiyoriy — busiz ham o'tadi", () => {
      const { error } = createMemberSchema.validate({
        type: "external",
        external: VALID_EXTERNAL,
      });
      expect(error).toBeUndefined();
    });

    test("email noto'g'ri formatda bo'lsa rad etiladi", () => {
      const { error } = createMemberSchema.validate({
        type: "external",
        external: { ...VALID_EXTERNAL, email: "notanemail" },
      });
      expect(error).toBeDefined();
    });
  });

  describe("updateMemberSchema", () => {
    test("active yangilanishi mumkin", () => {
      const { error } = updateMemberSchema.validate({ active: false });
      expect(error).toBeUndefined();
    });

    test("degree yangilanishi mumkin", () => {
      const { error } = updateMemberSchema.validate({ degree: "DSc" });
      expect(error).toBeUndefined();
    });

    test("assignedCount manfiy bo'lsa rad", () => {
      const { error } = updateMemberSchema.validate({ assignedCount: -1 });
      expect(error).toBeDefined();
    });

    test("bo'sh obyekt qabul qilinadi", () => {
      const { error } = updateMemberSchema.validate({});
      expect(error).toBeUndefined();
    });

    test("tashqi a'zoning external ma'lumoti to'liq yuborilsa yangilanadi", () => {
      const { error } = updateMemberSchema.validate({ external: VALID_EXTERNAL });
      expect(error).toBeUndefined();
    });

    test("type/user yangilanishi RAD etiladi — a'zo turi qulflangan", () => {
      const { error } = updateMemberSchema.validate({ type: "external" });
      expect(error).toBeDefined();
    });
  });
});
