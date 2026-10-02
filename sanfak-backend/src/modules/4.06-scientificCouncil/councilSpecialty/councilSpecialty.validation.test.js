const {
  createSpecialtySchema,
  updateSpecialtySchema,
} = require("./councilSpecialty.validation");
const service = require("./councilSpecialty.service");

describe("councilSpecialty.validation", () => {
  test("to'g'ri data qabul qilinadi", () => {
    const { error } = createSpecialtySchema.validate({
      title: "Pediatriya",
      code: "14.00.09",
      branch: "Tibbiyot fanlari",
    });
    expect(error).toBeUndefined();
  });

  test("shifrsiz ixtisoslik rad etiladi", () => {
    const { error } = createSpecialtySchema.validate({ title: "Pediatriya" });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/code/);
  });

  test("nomsiz ixtisoslik rad etiladi", () => {
    const { error } = createSpecialtySchema.validate({ code: "14.00.09" });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/title/);
  });

  test("fan tarmog'i MAJBURIY — berilmasa rad etiladi", () => {
    const { error } = createSpecialtySchema.validate({
      title: "Pediatriya",
      code: "14.00.09",
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/branch/);
  });

  test("fan tarmog'i bo'sh satr bo'lsa ham rad etiladi", () => {
    const { error } = createSpecialtySchema.validate({
      title: "Pediatriya",
      code: "14.00.09",
      branch: "",
    });
    expect(error).toBeDefined();
  });

  test("`active` yaratishda ham yuborilishi mumkin (modaldagi switch)", () => {
    const { error } = createSpecialtySchema.validate({
      title: "Pediatriya",
      code: "14.00.09",
      branch: "Tibbiyot fanlari",
      active: false,
    });
    expect(error).toBeUndefined();
  });

  test("bo'sh update payload rad etiladi (jimgina 'muvaffaqiyat' bo'lmasin)", () => {
    const { error } = updateSpecialtySchema.validate({});
    expect(error).toBeDefined();
  });

  test("update'da faqat `active` yuborish mumkin (jadvaldagi switch)", () => {
    const { error } = updateSpecialtySchema.validate({ active: false });
    expect(error).toBeUndefined();
  });

  test("update'da `branch` MAJBURIY EMAS — aks holda switch 400 berardi", () => {
    const { error } = updateSpecialtySchema.validate({ title: "Yangi nom" });
    expect(error).toBeUndefined();
  });
});

describe("councilSpecialty.service.buildFilter", () => {
  test("default — faqat FAOLlar", () => {
    expect(service.buildFilter({})).toEqual({ active: true });
  });

  test("`all` — holat bo'yicha filtr YO'Q (kotib jadvali)", () => {
    expect(service.buildFilter({ all: true })).toEqual({});
  });

  test("aniq `active` `all` dan ustun", () => {
    expect(service.buildFilter({ all: true, active: false })).toEqual({
      active: false,
    });
  });

  test("qidiruv nom, shifr va tarmoq bo'yicha", () => {
    const f = service.buildFilter({ search: "pedi", all: true });
    expect(f.$or).toHaveLength(3);
    expect(f.$or[0].title).toBeInstanceOf(RegExp);
    expect(f.$or[1].code).toBeInstanceOf(RegExp);
    expect(f.$or[2].branch).toBeInstanceOf(RegExp);
  });
});
