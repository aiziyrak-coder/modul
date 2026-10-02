const {
  createDirectionSchema,
  updateDirectionSchema,
} = require("./direction.validation");

const validBase = { title: "Davolash ishi" };

describe("createDirectionSchema — directionCode majburiy", () => {
  test("kod bilan — o'tadi", () => {
    const { error, value } = createDirectionSchema.validate({
      ...validBase,
      directionCode: "60910200",
    });
    expect(error).toBeUndefined();
    expect(value.directionCode).toBe("60910200");
  });

  test("kod umuman berilmasa — RAD etiladi", () => {
    const { error } = createDirectionSchema.validate(validBase);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/kod/i);
  });

  test.each(["", "   "])("bo'sh kod (%p) — RAD etiladi", (directionCode) => {
    const { error } = createDirectionSchema.validate({
      ...validBase,
      directionCode,
    });
    expect(error).toBeDefined();
  });

  test("null kod — RAD etiladi (ilgari ruxsat etilardi)", () => {
    const { error } = createDirectionSchema.validate({
      ...validBase,
      directionCode: null,
    });
    expect(error).toBeDefined();
  });

  test("kod atrofidagi probellar kesiladi", () => {
    const { value } = createDirectionSchema.validate({
      ...validBase,
      directionCode: "  60910200  ",
    });
    expect(value.directionCode).toBe("60910200");
  });
});

describe("updateDirectionSchema — directionCode ixtiyoriy (mavjud kodsiz yo'nalishlar qulflanmasin)", () => {
  test("kodsiz tahrir — o'tadi", () => {
    const { error } = updateDirectionSchema.validate({ title: "Yangi nom" });
    expect(error).toBeUndefined();
  });

  test("null kod bilan tahrir — o'tadi", () => {
    const { error } = updateDirectionSchema.validate({ directionCode: null });
    expect(error).toBeUndefined();
  });

  test("kod bilan tahrir — o'tadi", () => {
    const { error } = updateDirectionSchema.validate({
      directionCode: "60910300",
    });
    expect(error).toBeUndefined();
  });
});

describe.each([
  ["createDirectionSchema", createDirectionSchema, { ...validBase, directionCode: "60910200" }],
  ["updateDirectionSchema", updateDirectionSchema, {}],
])("%s — knowledgeArea / educationArea", (_n, schema, base) => {
  const AREA = "900000 – Sog'liqni saqlash va ijtimoiy ta'minot";

  test("matn — o'tadi, atrofidagi probellar kesiladi", () => {
    const { error, value } = schema.validate({ ...base, knowledgeArea: `  ${AREA} `, educationArea: AREA });
    expect(error).toBeUndefined();
    expect(value.knowledgeArea).toBe(AREA);
  });

  test.each([[null], [""], [undefined]])("bo'sh qiymat (%p) — o'tadi (maydon ixtiyoriy)", (v) => {
    const { error } = schema.validate({ ...base, knowledgeArea: v, educationArea: v });
    expect(error).toBeUndefined();
  });

  test.each([
    ["massiv", ["A"]],
    ["ko'p tilli obyekt", { uz: "A" }],
    ["300 belgidan uzun", "x".repeat(301)],
  ])("%s — RAD etiladi", (_k, v) => {
    expect(schema.validate({ ...base, knowledgeArea: v }).error).toBeDefined();
    expect(schema.validate({ ...base, educationArea: v }).error).toBeDefined();
  });
});
