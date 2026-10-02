const {
  scholarshipSchema,
  updateSchema,
} = require("./scholarship.validation");

const A = "6a9913a389024c2b4c0c9401";
const B = "6a9913a389024c2b4c0c9402";
const base = { name: "Rektor yo'nalishi", type: "rektor" };

const err = (schema, value) => {
  const { error } = schema.validate(value);
  return error ? error.message : null;
};

describe("scholarship.criteria — dublikat", () => {
  test("🔴 bir xil mezon ikki marta — RAD etiladi", () => {
    expect(err(scholarshipSchema, { ...base, criteria: [{ criteria: A }, { criteria: A }] }))
      .toMatch(/ikki marta/i);
  });

  test("turli mezonlar — qabul qilinadi", () => {
    expect(err(scholarshipSchema, { ...base, criteria: [{ criteria: A }, { criteria: B }] }))
      .toBeNull();
  });

  test("bitta mezon va bo'sh ro'yxat — qabul qilinadi", () => {
    expect(err(scholarshipSchema, { ...base, criteria: [{ criteria: A }] })).toBeNull();
    expect(err(scholarshipSchema, { ...base, criteria: [] })).toBeNull();
  });

  test("TAHRIRLASH sxemasi ham qamrab oladi", () => {
    expect(err(updateSchema, { criteria: [{ criteria: A }, { criteria: A }] }))
      .toMatch(/ikki marta/i);
  });

  test("faqat `criteria` ref i solishtiriladi, qolgan sozlama emas", () => {
    expect(
      err(scholarshipSchema, {
        ...base,
        criteria: [
          { criteria: A, categoryIds: ["c1"] },
          { criteria: A, categoryIds: ["c2"] },
        ],
      }),
    ).toMatch(/ikki marta/i);
  });
});

describe("scholarship.judges — dublikat", () => {
  test("bir hakam ikki marta — RAD etiladi", () => {
    expect(err(scholarshipSchema, { ...base, judges: [A, A] })).toMatch(/ikki marta/i);
  });

  test("turli hakamlar — qabul qilinadi", () => {
    expect(err(scholarshipSchema, { ...base, judges: [A, B] })).toBeNull();
  });
});
