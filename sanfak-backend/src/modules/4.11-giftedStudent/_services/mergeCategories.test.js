const { mergeCategories } = require("./mergeCategories");

const ID_A = "6a7efdac5916905f06cebea6";
const ID_B = "6a7efdac5916905f06cebea7";

const current = [
  { _id: ID_A, name: "Xalqaro konferensiya", points: 30, active: true },
  { _id: ID_B, name: "Respublika konferensiyasi", points: 15, active: true },
];

describe("mergeCategories", () => {
  test("YANGI kategoriya qo'shilganda mavjud `_id` lar O'ZGARMAYDI", () => {
    const out = mergeCategories(
      [
        { _id: ID_A, name: "Xalqaro konferensiya", points: 30 },
        { _id: ID_B, name: "Respublika konferensiyasi", points: 15 },
        { name: "Yangi kategoriya", points: 10 },
      ],
      current,
    );

    expect(out).toHaveLength(3);
    expect(String(out[0]._id)).toBe(ID_A);
    expect(String(out[1]._id)).toBe(ID_B);
    expect(out[2]._id).toBeUndefined();
  });

  test("`_id` YUBORILMASA — nom bo'yicha moslanadi va id saqlanadi", () => {
    const out = mergeCategories(
      [
        { name: "Xalqaro konferensiya", points: 30 },
        { name: "Respublika konferensiyasi", points: 15 },
        { name: "Yangi kategoriya", points: 10 },
      ],
      current,
    );

    expect(String(out[0]._id)).toBe(ID_A);
    expect(String(out[1]._id)).toBe(ID_B);
    expect(out[2]._id).toBeUndefined();
  });

  test("nom moslashi katta-kichik harf va bo'sh joyga bog'liq emas", () => {
    const out = mergeCategories(
      [{ name: "  xalqaro KONFERENSIYA  ", points: 30 }],
      current,
    );
    expect(String(out[0]._id)).toBe(ID_A);
  });

  test("kategoriya O'CHIRILSA qolganining `_id` si o'zgarmaydi", () => {
    const out = mergeCategories(
      [{ _id: ID_B, name: "Respublika konferensiyasi", points: 15 }],
      current,
    );
    expect(out).toHaveLength(1);
    expect(String(out[0]._id)).toBe(ID_B);
  });

  test("`_id` bilan QAYTA NOMLASH id ni saqlaydi", () => {
    const out = mergeCategories(
      [{ _id: ID_A, name: "Xalqaro konferensiya (yangilangan)", points: 40 }],
      current,
    );
    expect(String(out[0]._id)).toBe(ID_A);
    expect(out[0].name).toBe("Xalqaro konferensiya (yangilangan)");
    expect(out[0].points).toBe(40);
  });

  test("notanish `_id` YANGI kategoriya sifatida qabul qilinadi", () => {
    const out = mergeCategories(
      [{ _id: "6a7efdac5916905f06cebe00", name: "Boshqa", points: 5 }],
      current,
    );
    expect(out[0]._id).toBeUndefined();
  });

  test("bir xil `_id` ikki marta kelsa — faqat BIRINCHISI oladi", () => {
    const out = mergeCategories(
      [
        { _id: ID_A, name: "Xalqaro konferensiya" },
        { _id: ID_A, name: "Nusxa" },
      ],
      current,
    );
    expect(String(out[0]._id)).toBe(ID_A);
    expect(out[1]._id).toBeUndefined();
  });

  test("bir xil NOMLI ikkita yozuv — faqat birinchisi id oladi", () => {
    const out = mergeCategories(
      [
        { name: "Xalqaro konferensiya" },
        { name: "Xalqaro konferensiya" },
      ],
      current,
    );
    expect(String(out[0]._id)).toBe(ID_A);
    expect(out[1]._id).toBeUndefined();
  });

  test("bo'sh mavjud ro'yxat — hammasi yangi", () => {
    const out = mergeCategories([{ name: "A" }, { name: "B" }], []);
    expect(out.every((c) => c._id === undefined)).toBe(true);
  });

  test("massiv bo'lmasa tegilmaydi", () => {
    expect(mergeCategories(undefined, current)).toBeUndefined();
    expect(mergeCategories(null, current)).toBeNull();
  });

  test("kirish massivi O'ZGARTIRILMAYDI", () => {
    const incoming = [{ name: "Xalqaro konferensiya", points: 30 }];
    const snapshot = JSON.stringify(incoming);
    mergeCategories(incoming, current);
    expect(JSON.stringify(incoming)).toBe(snapshot);
  });
});
