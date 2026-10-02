"use strict";

const EducationForm = require("#references/educationForm/educationForm.model");
const Curriculum = require("#modules/4.05-residency/residencyCurriculum/residencyCurriculum.model");
const plugin = require("#modules/4.05-residency/_services/educationFormRefPlugin");

let kunduzgi;
let sirtqi;

beforeEach(async () => {
  plugin.clearCache();
  kunduzgi = await EducationForm.create({ title: "Kunduzgi" });
  sirtqi = await EducationForm.create({ title: "Sirtqi" });
  await EducationForm.create({ title: "Kechki" });
  plugin.clearCache();
});

const make = (educationForm) =>
  Curriculum.create({
    title: "Test reja",
    program: "ordinatura",
    ...(educationForm === undefined ? {} : { educationForm }),
  });

describe("educationFormRef", () => {
  it("lowercase enum satri BOSH HARFLI qatorga bog'lanadi", async () => {
    const c = await make("kunduzgi");
    expect(c.educationForm).toBe("kunduzgi");
    expect(String(c.educationFormRef)).toBe(String(kunduzgi._id));
  });

  it("`sirtqi` ham bog'lanadi", async () => {
    const c = await make("sirtqi");
    expect(String(c.educationFormRef)).toBe(String(sirtqi._id));
  });

  it("model default'i (`kunduzgi`) ham bog'lanadi", async () => {
    const c = await make(undefined);
    expect(c.educationForm).toBe("kunduzgi");
    expect(String(c.educationFormRef)).toBe(String(kunduzgi._id));
  });

  it("update bilan ergashadi", async () => {
    const c = await make("kunduzgi");
    await Curriculum.findByIdAndUpdate(c._id, { $set: { educationForm: "sirtqi" } });
    const fresh = await Curriculum.findById(c._id);
    expect(String(fresh.educationFormRef)).toBe(String(sirtqi._id));
  });

  it("REGRESSIYA — havolasiz eski hujjat o'qiladi va saqlanadi", async () => {
    const raw = await Curriculum.collection.insertOne({
      title: "Migratsiyagacha",
      program: "ordinatura",
      educationForm: "kunduzgi",
      active: true,
    });
    const doc = await Curriculum.findById(raw.insertedId);
    expect(doc.educationForm).toBe("kunduzgi");
    doc.title = "Tahrir";
    await expect(doc.save()).resolves.toBeTruthy();
  });

  it("ma'lumotnomada bor har qanday shakl QABUL qilinadi", async () => {
    const c = await make("kechki");
    expect(c.educationForm).toBe("kechki");
    expect(c.educationFormRef).not.toBeNull();
  });

  it("ma'lumotnomada YO'Q shakl RAD etiladi (fail-closed)", async () => {
    await expect(make("masofaviy")).rejects.toThrow(/ma'lumotnomada topilmadi/);
  });

  it("update'da ham noma'lum shakl RAD etiladi", async () => {
    const c = await make("kunduzgi");
    await expect(
      Curriculum.findByIdAndUpdate(c._id, { $set: { educationForm: "masofaviy" } }),
    ).rejects.toThrow(/ma'lumotnomada topilmadi/);
  });
});
