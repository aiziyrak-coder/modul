const {
  createWorkDocumentTypeSchema,
  updateWorkDocumentTypeSchema,
} = require("./workDocumentType.validation");
const service = require("./workDocumentType.service");

describe("workDocumentType.validation", () => {
  test("to'g'ri data qabul qilinadi", () => {
    const { error } = createWorkDocumentTypeSchema.validate({
      key: "dissertation",
      labelUz: "Dissertatsiya",
      labelRu: "Диссертация",
      format: "word, pdf",
      required: true,
      order: 5,
    });
    expect(error).toBeUndefined();
  });

  test("kalitsiz (key) toifa rad etiladi", () => {
    const { error } = createWorkDocumentTypeSchema.validate({
      labelUz: "Dissertatsiya",
      format: "pdf",
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/key/);
  });

  test("nomsiz (labelUz) toifa rad etiladi", () => {
    const { error } = createWorkDocumentTypeSchema.validate({
      key: "dissertation",
      format: "pdf",
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/labelUz/);
  });

  test("formatsiz toifa rad etiladi", () => {
    const { error } = createWorkDocumentTypeSchema.validate({
      key: "dissertation",
      labelUz: "Dissertatsiya",
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/format/);
  });

  test("labelRu ixtiyoriy — berilmasa ham o'tadi", () => {
    const { error } = createWorkDocumentTypeSchema.validate({
      key: "cv",
      labelUz: "Tarjimai hol",
      format: "word",
    });
    expect(error).toBeUndefined();
  });

  test("bo'sh update payload rad etiladi (jimgina 'muvaffaqiyat' bo'lmasin)", () => {
    const { error } = updateWorkDocumentTypeSchema.validate({});
    expect(error).toBeDefined();
  });

  test("update'da faqat `required` yuborish mumkin (jadvaldagi switch)", () => {
    const { error } = updateWorkDocumentTypeSchema.validate({ required: false });
    expect(error).toBeUndefined();
  });

  test("update'da faqat `active` yuborish mumkin", () => {
    const { error } = updateWorkDocumentTypeSchema.validate({ active: false });
    expect(error).toBeUndefined();
  });
});

describe("workDocumentType.service.buildFilter", () => {
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

  test("qidiruv nom, kalit va format bo'yicha (4 maydon)", () => {
    const f = service.buildFilter({ search: "diss", all: true });
    expect(f.$or).toHaveLength(4);
    expect(f.$or[0].labelUz).toBeInstanceOf(RegExp);
    expect(f.$or[1].labelRu).toBeInstanceOf(RegExp);
    expect(f.$or[2].key).toBeInstanceOf(RegExp);
    expect(f.$or[3].format).toBeInstanceOf(RegExp);
  });
});
