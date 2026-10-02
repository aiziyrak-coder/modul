"use strict";

const mongoose = require("mongoose");
const Syllabus = require("./syllabus.model");

const validBase = () => ({
  science: new mongoose.Types.ObjectId(),
  faculty: new mongoose.Types.ObjectId(),
});

describe("syllabus.model — approvalSteps default (TZ 5-bosqich)", () => {
  test("yangi hujjat 5 bosqich bilan, TZ tartibida yaratiladi", () => {
    const doc = new Syllabus(validBase());
    expect(doc.approvalSteps.map((s) => s.step)).toEqual([
      "kafedra",
      "arm",
      "methodical",
      "dean",
      "prorektor",
    ]);
    expect(doc.approvalSteps.every((s) => s.status === "pending")).toBe(true);
  });

  test("enum'da \"dean\" bor, tartib TZga mos", () => {
    const stepPath = Syllabus.schema.path("approvalSteps").schema.path("step");
    expect(stepPath.enumValues).toEqual([
      "kafedra",
      "arm",
      "methodical",
      "dean",
      "prorektor",
    ]);
  });

  test("yangi hujjat validateSync() dan xatosiz o'tadi", () => {
    const doc = new Syllabus(validBase());
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });
});

describe("REGRESSION-GUARD — mavjud 4-bosqichli (dean'siz) hujjat buzilmaydi", () => {
  const legacyFourStepDoc = () =>
    new Syllabus({
      ...validBase(),
      status: "approved",
      approvalSteps: [
        { step: "kafedra", status: "approved" },
        { step: "arm", status: "approved" },
        { step: "methodical", status: "approved" },
        { step: "prorektor", status: "approved" },
      ],
    });

  test("validateSync() xatosiz — eski 4 ta step qiymati hamon enum ichida", () => {
    const doc = legacyFourStepDoc();
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  test("save() DB xatosiga emas, faqat validatsiyadan o'tadi (connection'siz muhitda validateSync bilan bir xil natija)", async () => {
    const doc = legacyFourStepDoc();
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  test("dean bosqichi mavjud emas — hujjat 4 bosqichda qoladi (qayta yozilmaydi)", () => {
    const doc = legacyFourStepDoc();
    expect(doc.approvalSteps.map((s) => s.step)).toEqual([
      "kafedra",
      "arm",
      "methodical",
      "prorektor",
    ]);
    expect(doc.approvalSteps.some((s) => s.step === "dean")).toBe(false);
  });
});
